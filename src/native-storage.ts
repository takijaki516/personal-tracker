import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import { Directory, File, Paths } from 'expo-file-system';
import * as SQLite from 'expo-sqlite';

import { STORAGE_KEY, parseStore } from './data';
import { createEngine } from './local-engine';
import { parseDocument } from './sync-model';

let database: Promise<SQLite.SQLiteDatabase> | undefined;
export function db() {
  return (database ??= (async () => {
    const connection = await SQLite.openDatabaseAsync('exercise.sqlite');
    await connection.execAsync(
      'PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS entries (key TEXT PRIMARY KEY, value TEXT NOT NULL); CREATE TABLE IF NOT EXISTS metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);',
    );
    return connection;
  })());
}
export async function setting(key: string) {
  return (
    (
      await (
        await db()
      ).getFirstAsync<{ value: string }>('SELECT value FROM metadata WHERE key = ?', key)
    )?.value ?? null
  );
}
export async function setSetting(key: string, value: string) {
  await (
    await db()
  ).runAsync('INSERT OR REPLACE INTO metadata(key,value) VALUES (?,?)', key, value);
}
export const backupDirectory = () => new Directory(Paths.document, 'backups');
export function backupFiles() {
  const dir = backupDirectory();
  return dir.exists
    ? dir
        .list()
        .filter((f): f is File => f instanceof File && f.name.endsWith('.json'))
        .map((f) => ({ name: f.name }))
        .sort((a, b) => b.name.localeCompare(a.name))
    : [];
}
export async function readBackupFile(name: string) {
  if (!backupFiles().some((f) => f.name === name)) {
    throw new Error('백업 파일을 찾을 수 없습니다.');
  }
  const file = new File(backupDirectory(), name);
  if (file.size > 10_000_000) {
    throw new Error('백업 파일이 너무 큽니다.');
  }
  const raw = await file.text();
  parseStore(raw);
  return raw;
}
export const engine = createEngine({
  uuid: Crypto.randomUUID,
  legacy: () => AsyncStorage.getItem(STORAGE_KEY),
  load: async () => {
    const raw = await setting('document');
    if (raw === null) {
      return null;
    }
    const metadata = JSON.parse(raw);
    const entries = Object.fromEntries(
      (
        await (
          await db()
        ).getAllAsync<{ key: string; value: string }>('SELECT key,value FROM entries')
      ).map((row) => [row.key, JSON.parse(row.value)]),
    );
    return parseDocument(JSON.stringify({ ...metadata, entries }));
  },
  commit: async (doc) => {
    await (
      await db()
    ).withExclusiveTransactionAsync(async (tx) => {
      await tx.runAsync(
        'INSERT OR REPLACE INTO metadata(key,value) VALUES (?,?)',
        'document',
        JSON.stringify({ schema: doc.schema, device: doc.device, clock: doc.clock }),
      );
      for (const [key, value] of Object.entries(doc.entries)) {
        await tx.runAsync(
          'INSERT OR REPLACE INTO entries(key,value) VALUES (?,?)',
          key,
          JSON.stringify(value),
        );
      }
    });
  },
  backup: async (day, raw, reason) => {
    const dir = backupDirectory();
    dir.create({ idempotent: true, intermediates: true });
    const target = new File(dir, `운동관리-${day}${reason ? `-${reason}` : ''}.json`);
    if (target.exists) {
      return;
    }
    const temp = new File(dir, `${Crypto.randomUUID()}.tmp`);
    try {
      temp.create();
      temp.write(raw);
      temp.move(target);
    } finally {
      if (temp.exists && temp.uri !== target.uri) {
        temp.delete();
      }
    }
  },
});
