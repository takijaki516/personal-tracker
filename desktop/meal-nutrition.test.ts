import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
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
