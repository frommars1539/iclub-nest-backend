import { Injectable } from '@nestjs/common';
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
export class PasswordService {
  hash(password: string): Promise<string> {
    return argon.hash(password, ARGON2_OPTIONS);
  }

  /** Params are read from the hash itself, so old hashes keep working. */
  verify(hash: string, password: string): Promise<boolean> {
    return argon.verify(hash, password);
  }
}
