import type { ErrorCode } from './errors/error-codes';

export interface ApiSuccess<T> {
  success: true;
  data: T;
  message: string;
}

export interface ApiFailure {
  success: false;
  error: {
    code: ErrorCode;
    message: string;
    /** Field-level validation messages, when the request failed validation. */
    details?: unknown;
  };
}
