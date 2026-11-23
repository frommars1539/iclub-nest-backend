import { createHash } from 'node:crypto';

/** NFR-015: 10 failed sign-ins per account per 15 minutes. */
export const LOGIN_MAX_FAILURES = 10;
export const LOGIN_WINDOW_MS = 15 * 60 * 1000;

/** SHA-256 of the normalised email: the throttle key, with no address stored. */
export function loginKey(email: string): string {
  return createHash('sha256').update(email.trim().toLowerCase()).digest('hex');
}

export function windowStart(now: Date): Date {
  return new Date(now.getTime() - LOGIN_WINDOW_MS);
}

export type ThrottleDecision =
  { blocked: false } | { blocked: true; retryAfterSeconds: number };

/**
 * `recentFailuresNewestFirst` holds at most the 10 newest failures inside the
 * window. With 10 of them the account is blocked until the OLDEST of those
 * ages out, which is when the count drops back to 9.
 */
export function throttleDecision(
  recentFailuresNewestFirst: readonly Date[],
  now: Date,
): ThrottleDecision {
  if (recentFailuresNewestFirst.length < LOGIN_MAX_FAILURES) {
    return { blocked: false };
  }
  const oldestCounted = recentFailuresNewestFirst[LOGIN_MAX_FAILURES - 1];
  if (!oldestCounted) return { blocked: false };

  const retryAt = oldestCounted.getTime() + LOGIN_WINDOW_MS;
  return {
    blocked: true,
    retryAfterSeconds: Math.max(1, Math.ceil((retryAt - now.getTime()) / 1000)),
  };
}
