import { randomBytes } from 'node:crypto';
import { once } from 'node:events';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { emptyDay, emptyStore } from '../src/domain/data';
import { editDocument, newDocument, parseDocument, snapshot } from '../src/domain/sync-model';
import { encodeBytes, parsePairing, seal, unseal } from '../src/infrastructure/wire';
import { createLanServer } from './lan-server';
import { openStorage } from './storage';
const cleanups: (() => void)[] = [];
afterEach(() => {
  for (const cleanup of cleanups.splice(0)) {
    cleanup();
  }
});
describe('encrypted local network transport', () => {
  it('rejects non-LAN connection codes and wrong encryption keys', () => {
    const key = encodeBytes(randomBytes(32));
    expect(parsePairing(`exercise://192.168.0.2:47831#${key}`).host).toBe('192.168.0.2');
    expect(() => parsePairing(`exercise://8.8.8.8:47831#${key}`)).toThrow(
      '올바른 로컬 네트워크 연결 코드가 아닙니다.',
    );
    const encoded = seal({ privateRecord: '산책' }, key, randomBytes);
    expect(encoded).not.toContain('산책');
    expect(() => unseal(encoded, encodeBytes(randomBytes(32)))).toThrow(
      '연결 인증에 실패했습니다.',
    );
  });
  it('syncs through a real HTTP server, rejects replay and wakes a waiting phone', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'exercise-lan-'));
    const store = openStorage(dir);
    const key = encodeBytes(randomBytes(32));
    const lan = createLanServer(
      store.engine,
      () => key,
      () => {},
    );
    cleanups.push(() => {
      lan.close();
      store.close();
      rmSync(dir, {
        recursive: true,
        force: true,
      });
    });
    lan.server.listen(0, '127.0.0.1');
    await once(lan.server, 'listening');
    const address = lan.server.address() as { port: number };
    const url = `http://127.0.0.1:${address.port}`;
    const data = {
      version: 1 as const,
      days: {
        '2026-09-15': {
          ...emptyDay(),
          weight: 65,
        },
      },
    };
    const doc = editDocument(newDocument('phone'), emptyStore(), data);
    const body = seal(
      {
        id: 'one',
        kind: 'sync',
        doc,
        sentAt: Date.now(),
      },
      key,
      randomBytes,
    );
    const response = await fetch(`${url}/sync`, {
      method: 'POST',
      body,
    });
    expect(response.status).toBe(200);
    const responseDocument = parseDocument(
      JSON.stringify(unseal(await response.text(), key).value.doc),
    );
    expect(snapshot(responseDocument)).toEqual(data);
    expect(JSON.parse(await store.engine.read())).toEqual(data);
    expect(
      (
        await fetch(`${url}/sync`, {
          method: 'POST',
          body,
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await fetch(`${url}/sync`, {
          method: 'POST',
          headers: { Origin: 'https://untrusted.test' },
          body: seal(
            {
              id: 'two',
              kind: 'sync',
              doc,
              sentAt: Date.now(),
            },
            key,
            randomBytes,
          ),
        })
      ).status,
    ).toBe(403);
    const wait = fetch(`${url}/wait`, {
      method: 'POST',
      body: seal(
        {
          id: 'wait',
          kind: 'wait',
          sentAt: Date.now(),
        },
        key,
        randomBytes,
      ),
    });
    lan.wake();
    expect(unseal(await (await wait).text(), key).value.id).toBe('wait');
    const completion = lan.requestSync();
    const ack = await fetch(`${url}/ack`, {
      method: 'POST',
      body: seal(
        {
          id: 'ack',
          kind: 'ack',
          sentAt: Date.now(),
        },
        key,
        randomBytes,
      ),
    });
    expect(ack.status).toBe(200);
    await completion;
    expect(
      (
        await fetch(`${url}/wait`, {
          method: 'POST',
          body: seal(
            {
              id: 'expired',
              kind: 'wait',
              sentAt: Date.now() - 600000,
            },
            key,
            randomBytes,
          ),
        })
      ).status,
    ).toBe(400);
  });
});
