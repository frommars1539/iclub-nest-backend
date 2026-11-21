import { jest } from '@jest/globals';
import { ARGON2_OPTIONS, PasswordService } from './password.service';

/** Reads the m/t/p parameters out of a PHC string, whatever their order. */
function argon2Params(hash: string) {
  const [, algorithm, , paramString] = hash.split('$');
  const params = Object.fromEntries(
    (paramString ?? '').split(',').map((pair) => pair.split('=')),
  ) as Record<string, string>;
  return {
    algorithm,
    memoryCost: Number(params.m),
    timeCost: Number(params.t),
    parallelism: Number(params.p),
  };
}

const EXPECTED = {
  algorithm: 'argon2id',
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
};

describe('PasswordService', () => {
  const service = new PasswordService();

  it('pins the agreed Argon2id parameters', () => {
    expect(ARGON2_OPTIONS.memoryCost).toBe(19456);
    expect(ARGON2_OPTIONS.timeCost).toBe(2);
    expect(ARGON2_OPTIONS.parallelism).toBe(1);
  });

  it('produces an argon2id hash carrying those parameters', async () => {
    const hash = await service.hash('correct horse battery staple');
    // The PHC string records what was actually used, so this checks the
    // real output, not just our constants.
    expect(argon2Params(hash)).toEqual(EXPECTED);
  });

  it('verifies the right password and rejects a wrong one', async () => {
    const hash = await service.hash('correct horse battery staple');
    await expect(
      service.verify(hash, 'correct horse battery staple'),
    ).resolves.toBe(true);
    await expect(service.verify(hash, 'wrong password')).resolves.toBe(false);
  });

  it('salts every hash, so the same password hashes differently', async () => {
    const a = await service.hash('same password');
    const b = await service.hash('same password');
    expect(a).not.toBe(b);
  });

  it('does a full verification against a decoy when there is no hash', async () => {
    const spy = jest.spyOn(service, 'verify');

    const result = await service.verifyOrDecoy(undefined, 'whatever');

    expect(result).toBe(false);
    expect(spy).toHaveBeenCalledTimes(1);
    // The decoy must carry the same params as real hashes, or it would
    // take a different amount of time to verify.

    expect(argon2Params(spy.mock.calls[0]?.[0] ?? '')).toEqual(EXPECTED);

    spy.mockRestore();
  });
});
