import {
  LOGIN_WINDOW_MS,
  loginKey,
  throttleDecision,
  windowStart,
} from './login-throttle.rules';

const NOW = new Date('2026-11-21T10:00:00Z');
const ago = (minutes: number) => new Date(NOW.getTime() - minutes * 60_000);

describe('loginKey', () => {
  it('is a SHA-256 hex digest that does not contain the email', () => {
    const key = loginKey('Ada@Example.com');
    expect(key).toMatch(/^[0-9a-f]{64}$/);
    expect(key).not.toContain('ada');
  });

  it('ignores case and surrounding whitespace, and differs per email', () => {
    expect(loginKey(' ADA@example.com ')).toBe(loginKey('ada@example.com'));
    expect(loginKey('ada@example.com')).not.toBe(loginKey('bob@example.com'));
  });
});

describe('windowStart', () => {
  it('is 15 minutes before now', () => {
    expect(NOW.getTime() - windowStart(NOW).getTime()).toBe(LOGIN_WINDOW_MS);
    expect(LOGIN_WINDOW_MS).toBe(900_000);
  });
});

describe('throttleDecision', () => {
  it('allows up to 9 recent failures', () => {
    const nine = Array.from({ length: 9 }, (_, i) => ago(i));
    expect(throttleDecision(nine, NOW)).toEqual({ blocked: false });
    expect(throttleDecision([], NOW)).toEqual({ blocked: false });
  });

  it('blocks at 10 until the oldest counted failure leaves the window', () => {
    // Newest first; the 10th is 5 minutes old, so it expires in 10 minutes.
    const ten = [0, 1, 1, 2, 2, 3, 3, 4, 4, 5].map(ago);
    expect(throttleDecision(ten, NOW)).toEqual({
      blocked: true,
      retryAfterSeconds: 600,
    });
  });

  it('never reports less than one second to wait', () => {
    const ten = Array.from(
      { length: 10 },
      () => new Date(NOW.getTime() - LOGIN_WINDOW_MS + 1),
    );
    expect(throttleDecision(ten, NOW)).toMatchObject({
      blocked: true,
      retryAfterSeconds: 1,
    });
  });
});
