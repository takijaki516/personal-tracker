import { describe, expect, it } from 'vitest';

import { encodeBytes, seal, unseal } from './wire';

const randomBytes = (size: number) => crypto.getRandomValues(new Uint8Array(size));

describe('encrypted message validation', () => {
  const key = encodeBytes(randomBytes(32));

  it('round trips an object payload', () => {
    const message = { id: 'request', kind: 'ack', sentAt: 123 };
    expect(unseal(seal(message, key, randomBytes), key).value).toEqual(message);
  });

  it.each([null, [], 'text', 42, { nonce: 1, box: false }])(
    'rejects an invalid envelope: %j',
    (envelope) => {
      expect(() => unseal(JSON.stringify(envelope), key)).toThrow(
        '인증되지 않은 동기화 요청입니다.',
      );
    },
  );

  it.each([null, [], 'text', 42])('rejects a non-object decrypted payload: %j', (payload) => {
    expect(() => unseal(seal(payload, key, randomBytes), key)).toThrow(
      '올바르지 않은 동기화 메시지입니다.',
    );
  });
});
