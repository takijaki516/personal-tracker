import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { applyMealFoodInputs, createMealFoodInput } from '../src/application/meal-editor';
import { emptyDay, emptyStore, localDate, type Store } from '../src/domain/data';
import { openStorage } from './storage';

it('keeps meal nutrition through SQLite restart, backup and restore', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'meal-nutrition-'));
  const data: Store = {
    version: 1,
    days: {
      [localDate()]: {
        ...emptyDay(),
        meals: [
          {
            id: 'lunch',
            name: '도시락',
            slot: '점심',
            calories: 650,
            carbohydrates: 80.5,
            protein: 35,
            fat: 0,
          },
        ],
      },
    },
  };
  let storage = openStorage(dir);
  try {
    await storage.engine.write(JSON.stringify(data));
    await storage.engine.dailyBackup();
    const backup = storage.backupRead(storage.backups()[0].name);
    expect(JSON.parse(backup)).toEqual(data);
    storage.close();
    storage = openStorage(dir);
    expect(JSON.parse(await storage.engine.read())).toEqual(data);
    await storage.engine.restore(JSON.stringify(emptyStore()));
    await storage.engine.restore(backup);
    expect(JSON.parse(await storage.engine.read())).toEqual(data);
  } finally {
    storage.close();
    rmSync(dir, {
      recursive: true,
      force: true,
    });
  }
});

it('keeps multiple foods in one meal slot through restart, backup, restore and repeated sync', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'multiple-meal-foods-'));
  const peerDir = mkdtempSync(join(tmpdir(), 'multiple-meal-foods-peer-'));
  const date = localDate();
  const data: Store = {
    ...emptyStore(),
    days: {
      [date]: applyMealFoodInputs(
        emptyDay(),
        '점심',
        [
          createMealFoodInput('a-rice', {
            name: '현미밥',
            calories: 300,
            carbohydrates: 60,
          }),
          createMealFoodInput('b-chicken', {
            name: '닭가슴살',
            calories: 165,
            protein: 31,
            fat: 3.6,
          }),
        ],
        null,
      ),
    },
  };
  let storage = openStorage(dir);
  const peer = openStorage(peerDir);
  try {
    await storage.engine.write(JSON.stringify(data));
    const document = await storage.engine.document();
    await storage.engine.write(JSON.stringify(data));
    expect(await storage.engine.document()).toEqual(document);
    await storage.engine.dailyBackup();
    const backup = storage.backupRead(storage.backups()[0].name);
    expect(JSON.parse(backup)).toEqual(data);
    storage.close();
    storage = openStorage(dir);
    expect(JSON.parse(await storage.engine.read())).toEqual(data);
    await peer.engine.merge(JSON.stringify(await storage.engine.document()));
    await peer.engine.merge(JSON.stringify(await storage.engine.document()));
    expect(JSON.parse(await peer.engine.read())).toEqual(data);
    const changed = {
      ...data,
      days: {
        [date]: {
          ...data.days[date],
          meals: data.days[date].meals.filter((food) => food.id !== 'a-rice'),
        },
      },
    };
    await storage.engine.write(JSON.stringify(changed));
    await peer.engine.merge(JSON.stringify(await storage.engine.document()));
    expect(JSON.parse(await peer.engine.read())).toEqual(changed);
    await storage.engine.restore(backup);
    await peer.engine.merge(JSON.stringify(await storage.engine.document()));
    expect(JSON.parse(await peer.engine.read())).toEqual(data);
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
