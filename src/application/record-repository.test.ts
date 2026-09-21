import { describe, expect, it, vi } from 'vitest';
import { emptyStore } from '../domain/data';
import { loadRecords, saveRecords, type StoragePort } from './record-repository';
describe('async storage migration', () => {
  it('loads original PWA backup format', async () => {
    const data = {
      version: 1,
      days: {
        '2026-09-14': {
          weight: 72,
          meals: [],
          workouts: [],
        },
      },
    };
    expect(
      await loadRecords({
        read: async () => JSON.stringify(data),
        write: vi.fn<StoragePort['write']>(),
      }),
    ).toEqual(data);
  });
  it('does not overwrite unreadable data', async () => {
    const write = vi.fn<StoragePort['write']>();
    await expect(
      loadRecords({
        read: async () => '{broken',
        write,
      }),
    ).rejects.toThrow(SyntaxError);
    expect(write).not.toHaveBeenCalled();
  });
  it('surfaces write failures instead of reporting success', async () => {
    await expect(
      saveRecords(
        {
          read: async () => null,
          write: async () => {
            throw new Error('full');
          },
        },
        emptyStore(),
      ),
    ).rejects.toThrow('full');
  });
  it('round trips an empty store through async persistence', async () => {
    let raw: string | null = null;
    const port = {
      read: async () => raw,
      write: async (value: string) => {
        raw = value;
      },
    };
    await saveRecords(port, emptyStore());
    expect(await loadRecords(port)).toEqual(emptyStore());
  });
});
