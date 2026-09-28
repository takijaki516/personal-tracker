import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { emptyDay, emptyStore, type Store } from '../src/domain/data';
import { openStorage } from './storage';

it('keeps nutrition goals and meals through SQLite restart, backup, restore and sync', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'nutrition-goals-'));
  const peerDir = mkdtempSync(join(tmpdir(), 'nutrition-goals-peer-'));
  const data: Store = {
    ...emptyStore(),
    nutritionGoals: {
      calories: 2000,
      carbohydrates: 250,
      protein: 150,
      fat: 0,
    },
    days: {
      '2026-09-28': {
        ...emptyDay(),
        meals: [
          {
            id: 'meal',
            name: '현미밥',
            slot: '점심',
            calories: 300,
          },
        ],
      },
    },
  };
  let storage = openStorage(dir);
  const peer = openStorage(peerDir);
  try {
    await storage.engine.write(JSON.stringify(data));
    const original = await storage.engine.document();
    await storage.engine.dailyBackup();
    const backup = storage.backupRead(storage.backups()[0].name);
    expect(JSON.parse(backup)).toEqual(data);
    storage.close();
    storage = openStorage(dir);
    expect(JSON.parse(await storage.engine.read())).toEqual(data);
    await peer.engine.merge(JSON.stringify(await storage.engine.document()));
    expect(JSON.parse(await peer.engine.read())).toEqual(data);

    const changed = {
      ...data,
      nutritionGoals: { protein: 160 },
    };
    await storage.engine.write(JSON.stringify(changed));
    await peer.engine.merge(JSON.stringify(await storage.engine.document()));
    expect(JSON.parse(await peer.engine.read())).toEqual(changed);
    await storage.engine.restore(backup);
    expect(JSON.parse(await storage.engine.read())).toEqual(data);

    const cleared: Store = {
      version: 1,
      days: data.days,
    };
    await storage.engine.write(JSON.stringify(cleared));
    await peer.engine.merge(JSON.stringify(await storage.engine.document()));
    await peer.engine.merge(JSON.stringify(original));
    expect(JSON.parse(await peer.engine.read())).toEqual(cleared);
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
