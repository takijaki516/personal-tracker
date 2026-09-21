import { randomBytes } from 'node:crypto';
import { createServer } from 'node:http';

import type { LocalEngine } from '../src/application/local-engine';
import { seal, unseal } from '../src/infrastructure/wire';

export function createLanServer(engine: LocalEngine, key: () => string, onSync: () => void) {
  const seen = new Map<string, number>();
  const pending = new Set<() => void>();
  const completions = new Set<() => void>();
  let wakePending = false;
  let lastContact = 0;
  const server = createServer(async (req, res) => {
    if (
      req.method !== 'POST' ||
      !['/sync', '/wait', '/ack'].includes(req.url ?? '') ||
      req.headers.origin
    ) {
      res.writeHead(403).end();
      return;
    }
    let size = 0;
    const chunks: Buffer[] = [];
    try {
      for await (const chunk of req) {
        size += chunk.length;
        if (size > 15_000_000) {
          res.writeHead(413).end();
          req.destroy();
          return;
        }
        chunks.push(Buffer.from(chunk));
      }
      const requestKey = key();
      const { value, nonce } = unseal(Buffer.concat(chunks).toString('utf8'), requestKey);
      if (
        !value ||
        typeof value.id !== 'string' ||
        value.id.length > 100 ||
        `/${value.kind}` !== req.url ||
        typeof value.sentAt !== 'number' ||
        !Number.isSafeInteger(value.sentAt) ||
        Math.abs(Date.now() - value.sentAt) > 300000 ||
        seen.has(nonce)
      ) {
        throw new Error('Invalid request');
      }
      // Remove only expired packets; their authenticated timestamp prevents later replay.
      for (const [oldNonce, expiry] of seen) {
        if (expiry < Date.now()) {
          seen.delete(oldNonce);
        }
      }
      if (seen.size >= 10000) {
        throw new Error('Too many requests');
      }
      seen.set(nonce, value.sentAt + 300000);
      lastContact = Date.now();
      const reply = (data: object) => {
        if (!res.destroyed && !res.writableEnded) {
          res
            .writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' })
            .end(seal({ id: value.id, kind: value.kind, ...data }, requestKey, randomBytes));
        }
      };
      if (value.kind === 'sync') {
        const doc = await engine.merge(JSON.stringify(value.doc));
        reply({ doc });
      } else if (value.kind === 'ack') {
        onSync();
        reply({ ok: true });
        for (const done of completions) {
          done();
        }
        completions.clear();
      } else {
        if (wakePending) {
          wakePending = false;
          reply({ wake: true });
          return;
        }
        const done = () => {
          clearTimeout(timer);
          pending.delete(done);
          reply({ wake: true });
        };
        const timer = setTimeout(done, 25000);
        pending.add(done);
        res.on('close', () => {
          clearTimeout(timer);
          pending.delete(done);
        });
      }
    } catch {
      if (!res.headersSent) {
        res.writeHead(400).end('연결 인증 또는 데이터 검증에 실패했습니다.');
      }
    }
  });
  server.requestTimeout = 20000;
  server.headersTimeout = 10000;
  server.maxConnections = 8;
  function wake() {
    if (pending.size) {
      for (const done of pending) {
        done();
      }
    } else {
      wakePending = true;
    }
  }
  return {
    server,
    active: () => Date.now() - lastContact < 60000,
    wake,
    reset: () => {
      seen.clear();
      lastContact = 0;
      wake();
    },
    requestSync: () =>
      new Promise<void>((resolve, reject) => {
        const done = () => {
          clearTimeout(timer);
          completions.delete(done);
          resolve();
        };
        const timer = setTimeout(() => {
          completions.delete(done);
          reject(
            new Error(
              '휴대폰 응답이 없습니다. 같은 Wi-Fi에서 Android 앱을 열고 다시 시도해 주세요.',
            ),
          );
        }, 20000);
        completions.add(done);
        wake();
      }),
    close: () => {
      for (const done of pending) {
        done();
      }
      for (const done of completions) {
        done();
      }
      server.closeAllConnections();
      server.close();
    },
  };
}
