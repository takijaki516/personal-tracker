import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { emptyDay, emptyStore, localDate } from '../src/domain/data';
import { openStorage } from './storage';
const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});
describe('actual SQLite disk storage', () => {
  it('persists across restart, backs up once per day and keeps pre-restore history', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'exercise-db-'));
    dirs.push(dir);
    const data = { version: 1 as const, days: { [localDate()]: { ...emptyDay(), weight: 72 } } };
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
});
