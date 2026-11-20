import {
  ArgumentsHost,
  BadRequestException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { Response } from 'express';
import { DomainException } from '../errors/domain.exception';
import { ErrorCode } from '../errors/error-codes';
import { AllExceptionsFilter } from './all-exceptions.filter';

function run(exception: unknown) {
  const res = {
    headersSent: false,
    getHeader: jest.fn().mockReturnValue('req-123'),
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
  };
  const host = {
    switchToHttp: () => ({
      getResponse: () => res as unknown as Response,
      getRequest: () => ({ method: 'GET', path: '/api/v1/test' }),
    }),
  } as unknown as ArgumentsHost;

  new AllExceptionsFilter().catch(exception, host);

  return {
    status: res.status.mock.calls[0]?.[0] as number,
    body: res.json.mock.calls[0]?.[0] as {
      success: boolean;
      error: { code: string; message: string; details?: unknown };
    },
  };
}

describe('AllExceptionsFilter', () => {
  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  it('answers a DomainException with its own code and a 409 by default', () => {
    const { status, body } = run(
      new DomainException(ErrorCode.POSITION_OCCUPIED, 'Already held.'),
    );
    expect(status).toBe(409);
    expect(body).toEqual({
      success: false,
      error: { code: 'POSITION_OCCUPIED', message: 'Already held.' },
    });
  });

  it('turns validation failures into VALIDATION_FAILED with details', () => {
    const { status, body } = run(new BadRequestException(['email must be an email']));
    expect(status).toBe(400);
    expect(body.error.code).toBe('VALIDATION_FAILED');
    expect(body.error.details).toEqual(['email must be an email']);
  });

  it('maps a not-found exception', () => {
    const { status, body } = run(new NotFoundException('No such member'));
    expect(status).toBe(404);
    expect(body.error).toEqual({ code: 'NOT_FOUND', message: 'No such member' });
  });

  it('recognises a database trigger message', () => {
    const { status, body } = run(new Error('financial year is closed'));
    expect(status).toBe(409);
    expect(body.error.code).toBe('YEAR_CLOSED');
  });

  it('hides unknown errors behind a generic 500', () => {
    const { status, body } = run(new Error('boom: secret detail'));
    expect(status).toBe(500);
    expect(body.error.code).toBe('INTERNAL_ERROR');
    expect(body.error.message).not.toContain('secret');
  });
});