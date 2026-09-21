import { randomUUID } from 'node:crypto';
import {
  mkdirSync,
  writeFileSync,
  renameSync,
  existsSync,
  readdirSync,
  readFileSync,
  statSync,
} from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createEngine } from '../src/application/local-engine';
import { parseStore } from '../src/domain/data';
import { parseDocument } from '../src/domain/sync-model';

export function openStorage(directory: string) {
  mkdirSync(directory, {
    recursive: true,
    mode: 0o700,
  });
  const backupPath = join(directory, 'backups');
  mkdirSync(backupPath, {
    recursive: true,
    mode: 0o700,
  });
  const db = new DatabaseSync(join(directory, 'exercise.sqlite'));
  db.exec(
    'PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS entries (key TEXT PRIMARY KEY, value TEXT NOT NULL); CREATE TABLE IF NOT EXISTS metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);',
  );
  const get = (key: string): string | null =>
    (
      db.prepare('SELECT value FROM metadata WHERE key = ?').get(key) as
        | { value: string }
        | undefined
    )?.value ?? null;
  const set = (key: string, value: string) => {
    db.prepare('INSERT OR REPLACE INTO metadata(key,value) VALUES (?,?)').run(key, value);
  };
  const engine = createEngine({
    uuid: randomUUID,
    legacy: async () => null,
    load: async () => {
      const raw = get('document');
      if (raw === null) {
        return null;
      }
      const entries = Object.fromEntries(
        (db.prepare('SELECT key,value FROM entries').all() as { key: string; value: string }[]).map(
          (row) => [row.key, JSON.parse(row.value)],
        ),
      );
      return parseDocument(
        JSON.stringify({
          ...JSON.parse(raw),
          entries,
        }),
      );
    },
    commit: async (doc) => {
      db.exec('BEGIN IMMEDIATE');
      try {
        set(
          'document',
          JSON.stringify({
            schema: doc.schema,
            device: doc.device,
            clock: doc.clock,
          }),
        );
        const statement = db.prepare('INSERT OR REPLACE INTO entries(key,value) VALUES (?,?)');
        for (const [key, value] of Object.entries(doc.entries)) {
          statement.run(key, JSON.stringify(value));
        }
        db.exec('COMMIT');
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
    backup: async (day, raw, reason) => {
      const target = join(backupPath, `운동관리-${day}${reason ? `-${reason}` : ''}.json`);
      if (existsSync(target)) {
        return;
      }
      const temp = `${target}.tmp`;
      writeFileSync(temp, raw, { mode: 0o600 });
      renameSync(temp, target);
    },
  });
  const backups = () =>
    readdirSync(backupPath)
      .filter((name) => name.endsWith('.json'))
      .sort()
      .reverse()
      .map((name) => ({ name }));
  const backupRead = (name: string) => {
    if (!backups().some((item) => item.name === name)) {
      throw new Error('백업 파일을 찾을 수 없습니다.');
    }
    const path = join(backupPath, name);
    if (statSync(path).size > 10_000_000) {
      throw new Error('백업 파일이 너무 큽니다.');
    }
    const raw = readFileSync(path, 'utf8');
    parseStore(raw);
    return raw;
  };
  return {
    engine,
    backupPath,
    backups,
    backupRead,
    get,
    set,
    close: () => db.close(),
  };
}
