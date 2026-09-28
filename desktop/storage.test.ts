import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it } from 'vitest';
import { emptyDay, emptyStore, localDate, type Store } from '../src/domain/data';
import { openStorage } from './storage';
const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) {
    rmSync(dir, {
      recursive: true,
      force: true,
    });
  }
});
describe('actual SQLite disk storage', () => {
  it('keeps workout order after restart and backup restore regardless of record IDs', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'exercise-db-'));
    dirs.push(dir);
    const date = localDate();
    const data: Store = {
      version: 1,
      days: {
        [date]: {
          ...emptyDay(),
          workouts: ['z-bench', 'a-incline'].map((id) => ({
            id,
            name: id,
            bodyPart: 'chest',
            sets: [
              {
                reps: 8,
                weightKg: 60,
              },
            ],
          })),
        },
      },
    };
    let store = openStorage(dir);
    await store.engine.write(JSON.stringify(data));
    await store.engine.dailyBackup();
    const backup = store.backupRead(store.backups()[0].name);
    expect(JSON.parse(backup)).toEqual(data);
    store.close();
    store = openStorage(dir);
    expect(JSON.parse(await store.engine.read())).toEqual(data);
    await store.engine.restore(JSON.stringify(emptyStore()));
    await store.engine.restore(backup);
    expect(JSON.parse(await store.engine.read())).toEqual(data);
    store.close();
  });
  it('persists across restart, backs up once per day and keeps pre-restore history', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'exercise-db-'));
    dirs.push(dir);
    const data = {
      version: 1 as const,
      days: {
        [localDate()]: {
          ...emptyDay(),
          meals: [
            {
              id: 'lunch',
              name: '밥',
              slot: '점심',
              calories: 500,
            },
          ],
        },
      },
    };
    let store = openStorage(dir);
    await store.engine.write(JSON.stringify(data));
    await store.engine.dailyBackup();
    await store.engine.dailyBackup();
    expect(store.backups()).toHaveLength(1);
    expect(JSON.parse(store.backupRead(store.backups()[0].name))).toEqual(data);
    expect(readFileSync(join(dir, 'exercise.sqlite')).subarray(0, 15).toString()).toBe(
      'SQLite format 3',
    );
    store.close();
    store = openStorage(dir);
    expect(JSON.parse(await store.engine.read())).toEqual(data);
    await store.engine.restore(JSON.stringify(emptyStore()));
    expect(JSON.parse(await store.engine.read())).toEqual(emptyStore());
    expect(store.backups()).toHaveLength(2);
    expect(() => store.backupRead('../exercise.sqlite')).toThrow('백업 파일을 찾을 수 없습니다.');
    store.close();
  });
  it('removes legacy weight rows on load and leaves other entries intact', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'exercise-db-'));
    dirs.push(dir);
    let store = openStorage(dir);
    const data = {
      version: 1 as const,
      days: {
        [localDate()]: {
          ...emptyDay(),
          meals: [
            {
              id: 'lunch',
              name: '밥',
              slot: '점심',
              calories: 500,
            },
          ],
        },
      },
    };
    await store.engine.write(JSON.stringify(data));
    store.close();

    const database = new DatabaseSync(join(dir, 'exercise.sqlite'));
    const legacy = {
      date: localDate(),
      kind: 'weight',
      id: 'weight',
      value: 72,
      counter: 0,
      device: 'old-device',
    };
    database
      .prepare('INSERT INTO entries(key,value) VALUES (?,?)')
      .run(JSON.stringify([legacy.date, legacy.kind, legacy.id]), JSON.stringify(legacy));
    database.close();

    store = openStorage(dir);
    expect(JSON.parse(await store.engine.read())).toEqual(data);
    store.close();
    const check = new DatabaseSync(join(dir, 'exercise.sqlite'));
    expect(check.prepare('SELECT key FROM entries').all()).toHaveLength(1);
    check.close();
  });
  it('removes legacy workout minutes and notes from SQLite on load', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'exercise-db-'));
    dirs.push(dir);
    let store = openStorage(dir);
    const data = {
      version: 1 as const,
      days: {
        [localDate()]: {
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
    await store.engine.write(JSON.stringify(data));
    store.close();

    const database = new DatabaseSync(join(dir, 'exercise.sqlite'));
    const row = database.prepare('SELECT key,value FROM entries').get() as {
      key: string;
      value: string;
    };
    const entry = JSON.parse(row.value) as { value: { id: string; name: string } };
    database.prepare('UPDATE entries SET value = ? WHERE key = ?').run(
      JSON.stringify({
        ...entry,
        value: {
          ...entry.value,
          minutes: 30,
          note: '강변',
        },
      }),
      row.key,
    );
    database.close();

    store = openStorage(dir);
    expect(JSON.parse(await store.engine.read())).toEqual(data);
    store.close();
    const check = new DatabaseSync(join(dir, 'exercise.sqlite'));
    const stored = check.prepare('SELECT value FROM entries').get() as { value: string };
    expect(JSON.parse(stored.value).value).toEqual(data.days[localDate()].workouts[0]);
    check.close();
  });
});
