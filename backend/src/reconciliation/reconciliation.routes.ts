import { Router, type Request } from 'express';
import { z } from 'zod';
import { createAuthenticate } from '../auth/auth.middleware.js';
import type { AuthRepository } from '../auth/auth.types.js';
import { AppError } from '../errors/app-error.js';
import { validate } from '../middleware/validate.js';
import { reconciliationHash, ReconciliationService } from './reconciliation.service.js';
import type { ReconciliationRepository } from './reconciliation.types.js';
const id = z.object({ stocktakeId: z.string().uuid() }).strict();
const create = z
  .object({
    locationId: z.string().uuid(),
    catalogItemIds: z.array(z.string().uuid()).min(1).max(500),
  })
  .strict();
const count = z
  .object({
    lines: z
      .array(
        z
          .object({
            lineId: z.string().uuid(),
            actualQuantity: z.number().int().min(0),
            category: z.string().trim().max(100).optional(),
            notes: z.string().trim().max(1000).optional(),
          })
          .strict(),
      )
      .min(1)
      .max(500),
  })
  .strict();
const reason = z.object({ reason: z.string().trim().min(2).max(1000).optional() }).strict();
export function createReconciliationRouter(
  auth: AuthRepository,
  repository: ReconciliationRepository,
): Router {
  const router = Router();
  const service = new ReconciliationService(repository);
  router.use(createAuthenticate(auth));
  const command = (request: Request) => ({
    actorId: request.auth.userId,
    key: key(request),
    hash: reconciliationHash(request.body),
    ...(request.body.reason ? { reason: request.body.reason } : {}),
  });
  router.post('/', validate(create, 'body'), async (req, res, next) => {
    try {
      res.status(201).json({
        stocktake: await service.create(
          req.auth,
          req.body.locationId,
          req.body.catalogItemIds,
          command(req),
        ),
      });
    } catch (error) {
      next(error);
    }
  });
  router.get('/:stocktakeId', validate(id, 'params'), async (req, res, next) => {
    try {
      res.json({ stocktake: await service.get(req.auth, String(req.params.stocktakeId)) });
    } catch (error) {
      next(error);
    }
  });
  router.get('/:stocktakeId/report', validate(id, 'params'), async (req, res, next) => {
    try {
      res.json({ report: await service.report(req.auth, String(req.params.stocktakeId)) });
    } catch (error) {
      next(error);
    }
  });
  router.post(
    '/:stocktakeId/counts',
    validate(id, 'params'),
    validate(count, 'body'),
    async (req, res, next) => {
      try {
        res.json({
          stocktake: await service.count(req.auth, String(req.params.stocktakeId), {
            ...command(req),
            lines: req.body.lines,
          }),
        });
      } catch (error) {
        next(error);
      }
    },
  );
  for (const action of ['submit', 'approve', 'reject', 'post'] as const)
    router.post(
      `/:stocktakeId/${action}`,
      validate(id, 'params'),
      validate(reason, 'body'),
      async (req, res, next) => {
        try {
          res.json({
            stocktake: await service[action](
              req.auth,
              String(req.params.stocktakeId),
              command(req),
            ),
          });
        } catch (error) {
          next(error);
        }
      },
    );
  return router;
}
function key(request: { header(name: string): string | undefined }): string {
  const value = request.header('idempotency-key');
  if (!value)
    throw new AppError({
      statusCode: 400,
      code: 'IDEMPOTENCY_KEY_REQUIRED',
      message: 'An Idempotency-Key header is required.',
    });
  return value;
}
