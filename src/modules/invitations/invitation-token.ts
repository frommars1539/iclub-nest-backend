import { createHash, randomBytes } from 'node:crypto';

/** SHA-256 hex. A 256-bit random token cannot be brute-forced, so a fast hash is enough. */
export function hashInvitationToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** `token` goes in the link and nowhere else; only `tokenHash` is stored. */
export function generateInvitationToken() {
  const token = randomBytes(32).toString('base64url');
  return { token, tokenHash: hashInvitationToken(token) };
}
