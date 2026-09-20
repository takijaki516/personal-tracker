import { describe, expect, it, vi } from 'vitest';

import { emptyDay, emptyStore } from './data';
import { createEngine, type LocalAdapter } from './local-engine';
import type { SyncDocument } from './sync-model';
const data = { version: 1 as const, days: { '2026-09-15': { ...emptyDay(), weight: 70 } } };
function fixture(raw: string | null = null) {
  let doc: SyncDocument | null = null;
  const backup = vi.fn<LocalAdapter['backup']>(async () => {});
  const commit = vi.fn<LocalAdapter['commit']>(async (next: SyncDocument) => {
    doc = structuredClone(next);
  });
  const adapter: LocalAdapter = {
    load: async () => doc,
    commit,
    legacy: async () => raw,
    backup,
    uuid: () => 'test-device',
  };
  return { engine: createEngine(adapter), backup, commit, adapter };
}
describe('local persistence and backups', () => {
  it('backs up legacy data before committing migration', async () => {
    const { engine, backup, commit } = fixture(JSON.stringify(data));
    expect(JSON.parse(await engine.read())).toEqual(data);
    expect(backup).toHaveBeenCalledTimes(1);
    expect(backup.mock.invocationCallOrder[0]).toBeLessThan(commit.mock.invocationCallOrder[0]);
    await engine.read();
    expect(backup).toHaveBeenCalledTimes(1);
  });
  it('leaves unreadable legacy data untouched', async () => {
    const { engine, commit } = fixture('{broken');
    await expect(engine.read()).rejects.toThrow(SyntaxError);
    expect(commit).not.toHaveBeenCalled();
  });
  it('does not migrate or restore when the protective backup fails', async () => {
    const f = fixture(JSON.stringify(data));
    f.adapter.backup = async () => {
      throw new Error('disk full');
    };
    await expect(f.engine.read()).rejects.toThrow('disk full');
    expect(f.commit).not.toHaveBeenCalled();
  });
  it('backs up before restore and preserves the old version if commit fails', async () => {
    const f = fixture(JSON.stringify(data));
    await f.engine.read();
    f.commit.mockRejectedValueOnce(new Error('full'));
    await expect(f.engine.restore(JSON.stringify(emptyStore()))).rejects.toThrow('full');
    expect(JSON.parse(await f.engine.read())).toEqual(data);
  });
  it('serializes writes and recovers the queue after a failure', async () => {
    const f = fixture();
    await f.engine.read();
    f.commit.mockRejectedValueOnce(new Error('full'));
    await expect(f.engine.write(JSON.stringify(data))).rejects.toThrow('full');
    await f.engine.write(JSON.stringify(data));
    expect(JSON.parse(await f.engine.read())).toEqual(data);
  });
});
