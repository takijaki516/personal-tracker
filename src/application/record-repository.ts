import { emptyStore, parseStore, type Store } from '../domain/data';
export type StoragePort = {
  read: () => Promise<string | null>;
  write: (raw: string, base?: string) => Promise<void>;
};
export async function loadRecords(storage: StoragePort): Promise<Store> {
  const raw = await storage.read();
  return raw === null ? emptyStore() : parseStore(raw);
}
export async function saveRecords(storage: StoragePort, data: Store, base?: Store): Promise<void> {
  const raw = JSON.stringify(data);
  parseStore(raw);
  await storage.write(raw, base === undefined ? undefined : JSON.stringify(base));
}
