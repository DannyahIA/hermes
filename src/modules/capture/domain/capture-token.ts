import { createHash, randomBytes } from 'node:crypto';

const PREFIX = 'hm_';
/** "hm_" and six characters: enough to tell a user's tokens apart. */
const VISIBLE = PREFIX.length + 6;

export function hashCaptureToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * A new token for the iPhone shortcut: 32 random bytes in base64url with
 * the "hm_" prefix, so it is recognizable wherever it is pasted. Only its
 * hash is kept; the token is shown once.
 */
export function generateCaptureToken(): {
  token: string;
  hash: string;
  prefix: string;
} {
  const token = `${PREFIX}${randomBytes(32).toString('base64url')}`;
  return {
    token,
    hash: hashCaptureToken(token),
    prefix: token.slice(0, VISIBLE),
  };
}
