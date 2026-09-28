import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { emptyStore, type Store } from '../src/domain/data';
import { openStorage } from './storage';

it('keeps favorite foods through SQLite restart, backup, restore and synchronization', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'favorite-foods-'));
  const peerDir = mkdtempSync(join(tmpdir(), 'favorite-foods-peer-'));
  const data: Store = {
    ...emptyStore(),
    favoriteFoods: [
      {
        id: 'rice',
        name: '현미밥',
        calories: 300,
        carbohydrates: 65.5,
        protein: 6,
        fat: 0,
      },
    ],
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
    await storage.engine.restore(JSON.stringify(emptyStore()));
    expect(JSON.parse(await storage.engine.read())).toEqual(emptyStore());
    await storage.engine.restore(backup);
    expect(JSON.parse(await storage.engine.read())).toEqual(data);
    await storage.engine.write(JSON.stringify(emptyStore()));
    await peer.engine.merge(JSON.stringify(await storage.engine.document()));
    await peer.engine.merge(JSON.stringify(original));
    expect(JSON.parse(await peer.engine.read())).toEqual(emptyStore());
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
