import { describe, expect, it, vi } from 'vitest';
import { emptyDay, emptyStore } from '../domain/data';
import { createFoodPortionInput, parsePortionedFoodInput } from '../domain/food-portion';
import type { SyncDocument } from '../domain/sync-model';
import { createEngine, type LocalAdapter } from './local-engine';
const data = {
  version: 1 as const,
  days: {
    '2026-09-15': {
      ...emptyDay(),
      workouts: [
        {
          id: 'walk',
          name: '산책',
          bodyPart: 'legs',
          sets: [
            {
              reps: 20,
              weightKg: 0,
            },
          ],
        },
      ],
    },
  },
};
function fixture(raw: string | null = null) {
  let doc: SyncDocument | null = null;
  const backup = vi.fn<LocalAdapter['backup']>(async () => {});
  const commit = vi.fn<LocalAdapter['commit']>(async (next: SyncDocument) => {
    doc = structuredClone(next);
  });
  const adapter: LocalAdapter = {
    load: async () => doc,
    commit,
    legacy: async () => raw,
    backup,
    uuid: () => 'test-device',
  };
  return {
    engine: createEngine(adapter),
    backup,
    commit,
    adapter,
  };
}
describe('local persistence and backups', () => {
  it('preserves portion data after failed writes and rejects inconsistent restored totals', async () => {
    const f = fixture();
    const food = parsePortionedFoodInput('식단', {
      quantity: '200',
      unit: 'g',
      referenceQuantity: '100',
      calories: '150',
      carbohydrates: '30',
      protein: '3',
      fat: '1',
    });
    const original = {
      ...emptyStore(),
      favoriteFoods: [
        {
          id: 'food',
          ...food,
        },
      ],
    };
    await f.engine.write(JSON.stringify(original));
    const changedFood = parsePortionedFoodInput(food.name, {
      ...createFoodPortionInput(food),
      quantity: '50',
    });
    const changed = {
      ...original,
      favoriteFoods: [
        {
          id: 'food',
          ...changedFood,
        },
      ],
    };
    f.commit.mockRejectedValueOnce(new Error('disk full'));
    await expect(f.engine.write(JSON.stringify(changed))).rejects.toThrow('disk full');
    expect(JSON.parse(await f.engine.read())).toEqual(original);
    await f.engine.write(JSON.stringify(changed));
    const saved = await f.engine.document();
    await f.engine.write(JSON.stringify(changed));
    expect(await f.engine.document()).toEqual(saved);
    await expect(
      f.engine.restore(
        JSON.stringify({
          ...original,
          favoriteFoods: [
            {
              id: 'food',
              ...food,
              calories: 999,
            },
          ],
        }),
      ),
    ).rejects.toThrow('즐겨찾는 음식 목록');
    expect(f.backup).not.toHaveBeenCalled();
    expect(JSON.parse(await f.engine.read())).toEqual(changed);
  });
  it('backs up legacy data before committing migration', async () => {
    const { engine, backup, commit } = fixture(JSON.stringify(data));
    expect(JSON.parse(await engine.read())).toEqual(data);
    expect(backup).toHaveBeenCalledTimes(1);
    expect(backup.mock.invocationCallOrder[0]).toBeLessThan(commit.mock.invocationCallOrder[0]);
    await engine.read();
    expect(backup).toHaveBeenCalledTimes(1);
  });
  it('drops weight while migrating a legacy store', async () => {
    const legacy = {
      ...data,
      days: {
        '2026-09-15': {
          ...data.days['2026-09-15'],
          weight: 70,
        },
      },
    };
    const { engine } = fixture(JSON.stringify(legacy));
    expect(JSON.parse(await engine.read())).toEqual(data);
    expect(Object.values((await engine.document()).entries).map((entry) => entry.kind)).toEqual([
      'workout',
    ]);
  });
  it('leaves unreadable legacy data untouched', async () => {
    const { engine, commit } = fixture('{broken');
    await expect(engine.read()).rejects.toThrow(SyntaxError);
    expect(commit).not.toHaveBeenCalled();
  });
  it('does not migrate or restore when the protective backup fails', async () => {
    const f = fixture(JSON.stringify(data));
    f.adapter.backup = async () => {
      throw new Error('disk full');
    };
    await expect(f.engine.read()).rejects.toThrow('disk full');
    expect(f.commit).not.toHaveBeenCalled();
  });
  it('backs up before restore and preserves the old version if commit fails', async () => {
    const f = fixture(JSON.stringify(data));
    await f.engine.read();
    f.commit.mockRejectedValueOnce(new Error('full'));
    await expect(f.engine.restore(JSON.stringify(emptyStore()))).rejects.toThrow('full');
    expect(JSON.parse(await f.engine.read())).toEqual(data);
  });
  it('serializes writes and recovers the queue after a failure', async () => {
    const f = fixture();
    await f.engine.read();
    f.commit.mockRejectedValueOnce(new Error('full'));
    await expect(f.engine.write(JSON.stringify(data))).rejects.toThrow('full');
    await f.engine.write(JSON.stringify(data));
    expect(JSON.parse(await f.engine.read())).toEqual(data);
  });
  it('preserves favorites after a failed write and accepts a repeated registration', async () => {
    const f = fixture();
    const favorites = {
      ...emptyStore(),
      favoriteFoods: [
        {
          id: 'rice',
          name: '현미밥',
          calories: 300,
        },
      ],
    };
    await f.engine.write(JSON.stringify(favorites));
    f.commit.mockRejectedValueOnce(new Error('disk full'));
    await expect(f.engine.write(JSON.stringify(emptyStore()))).rejects.toThrow('disk full');
    expect(JSON.parse(await f.engine.read())).toEqual(favorites);
    const before = await f.engine.document();
    await f.engine.write(JSON.stringify(favorites));
    expect(await f.engine.document()).toEqual(before);
    await expect(
      f.engine.write(
        JSON.stringify({
          ...favorites,
          favoriteFoods: [
            {
              id: 'rice',
              name: '현미밥',
              calories: -1,
            },
          ],
        }),
      ),
    ).rejects.toThrow('즐겨찾는 음식 목록');
    expect(JSON.parse(await f.engine.read())).toEqual(favorites);
  });
  it('preserves nutrition goals after a failed save and retries without duplicating changes', async () => {
    const f = fixture();
    const original = {
      ...data,
      nutritionGoals: {
        calories: 2000,
        protein: 150,
      },
    };
    await f.engine.write(JSON.stringify(original));
    const changed = {
      ...original,
      nutritionGoals: {
        calories: 2200,
        fat: 0,
      },
    };
    f.commit.mockRejectedValueOnce(new Error('disk full'));
    await expect(f.engine.write(JSON.stringify(changed))).rejects.toThrow('disk full');
    expect(JSON.parse(await f.engine.read())).toEqual(original);
    await f.engine.write(JSON.stringify(changed));
    expect(JSON.parse(await f.engine.read())).toEqual(changed);
    const saved = await f.engine.document();
    await f.engine.write(JSON.stringify(changed));
    expect(await f.engine.document()).toEqual(saved);
  });
  it('rejects invalid goal restores before creating a backup or replacing saved data', async () => {
    const f = fixture();
    const original = {
      ...data,
      nutritionGoals: { calories: 2000 },
    };
    await f.engine.write(JSON.stringify(original));
    const saved = await f.engine.document();
    const invalid = JSON.stringify({
      ...data,
      nutritionGoals: { protein: -1 },
    });
    await expect(f.engine.restore(invalid)).rejects.toThrow('목표 단백질');
    expect(f.backup).not.toHaveBeenCalled();
    expect(await f.engine.document()).toEqual(saved);
    f.backup.mockRejectedValueOnce(new Error('backup failed'));
    await expect(f.engine.restore(JSON.stringify(emptyStore()))).rejects.toThrow('backup failed');
    expect(JSON.parse(await f.engine.read())).toEqual(original);
  });
});
