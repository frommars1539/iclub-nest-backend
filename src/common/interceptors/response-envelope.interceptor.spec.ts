import { CallHandler, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { lastValueFrom, of } from 'rxjs';
import { ResponseMessage } from '../decorators/response-message.decorator';
import { ResponseEnvelopeInterceptor } from './response-envelope.interceptor';

class Sample {
  @ResponseMessage('Created')
  create() {
    return undefined;
  }

  plain() {
    return undefined;
  }
}

function contextFor(handler: () => unknown): ExecutionContext {
  return {
    getType: () => 'http',
    getHandler: () => handler,
    getClass: () => Sample,
  } as unknown as ExecutionContext;
}

const handlerReturning = (value: unknown): CallHandler => ({ handle: () => of(value) });

describe('ResponseEnvelopeInterceptor', () => {
  const interceptor = new ResponseEnvelopeInterceptor(new Reflector());

  it('wraps data with the default message', async () => {
    const out = await lastValueFrom(
      interceptor.intercept(contextFor(Sample.prototype.plain), handlerReturning({ id: 1 })),
    );
    expect(out).toEqual({ success: true, data: { id: 1 }, message: 'OK' });
  });

  it('uses the message from @ResponseMessage', async () => {
    const out = await lastValueFrom(
      interceptor.intercept(contextFor(Sample.prototype.create), handlerReturning({ id: 2 })),
    );
    expect(out).toEqual({ success: true, data: { id: 2 }, message: 'Created' });
  });

  it('turns an empty response into data: null', async () => {
    const out = await lastValueFrom(
      interceptor.intercept(contextFor(Sample.prototype.plain), handlerReturning(undefined)),
    );
    expect(out).toEqual({ success: true, data: null, message: 'OK' });
  });
});