import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import { createAuthenticate } from '../auth/auth.middleware.js';
import type { AuthRepository } from '../auth/auth.types.js';
import { AppError } from '../errors/app-error.js';
import { validate } from '../middleware/validate.js';
import { requestHash, TransferService } from './transfer.service.js';
import type { TransferRepository } from './transfer.types.js';

const idSchema = z.object({ transferId: z.string().uuid() }).strict();
const createSchema = z
  .object({
    sourceLocationId: z.string().uuid(),
    destinationLocationId: z.string().uuid(),
    lines: z
      .array(
        z
          .object({ catalogItemId: z.string().uuid(), quantity: z.number().int().positive() })
          .strict(),
      )
      .min(1)
      .max(100),
  })
  .strict();
const commandSchema = z.object({ reason: z.string().trim().min(2).max(1000).optional() }).strict();
const receiveSchema = commandSchema
  .extend({
    lines: z
      .array(
        z
          .object({ transferLineId: z.string().uuid(), receivedQuantity: z.number().int().min(0) })
          .strict(),
      )
      .min(1)
      .max(100),
  })
  .strict();

export function createTransferRouter(
  authRepository: AuthRepository,
  transferRepository: TransferRepository,
): Router {
  const router = Router();
  const authenticate = createAuthenticate(authRepository);
  const service = new TransferService(transferRepository);
  router.use(authenticate);
  router.post('/', validate(createSchema, 'body'), async (request, response, next) => {
    try {
      const result = await service.create(request.auth, {
        ...request.body,
        idempotencyKey: idempotencyKey(request),
        requestHash: requestHash({ action: 'CREATE', body: request.body }),
      });
      response.status(201).json({ transfer: result });
    } catch (error) {
      next(error);
    }
  });
  router.get('/:transferId', validate(idSchema, 'params'), async (request, response, next) => {
    try {
      response.status(200).json({ transfer: await service.get(request.auth, transferId(request)) });
    } catch (error) {
      next(error);
    }
  });
  router.get(
    '/:transferId/events',
    validate(idSchema, 'params'),
    async (request, response, next) => {
      try {
        const transfer = await service.get(request.auth, transferId(request));
        response.status(200).json({ events: transfer.events });
      } catch (error) {
        next(error);
      }
    },
  );
  router.post(
    '/:transferId/submit',
    validate(idSchema, 'params'),
    validate(commandSchema, 'body'),
    transition('submit'),
  );
  router.post(
    '/:transferId/approve',
    validate(idSchema, 'params'),
    validate(commandSchema, 'body'),
    transition('approve'),
  );
  router.post(
    '/:transferId/reject',
    validate(idSchema, 'params'),
    validate(commandSchema, 'body'),
    transition('reject'),
  );
  router.post(
    '/:transferId/dispatch',
    validate(idSchema, 'params'),
    validate(commandSchema, 'body'),
    transition('dispatch'),
  );
  router.post(
    '/:transferId/cancel',
    validate(idSchema, 'params'),
    validate(commandSchema, 'body'),
    transition('cancel'),
  );
  router.post(
    '/:transferId/receive',
    validate(idSchema, 'params'),
    validate(receiveSchema, 'body'),
    async (request, response, next) => {
      try {
        const command = commandInput(request, 'RECEIVE');
        response.status(200).json({
          transfer: await service.receive(
            request.auth,
            transferId(request),
            command,
            request.body.lines,
          ),
        });
      } catch (error) {
        next(error);
      }
    },
  );
  return router;

  function transition(action: 'submit' | 'approve' | 'reject' | 'dispatch' | 'cancel') {
    return async (request: Request, response: Response, next: NextFunction) => {
      try {
        const command = commandInput(request, action.toUpperCase());
        response
          .status(200)
          .json({ transfer: await service[action](request.auth, transferId(request), command) });
      } catch (error) {
        next(error);
      }
    };
  }
}

function idempotencyKey(request: Request): string {
  const key = request.header('idempotency-key');
  if (!key || key.length > 200)
    throw new AppError({
      statusCode: 400,
      code: 'IDEMPOTENCY_KEY_REQUIRED',
      message: 'An Idempotency-Key header is required.',
    });
  return key;
}
function commandInput(request: Request, action: string) {
  return {
    actorId: request.auth.userId,
    idempotencyKey: idempotencyKey(request),
    requestHash: requestHash({ action, body: request.body }),
    ...(typeof request.body.reason === 'string' ? { reason: request.body.reason } : {}),
  };
}
function transferId(request: Request): string {
  return String(request.params.transferId);
}
