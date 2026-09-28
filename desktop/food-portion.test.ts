import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { emptyDay, emptyStore, type Store } from '../src/domain/data';
import { createFoodPortionInput, parsePortionedFoodInput } from '../src/domain/food-portion';
import { openStorage } from './storage';

it('keeps meal and favorite quantities through SQLite restart, backup, restore and sync', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'food-portion-'));
  const peerDir = mkdtempSync(join(tmpdir(), 'food-portion-peer-'));
  const food = parsePortionedFoodInput('현미밥', {
    quantity: '200',
    unit: 'g',
    referenceQuantity: '100',
    calories: '150',
    carbohydrates: '30',
    protein: '3',
    fat: '1',
  });
  const data: Store = {
    ...emptyStore(),
    favoriteFoods: [
      {
        id: 'favorite',
        ...food,
      },
    ],
    days: {
      '2026-09-28': {
        ...emptyDay(),
        meals: [
          {
            id: 'meal',
            slot: '점심',
            ...food,
          },
        ],
      },
    },
  };
  let storage = openStorage(dir);
  const peer = openStorage(peerDir);
  try {
    await storage.engine.write(JSON.stringify(data));
    await storage.engine.dailyBackup();
    const backup = storage.backupRead(storage.backups()[0].name);
    expect(JSON.parse(backup)).toEqual(data);
    storage.close();
    storage = openStorage(dir);
    expect(JSON.parse(await storage.engine.read())).toEqual(data);
    await peer.engine.merge(JSON.stringify(await storage.engine.document()));
    expect(JSON.parse(await peer.engine.read())).toEqual(data);
    const smaller = parsePortionedFoodInput(food.name, {
      ...createFoodPortionInput(food),
      quantity: '50',
    });
    const changed = {
      ...data,
      days: {
        '2026-09-28': {
          ...emptyDay(),
          meals: [
            {
              id: 'meal',
              slot: '점심',
              ...smaller,
            },
          ],
        },
      },
    };
    await storage.engine.write(JSON.stringify(changed));
    await peer.engine.merge(JSON.stringify(await storage.engine.document()));
    expect(JSON.parse(await peer.engine.read())).toEqual(changed);
    await storage.engine.restore(backup);
    expect(JSON.parse(await storage.engine.read())).toEqual(data);
  } finally {
    storage.close();
    peer.close();
    rmSync(dir, {
      recursive: true,
      force: true,
    });
    rmSync(peerDir, {
      recursive: true,
      force: true,
    });
  }
});
