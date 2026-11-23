import { Router } from 'express';
import { z } from 'zod';
import { AppError } from '../errors/app-error.js';
import { validate } from '../middleware/validate.js';
import type { AuthRepository } from './auth.types.js';
import { createAuthenticate } from './auth.middleware.js';
import {
  AuthService,
  clearRefreshCookie,
  getRefreshCookie,
  setRefreshCookie,
} from './auth.service.js';
import type { AuthenticatedPrincipal } from './authorization.js';

const loginSchema = z
  .object({ email: z.string().email().max(320), password: z.string().min(12).max(128) })
  .strict();

export function createAuthRouter(repository: AuthRepository): Router {
  const router = Router();
  const service = new AuthService(repository);
  const authenticate = createAuthenticate(repository);

  router.post('/login', validate(loginSchema, 'body'), async (request, response, next) => {
    try {
      const result = await service.login({ ...request.body, correlationId: request.requestId });
      setRefreshCookie(response, result.refreshToken);
      response.status(200).json({
        accessToken: result.accessToken,
        expiresIn: result.expiresIn,
        user: serializePrincipal(result.principal),
      });
    } catch (error) {
      next(error);
    }
  });

  router.post('/refresh', async (request, response, next) => {
    try {
      const token = getRefreshCookie(request.header('cookie'));
      if (!token)
        throw new AppError({
          statusCode: 401,
          code: 'INVALID_REFRESH_TOKEN',
          message: 'Refresh session is invalid.',
        });
      const result = await service.refresh(token, request.requestId);
      setRefreshCookie(response, result.refreshToken);
      response.status(200).json({ accessToken: result.accessToken, expiresIn: result.expiresIn });
    } catch (error) {
      clearRefreshCookie(response);
      next(error);
    }
  });

  router.post('/logout', authenticate, async (request, response, next) => {
    try {
      await service.logout(request.auth, request.requestId);
      clearRefreshCookie(response);
      response.status(204).send();
    } catch (error) {
      next(error);
    }
  });
  router.get('/me', authenticate, (request, response) =>
    response.status(200).json({ user: serializePrincipal(request.auth) }),
  );
  return router;
}

function serializePrincipal(principal: AuthenticatedPrincipal) {
  return {
    id: principal.userId,
    email: principal.email,
    roles: principal.roles,
    permissions: [...principal.permissions],
    organizationId: principal.scope.organizationId,
    locationIds: [...principal.scope.locationIds],
    organizationWide: principal.scope.organizationWide,
  };
}
