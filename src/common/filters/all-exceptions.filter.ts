import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Prisma } from '../../generated/prisma/client';
import type { ApiFailure } from '../api-response';
import { mapDatabaseMessage } from '../errors/database-errors';
import { DomainException } from '../errors/domain.exception';
import { ErrorCode } from '../errors/error-codes';

type ErrorBody = ApiFailure['error'];

const STATUS_TO_CODE: Readonly<Record<number, ErrorCode>> = {
  [HttpStatus.BAD_REQUEST]: ErrorCode.BAD_REQUEST,
  [HttpStatus.UNAUTHORIZED]: ErrorCode.UNAUTHENTICATED,
  [HttpStatus.FORBIDDEN]: ErrorCode.FORBIDDEN,
  [HttpStatus.NOT_FOUND]: ErrorCode.NOT_FOUND,
  [HttpStatus.CONFLICT]: ErrorCode.CONFLICT,
  [HttpStatus.UNPROCESSABLE_ENTITY]: ErrorCode.UNPROCESSABLE,
  [HttpStatus.TOO_MANY_REQUESTS]: ErrorCode.RATE_LIMITED,
};

const GENERIC_500 = 'Something went wrong. Please try again.';

/**
 * Catches everything and answers in the SRS error shape:
 * { success: false, error: { code, message } }.
 * Unknown errors are logged with the request id and never leak details to the client.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const res = http.getResponse<Response>();
    const req = http.getRequest<Request>();
    if (res.headersSent) return;

    const { status, error } = this.translate(exception);

    if (status >= 500) {
      const requestId = String(res.getHeader('x-request-id'));
      this.logger.error(
        `[${requestId}] ${req.method} ${req.path} -> ${status} ${error.code}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    const body: ApiFailure = { success: false, error };
    res.status(status).json(body);
  }

  private translate(exception: unknown): { status: number; error: ErrorBody } {
    if (exception instanceof DomainException) {
      return {
        status: exception.getStatus(),
        error: {
          code: exception.code,
          message: exception.message,
          details: exception.details,
        },
      };
    }

    if (exception instanceof HttpException) {
      return this.fromHttpException(exception);
    }

    const mapped = mapDatabaseMessage(this.textOf(exception));
    if (mapped) {
      return {
        status: mapped.status,
        error: { code: mapped.code, message: mapped.message },
      };
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      switch (exception.code) {
        case 'P2002':
          return {
            status: HttpStatus.CONFLICT,
            error: {
              code: ErrorCode.CONFLICT,
              message: 'A record with these values already exists.',
            },
          };
        case 'P2025':
          return {
            status: HttpStatus.NOT_FOUND,
            error: {
              code: ErrorCode.NOT_FOUND,
              message: 'The record was not found.',
            },
          };
        case 'P2003':
          return {
            status: HttpStatus.CONFLICT,
            error: {
              code: ErrorCode.CONFLICT,
              message:
                'The record refers to something that does not exist, or is still in use.',
            },
          };
      }
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      error: { code: ErrorCode.INTERNAL_ERROR, message: GENERIC_500 },
    };
  }

  private fromHttpException(exception: HttpException): {
    status: number;
    error: ErrorBody;
  } {
    const status = exception.getStatus();
    const response = exception.getResponse();
    const raw =
      typeof response === 'string'
        ? response
        : (response as { message?: unknown }).message;

    // class-validator failures arrive as a 400 with an array of messages.
    if (status === HttpStatus.BAD_REQUEST && Array.isArray(raw)) {
      return {
        status,
        error: {
          code: ErrorCode.VALIDATION_FAILED,
          message: 'Validation failed.',
          details: raw,
        },
      };
    }

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      return {
        status,
        error: { code: ErrorCode.INTERNAL_ERROR, message: GENERIC_500 },
      };
    }

    return {
      status,
      error: {
        code: STATUS_TO_CODE[status] ?? ErrorCode.BAD_REQUEST,
        message: typeof raw === 'string' ? raw : exception.message,
      },
    };
  }

  /** Message plus cause message, so a wrapped database error is still recognised. */
  private textOf(exception: unknown): string {
    if (!(exception instanceof Error)) return '';
    const cause =
      exception.cause instanceof Error ? exception.cause.message : '';
    return `${exception.message} ${cause}`;
  }
}
