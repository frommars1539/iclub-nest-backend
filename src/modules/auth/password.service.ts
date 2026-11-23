import { Injectable, type OnModuleInit } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import * as argon from 'argon2';

/**
 * Argon2id parameters (OWASP minimum for argon2id). Pinned explicitly so a
 * library upgrade can never silently change how passwords are hashed.
 * password.service.spec.ts fails if these change.
 */
export const ARGON2_OPTIONS = {
  type: argon.argon2id,
  memoryCost: 19456, // KiB, i.e. 19 MiB
  timeCost: 2,
  parallelism: 1,
} as const;

@Injectable()
export class PasswordService implements OnModuleInit {
  /** Hash of a random throwaway value, used to equalise sign-in timing. */
  private decoyHash?: Promise<string>;

  async onModuleInit(): Promise<void> {
    await this.getDecoyHash();
  }

  hash(password: string): Promise<string> {
    return argon.hash(password, ARGON2_OPTIONS);
  }

  verify(hash: string, password: string): Promise<boolean> {
    return argon.verify(hash, password);
  }

  async verifyOrDecoy(
    hash: string | undefined,
    password: string,
  ): Promise<boolean> {
    if (hash) return this.verify(hash, password);

    await this.verify(await this.getDecoyHash(), password);
    return false;
  }

  private getDecoyHash(): Promise<string> {
    this.decoyHash ??= this.hash(randomBytes(32).toString('hex'));
    return this.decoyHash;
  }
}
