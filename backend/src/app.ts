import cors from 'cors';
import type { Express, Request, Response } from 'express';
import express from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { env } from './config/env.js';
import { PrismaAuthRepository } from './auth/prisma-auth.repository.js';
import { PrismaTransferRepository } from './transfers/prisma-transfer.repository.js';
import type { TransferRepository } from './transfers/transfer.types.js';
import { createTransferRouter } from './transfers/transfer.routes.js';
import { PrismaReconciliationRepository } from './reconciliation/prisma-reconciliation.repository.js';
import type { ReconciliationRepository } from './reconciliation/reconciliation.types.js';
import { createReconciliationRouter } from './reconciliation/reconciliation.routes.js';
import type { AuthRepository } from './auth/auth.types.js';
import { createAuthRouter } from './auth/auth.routes.js';
import { checkDatabaseConnection } from './lib/prisma.js';
import { logger } from './lib/logger.js';
import { errorHandler } from './middleware/error-handler.js';
import { notFoundHandler } from './middleware/not-found.js';
import { requestContext } from './middleware/request-context.js';
import { createHealthRouter } from './routes/health/health.routes.js';
import { HealthService, type DatabaseHealthCheck } from './routes/health/health.service.js';

export interface CreateAppOptions {
  databaseHealthCheck?: DatabaseHealthCheck;
  authRepository?: AuthRepository;
  transferRepository?: TransferRepository;
  reconciliationRepository?: ReconciliationRepository;
}

export function createApp(options: CreateAppOptions = {}): Express {
  const app = express();
  const healthService = new HealthService(
    options.databaseHealthCheck ?? { check: checkDatabaseConnection },
  );
  const authRepository = options.authRepository ?? new PrismaAuthRepository();
  const transferRepository = options.transferRepository ?? new PrismaTransferRepository();
  const reconciliationRepository =
    options.reconciliationRepository ?? new PrismaReconciliationRepository();

  app.disable('x-powered-by');
  app.use(requestContext);
  app.use(
    pinoHttp<Request, Response>({
      logger,
      customProps: (request) => ({ requestId: (request as Request).requestId }),
    }),
  );
  app.use(helmet());
  app.use(
    cors({
      origin: env.CORS_ORIGINS,
      credentials: true,
      methods: ['GET', 'HEAD', 'OPTIONS', 'POST', 'PATCH', 'PUT', 'DELETE'],
    }),
  );
  app.use(express.json({ limit: '100kb' }));

  app.use('/api/v1', createHealthRouter(healthService));
  app.use('/api/v1/auth', createAuthRouter(authRepository));
  app.use('/api/v1/inventory/transfers', createTransferRouter(authRepository, transferRepository));
  app.use(
    '/api/v1/reconciliations',
    createReconciliationRouter(authRepository, reconciliationRepository),
  );
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
