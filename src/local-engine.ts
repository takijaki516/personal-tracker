import { emptyStore, localDate, parseStore } from './data';
import {
  editDocument,
  mergeDocuments,
  migrateStore,
  newDocument,
  parseDocument,
  snapshot,
  type SyncDocument,
} from './sync-model';

export type LocalAdapter = {
  load(): Promise<SyncDocument | null>;
  commit(doc: SyncDocument): Promise<void>;
  legacy(): Promise<string | null>;
  backup(day: string, raw: string, reason?: string): Promise<void>;
  uuid(): string;
};
export function createEngine(adapter: LocalAdapter) {
  let queue: Promise<unknown> = Promise.resolve();
  const serial = <T>(action: () => Promise<T>): Promise<T> => {
    const result = queue.then(action);
    queue = result.catch(() => {});
    return result;
  };
  // Always re-read SQLite: background tasks and the desktop receiver can also write.
  async function load() {
    const existing = await adapter.load();
    if (existing) {
      return parseDocument(JSON.stringify(existing));
    }
    const raw = await adapter.legacy();
    const old = raw === null ? emptyStore() : parseStore(raw);
    if (raw !== null) {
      await adapter.backup(localDate(), JSON.stringify(old), 'before-migration');
    }
    const doc = raw === null ? newDocument(adapter.uuid()) : migrateStore(old, adapter.uuid());
    await adapter.commit(doc);
    return doc;
  }
  async function backup(doc: SyncDocument, reason?: string) {
    await adapter.backup(localDate(), JSON.stringify(snapshot(doc), null, 2), reason);
  }
  return {
    read: () => serial(async () => JSON.stringify(snapshot(await load()))),
    write: (raw: string, base?: string) =>
      serial(async () => {
        const doc = await load();
        const next = editDocument(
          doc,
          base === undefined ? snapshot(doc) : parseStore(base),
          parseStore(raw),
        );
        await adapter.commit(next);
      }),
    restore: (raw: string) =>
      serial(async () => {
        const target = parseStore(raw);
        const doc = await load();
        await backup(doc, `before-restore-${adapter.uuid()}`);
        await adapter.commit(editDocument(doc, snapshot(doc), target));
      }),
    dailyBackup: () =>
      serial(async () => {
        await backup(await load());
      }),
    document: () => serial(load),
    merge: (raw: string) =>
      serial(async () => {
        const remote = parseDocument(raw);
        const doc = await load();
        await backup(doc);
        const merged = mergeDocuments(doc, remote);
        await adapter.commit(merged);
        return merged;
      }),
  };
}
export type LocalEngine = ReturnType<typeof createEngine>;
