import { fromByteArray, toByteArray } from 'base64-js';
import nacl from 'tweetnacl';

export type Pairing = { host: string; port: number; key: string };

export function parsePairing(text: string): Pairing {
  const match = /^exercise:\/\/([0-9.]+):(\d+)#([A-Za-z0-9+/=]+)$/.exec(text.trim());
  if (!match) {
    throw new Error('Mac에 표시된 연결 코드를 그대로 붙여 넣어 주세요.');
  }
  const [, host, port, key] = match;
  const ip = host.split('.').map(Number);
  const local =
    ip.length === 4 &&
    ip.every((n) => Number.isInteger(n) && n >= 0 && n <= 255) &&
    (ip[0] === 10 ||
      (ip[0] === 192 && ip[1] === 168) ||
      (ip[0] === 172 && ip[1] >= 16 && ip[1] <= 31));
  if (!local || +port < 1024 || +port > 65535 || toByteArray(key).length !== 32) {
    throw new Error('올바른 로컬 네트워크 연결 코드가 아닙니다.');
  }
  return {
    host,
    port: +port,
    key,
  };
}
export const pairingText = (p: Pairing) => `exercise://${p.host}:${p.port}#${p.key}`;
export const encodeBytes = fromByteArray;
export function seal(value: unknown, key: string, random: (size: number) => Uint8Array): string {
  const nonce = random(nacl.secretbox.nonceLength);
  const data = new TextEncoder().encode(JSON.stringify(value));
  return JSON.stringify({
    nonce: fromByteArray(nonce),
    box: fromByteArray(nacl.secretbox(data, nonce, toByteArray(key))),
  });
}
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export function unseal(
  raw: string,
  key: string,
): { value: Record<string, unknown>; nonce: string } {
  if (raw.length > 15_000_000) {
    throw new Error('동기화 전송 크기를 초과했습니다.');
  }
  const envelope: unknown = JSON.parse(raw);
  if (
    !isRecord(envelope) ||
    typeof envelope.nonce !== 'string' ||
    typeof envelope.box !== 'string'
  ) {
    throw new Error('인증되지 않은 동기화 요청입니다.');
  }
  const bytes = nacl.secretbox.open(
    toByteArray(envelope.box),
    toByteArray(envelope.nonce),
    toByteArray(key),
  );
  if (!bytes) {
    throw new Error('연결 인증에 실패했습니다. 연결 코드를 확인해 주세요.');
  }
  const value: unknown = JSON.parse(new TextDecoder().decode(bytes));
  if (!isRecord(value)) {
    throw new Error('올바르지 않은 동기화 메시지입니다.');
  }
  return {
    value,
    nonce: envelope.nonce,
  };
}
