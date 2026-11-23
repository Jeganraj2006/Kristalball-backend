import type { RequestHandler } from 'express';
import { AppError } from '../errors/app-error.js';
import type { AuthRepository } from './auth.types.js';
import { AuthService } from './auth.service.js';
import { verifyAccessToken } from './token.service.js';

export function createAuthenticate(repository: AuthRepository): RequestHandler {
  const authService = new AuthService(repository);
  return async (request, _response, next) => {
    try {
      const header = request.header('authorization');
      if (!header?.startsWith('Bearer '))
        throw new AppError({
          statusCode: 401,
          code: 'AUTHENTICATION_REQUIRED',
          message: 'Authentication is required.',
        });
      const token = verifyAccessToken(header.slice('Bearer '.length));
      const identity = await repository.findIdentityById(token.sub);
      const session = await repository.findRefreshSessionById(token.sid);
      if (
        !identity ||
        !session ||
        session.userId !== identity.userId ||
        session.revokedAt ||
        session.expiresAt <= new Date() ||
        identity.status !== 'ACTIVE' ||
        identity.organizationId !== token.org ||
        identity.sessionVersion !== token.sv
      ) {
        throw new AppError({
          statusCode: 401,
          code: 'AUTHENTICATION_REQUIRED',
          message: 'Authentication is required.',
        });
      }
      request.auth = authService.toPrincipal(identity, token.sid);
      next();
    } catch (error) {
      next(error);
    }
  };
}
