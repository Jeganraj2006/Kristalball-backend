import type { RequestHandler } from 'express';
import type { HealthService } from './health.service.js';

export function createHealthController(healthService: HealthService): {
  liveness: RequestHandler;
  readiness: RequestHandler;
} {
  return {
    liveness: (_request, response) => {
      response.status(200).json(healthService.getLiveness());
    },
    readiness: async (request, response) => {
      const readiness = await healthService.getReadiness();

      if (readiness.status === 'error') {
        request.log.warn({ requestId: request.requestId }, 'Database readiness check failed');
        response.status(503).json(readiness);
        return;
      }

      response.status(200).json(readiness);
    },
  };
}
