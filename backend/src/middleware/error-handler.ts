import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../errors/app-error.js';

export const errorHandler: ErrorRequestHandler = (error, request, response, _next) => {
  if (error instanceof AppError) {
    response.status(error.statusCode).json({
      error: {
        code: error.code,
        message: error.message,
        ...(error.details ? { details: error.details } : {}),
        correlationId: request.requestId,
      },
    });
    return;
  }

  if (error instanceof ZodError) {
    response.status(422).json({
      error: {
        code: 'VALIDATION_FAILED',
        message: 'Request validation failed.',
        details: { issues: error.flatten() },
        correlationId: request.requestId,
      },
    });
    return;
  }

  request.log.error({ err: error, requestId: request.requestId }, 'Unhandled request error');
  response.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred.',
      correlationId: request.requestId,
    },
  });
};
