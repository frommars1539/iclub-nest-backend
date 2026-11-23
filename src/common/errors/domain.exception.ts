import { HttpException, HttpStatus } from '@nestjs/common';
import type { ErrorCode } from './error-codes';

/** A business-rule failure with a stable code. Defaults to 409 Conflict. */
export class DomainException extends HttpException {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    status: HttpStatus = HttpStatus.CONFLICT,
    public readonly details?: unknown,
  ) {
    super(message, status);
  }
}
