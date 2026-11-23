import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

/** Only accept a client-supplied id if it is short and made of safe characters. */
const SAFE_ID = /^[A-Za-z0-9._-]{8,64}$/;

/** Gives every request an id, echoed in the `x-request-id` response header. */
export function requestId(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const incoming = req.header('x-request-id');
  const id = incoming && SAFE_ID.test(incoming) ? incoming : randomUUID();
  res.setHeader('x-request-id', id);
  res.locals['requestId'] = id;
  next();
}
