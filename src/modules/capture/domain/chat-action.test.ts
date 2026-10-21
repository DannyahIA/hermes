import { describe, expect, it } from 'vitest';

import { decodeChatAction, encodeChatAction } from './chat-action';

const CAPTURE = '9295c43b-103b-447c-8e8b-ba077b4111d7';
const CATEGORY = '3067a014-dd3f-467c-973c-9f7e1a7e8915';

describe('chat button data', () => {
  it('round-trips every action within the 64 bytes a button carries', () => {
    const actions = [
      { kind: 'category', captureId: CAPTURE, categoryId: CATEGORY },
      { kind: 'pick-category', captureId: CAPTURE, page: 0 },
      { kind: 'pick-category', captureId: CAPTURE, page: 2 },
      { kind: 'show', captureId: CAPTURE },
      { kind: 'switch-account', captureId: CAPTURE },
      { kind: 'ask-installments', captureId: CAPTURE },
      { kind: 'installments', captureId: CAPTURE, count: 12 },
      { kind: 'undo', captureId: CAPTURE },
      { kind: 'card-account', captureId: CAPTURE, accountId: CATEGORY },
      { kind: 'discard', captureId: CAPTURE },
    ] as const;

    for (const action of actions) {
      const data = encodeChatAction(action);
      expect(Buffer.byteLength(data)).toBeLessThanOrEqual(64);
      expect(decodeChatAction(data)).toEqual(action);
    }
  });

  it('turns away anything it did not write', () => {
    expect(decodeChatAction('')).toBeNull();
    expect(decodeChatAction('k:abc')).toBeNull();
    expect(decodeChatAction('z:' + 'A'.repeat(22))).toBeNull();
    expect(decodeChatAction('s:' + 'A'.repeat(22) + ':99')).toBeNull();
  });
});
