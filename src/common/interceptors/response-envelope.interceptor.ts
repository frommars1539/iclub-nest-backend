import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { map, Observable } from 'rxjs';
import type { ApiSuccess } from '../api-response';
import { RESPONSE_MESSAGE_KEY } from '../decorators/response-message.decorator';

/** Wraps every successful response as { success: true, data, message } (SRS 5.3). */
@Injectable()
export class ResponseEnvelopeInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();

    const message =
      this.reflector.getAllAndOverride<string | undefined>(
        RESPONSE_MESSAGE_KEY,
        [context.getHandler(), context.getClass()],
      ) ?? 'OK';

    return next.handle().pipe(
      map((data: unknown): ApiSuccess<unknown> => ({
        success: true,
        data: data ?? null,
        message,
      })),
    );
  }
}
