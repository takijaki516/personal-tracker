import * as SQLite from 'expo-sqlite';
import { parseDocument, type SyncDocument } from '../../domain/sync-model';

let database: Promise<SQLite.SQLiteDatabase> | undefined;

function parseMetadata(raw: string): Record<string, unknown> {
  const value: unknown = JSON.parse(raw);
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('저장된 문서 메타데이터가 올바르지 않습니다.');
  }
  return value as Record<string, unknown>;
}

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

export async function loadDocument() {
  const raw = await setting('document');
  if (raw === null) {
    return null;
  }
  const metadata = parseMetadata(raw);
  const rows = await (
    await db()
  ).getAllAsync<{ key: string; value: string }>('SELECT key,value FROM entries');
  const entries = Object.fromEntries(rows.map((row) => [row.key, JSON.parse(row.value)]));
  return parseDocument(
    JSON.stringify({
      ...metadata,
      entries,
    }),
  );
}

export async function commitDocument(doc: SyncDocument) {
  await (
    await db()
  ).withExclusiveTransactionAsync(async (tx) => {
    await tx.runAsync(
      'INSERT OR REPLACE INTO metadata(key,value) VALUES (?,?)',
      'document',
      JSON.stringify({
        schema: doc.schema,
        device: doc.device,
        clock: doc.clock,
      }),
    );
    for (const [key, value] of Object.entries(doc.entries)) {
      await tx.runAsync(
        'INSERT OR REPLACE INTO entries(key,value) VALUES (?,?)',
        key,
        JSON.stringify(value),
      );
    }
  });
}
