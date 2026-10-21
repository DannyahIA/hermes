/**
 * What a button under a payment's message does. Buttons carry only the
 * capture's id (and the choice), never amounts or names: whoever taps is
 * checked against the capture's owner on the server (spec
 * 2026-10-17-telegram-apple-pay-design.md §5.4).
 */
export type ChatAction =
  | { kind: 'category'; captureId: string; categoryId: string }
  | { kind: 'pick-category'; captureId: string; page: number }
  | { kind: 'show'; captureId: string }
  | { kind: 'switch-account'; captureId: string }
  | { kind: 'ask-installments'; captureId: string }
  | { kind: 'installments'; captureId: string; count: number }
  | { kind: 'undo'; captureId: string }
  | { kind: 'card-account'; captureId: string; accountId: string }
  | { kind: 'discard'; captureId: string }
  /** Saves an entry from the chat that waited for a yes. */
  | { kind: 'confirm'; captureId: string }
  /** Leaves it as it is (the "no" to "Desfazer o último registro?"). */
  | { kind: 'keep'; captureId: string };

export const INSTALLMENT_CHOICES = [2, 3, 4, 5, 6, 8, 10, 12];

const CODES: Record<ChatAction['kind'], string> = {
  category: 'k',
  'pick-category': 'o',
  show: 'v',
  'switch-account': 'a',
  'ask-installments': 'p',
  installments: 's',
  undo: 'u',
  'card-account': 'w',
  discard: 'x',
  confirm: 'c',
  keep: 'm',
};
const KINDS = Object.fromEntries(
  Object.entries(CODES).map(([kind, code]) => [code, kind]),
) as Record<string, ChatAction['kind']>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** A UUID in 22 characters instead of 36: two of them fit in a button. */
function pack(uuid: string): string {
  return Buffer.from(uuid.replace(/-/g, ''), 'hex').toString('base64url');
}

function unpack(packed: string | undefined): string | null {
  if (!packed || !/^[A-Za-z0-9_-]{22}$/.test(packed)) return null;
  const hex = Buffer.from(packed, 'base64url').toString('hex');
  const uuid = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  return UUID.test(uuid) ? uuid : null;
}

export function encodeChatAction(action: ChatAction): string {
  const parts = [CODES[action.kind], pack(action.captureId)];
  if (action.kind === 'category') parts.push(pack(action.categoryId));
  if (action.kind === 'card-account') parts.push(pack(action.accountId));
  if (action.kind === 'pick-category') parts.push(String(action.page));
  if (action.kind === 'installments') parts.push(String(action.count));
  return parts.join(':');
}

export function decodeChatAction(data: string): ChatAction | null {
  const [code, capture, extra] = data.split(':');
  const kind = KINDS[code ?? ''];
  const captureId = unpack(capture);
  if (!kind || !captureId) return null;

  switch (kind) {
    case 'category': {
      const categoryId = unpack(extra);
      return categoryId ? { kind, captureId, categoryId } : null;
    }
    case 'card-account': {
      const accountId = unpack(extra);
      return accountId ? { kind, captureId, accountId } : null;
    }
    case 'pick-category': {
      const page = Number(extra);
      return Number.isInteger(page) && page >= 0 && page < 50
        ? { kind, captureId, page }
        : null;
    }
    case 'installments': {
      const count = Number(extra);
      return INSTALLMENT_CHOICES.includes(count)
        ? { kind, captureId, count }
        : null;
    }
    default:
      return extra === undefined ? { kind, captureId } : null;
  }
}
