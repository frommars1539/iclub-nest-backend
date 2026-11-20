import { ARGON2_OPTIONS, PasswordService } from './password.service';

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
    expect(hash).toMatch(/^\$argon2id\$v=19\$/);
    expect(hash.split('$')[3].split(',')).toEqual(
      expect.arrayContaining(['m=19456', 't=2', 'p=1']),
    );
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
});
