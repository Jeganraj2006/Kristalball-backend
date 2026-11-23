import type { RequestHandler } from 'express';
import type { ZodType } from 'zod';

export function validate<T>(
  schema: ZodType<T>,
  source: 'body' | 'params' | 'query',
): RequestHandler {
  return (request, _response, next) => {
    const parsed = schema.parse(request[source]);
    Object.assign(request[source], parsed);
    next();
  };
}
