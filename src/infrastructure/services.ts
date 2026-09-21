import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

import type { ConnectionInfo } from './desktop-bridge';
import {
  engine,
  backupDirectory,
  backupFiles,
  readBackupFile,
  setting,
  setSetting,
} from './native-storage';
import { parsePairing, seal, unseal } from './wire';

const PAIRING_KEY = 'exercise.lan.pairing';
let syncing: Promise<void> | undefined;
async function request(kind: 'sync' | 'wait' | 'ack', signal?: AbortSignal) {
  const code = await SecureStore.getItemAsync(PAIRING_KEY);
  if (!code) {
    throw new Error('먼저 Mac 연결 코드를 입력해 주세요.');
  }
  const peer = parsePairing(code);
  const id = Crypto.randomUUID();
  const doc = kind === 'sync' ? await engine.document() : undefined;
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener('abort', abort);
  if (signal?.aborted) {
    controller.abort();
  }
  const timeout = setTimeout(abort, kind === 'wait' ? 35000 : 15000);
  try {
    const response = await fetch(`http://${peer.host}:${peer.port}/${kind}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: seal({ id, kind, doc, sentAt: Date.now() }, peer.key, Crypto.getRandomBytes),
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(
        `Mac 연결에 실패했습니다 (${response.status}). 연결 코드와 같은 Wi-Fi인지 확인해 주세요.`,
      );
    }
    const { value } = unseal(await response.text(), peer.key);
    if (value.id !== id || value.kind !== kind) {
      throw new Error('동기화 응답이 일치하지 않습니다.');
    }
    if (kind === 'sync') {
      await engine.merge(JSON.stringify(value.doc));
    }
    return value;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', abort);
  }
}
export const restoreStored = engine.restore;
export async function maintenance() {
  await engine.dailyBackup();
}
export async function getConnectionInfo(): Promise<ConnectionInfo> {
  const code = await SecureStore.getItemAsync(PAIRING_KEY);
  return {
    mode: 'android',
    codes: [],
    connected: !!code,
    lastSync: await setting('lastSync'),
    backupPath: backupDirectory().uri,
  };
}
export async function connect(code: string) {
  parsePairing(code);
  await SecureStore.setItemAsync(PAIRING_KEY, code.trim());
}
export async function disconnect() {
  await SecureStore.deleteItemAsync(PAIRING_KEY);
}
export function syncNow() {
  return (syncing ??= request('sync')
    .then(async () => {
      await request('ack');
      await setSetting('lastSync', new Date().toISOString());
    })
    .finally(() => {
      syncing = undefined;
    }));
}
export const listBackups = async () => backupFiles();
export const readBackup = readBackupFile;

// A long poll lets the Mac's button wake an active phone immediately without rapid polling.
export function watchSync(onChange: () => void, onError: (message: string) => void) {
  const controller = new AbortController();
  void (async () => {
    while (!controller.signal.aborted) {
      if (!(await SecureStore.getItemAsync(PAIRING_KEY))) {
        break;
      }
      try {
        await syncNow();
        if (controller.signal.aborted) {
          break;
        }
        onChange();
        await request('wait', controller.signal);
      } catch (error) {
        if (controller.signal.aborted) {
          break;
        }
        onError(error instanceof Error ? error.message : 'Mac 연결 대기 중');
        await new Promise<void>((resolve) => {
          const finish = () => {
            clearTimeout(timer);
            controller.signal.removeEventListener('abort', finish);
            resolve();
          };
          const timer = setTimeout(finish, 30000);
          controller.signal.addEventListener('abort', finish, { once: true });
        });
      }
    }
  })().catch((error) => {
    if (!controller.signal.aborted) {
      onError(String(error));
    }
  });
  return () => controller.abort();
}
