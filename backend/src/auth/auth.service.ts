import type { Response } from 'express';
import { AppError } from '../errors/app-error.js';
import { resolvePermissions, type AuthenticatedPrincipal } from './authorization.js';
import type { AuthRepository, StoredIdentity } from './auth.types.js';
import { verifyPassword } from './password.service.js';
import {
  ACCESS_TOKEN_TTL_SECONDS,
  createAccessToken,
  createRefreshToken,
  hashRefreshToken,
  refreshTokenExpiry,
} from './token.service.js';

const refreshCookieName = 'kavach_refresh';
const genericAuthenticationError = () =>
  new AppError({
    statusCode: 401,
    code: 'INVALID_CREDENTIALS',
    message: 'Invalid email or password.',
  });

export class AuthService {
  public constructor(private readonly repository: AuthRepository) {}

  public async login(input: { email: string; password: string; correlationId: string }): Promise<{
    accessToken: string;
    expiresIn: number;
    refreshToken: string;
    principal: AuthenticatedPrincipal;
  }> {
    const identity = await this.repository.findIdentityByEmail(input.email.trim().toLowerCase());
    const passwordMatches = identity
      ? await verifyPassword(input.password, identity.passwordHash)
      : false;
    if (!identity || !passwordMatches || identity.status !== 'ACTIVE') {
      await this.repository.recordSecurityEvent({
        ...(identity ? { organizationId: identity.organizationId, actorId: identity.userId } : {}),
        action: 'AUTH_LOGIN',
        outcome: 'FAILURE',
        correlationId: input.correlationId,
      });
      throw genericAuthenticationError();
    }
    const refreshToken = createRefreshToken();
    const session = await this.repository.createRefreshSession({
      userId: identity.userId,
      tokenHash: hashRefreshToken(refreshToken),
      expiresAt: refreshTokenExpiry(),
    });
    const principal = this.toPrincipal(identity, session.id);
    await this.repository.recordSecurityEvent({
      organizationId: identity.organizationId,
      actorId: identity.userId,
      action: 'AUTH_LOGIN',
      outcome: 'SUCCESS',
      correlationId: input.correlationId,
    });
    return {
      accessToken: createAccessToken({
        userId: identity.userId,
        organizationId: identity.organizationId,
        sessionId: session.id,
        sessionVersion: identity.sessionVersion,
      }),
      expiresIn: ACCESS_TOKEN_TTL_SECONDS,
      refreshToken,
      principal,
    };
  }

  public async refresh(
    token: string,
    correlationId: string,
  ): Promise<{ accessToken: string; expiresIn: number; refreshToken: string }> {
    const session = await this.repository.findRefreshSessionByHash(hashRefreshToken(token));
    if (!session || session.revokedAt || session.expiresAt <= new Date())
      throw new AppError({
        statusCode: 401,
        code: 'INVALID_REFRESH_TOKEN',
        message: 'Refresh session is invalid.',
      });
    const identity = await this.repository.findIdentityById(session.userId);
    if (!identity || identity.status !== 'ACTIVE')
      throw new AppError({
        statusCode: 401,
        code: 'INVALID_REFRESH_TOKEN',
        message: 'Refresh session is invalid.',
      });
    const rotatedRefreshToken = createRefreshToken();
    const replacement = await this.repository.createRefreshSession({
      userId: identity.userId,
      tokenHash: hashRefreshToken(rotatedRefreshToken),
      expiresAt: refreshTokenExpiry(),
    });
    await this.repository.revokeRefreshSession(session.id, replacement.id);
    await this.repository.recordSecurityEvent({
      organizationId: identity.organizationId,
      actorId: identity.userId,
      action: 'AUTH_REFRESH',
      outcome: 'SUCCESS',
      correlationId,
    });
    return {
      accessToken: createAccessToken({
        userId: identity.userId,
        organizationId: identity.organizationId,
        sessionId: replacement.id,
        sessionVersion: identity.sessionVersion,
      }),
      expiresIn: ACCESS_TOKEN_TTL_SECONDS,
      refreshToken: rotatedRefreshToken,
    };
  }

  public async logout(principal: AuthenticatedPrincipal, correlationId: string): Promise<void> {
    await this.repository.revokeRefreshSession(principal.sessionId);
    await this.repository.recordSecurityEvent({
      organizationId: principal.scope.organizationId,
      actorId: principal.userId,
      action: 'AUTH_LOGOUT',
      outcome: 'SUCCESS',
      correlationId,
    });
  }

  public toPrincipal(identity: StoredIdentity, sessionId: string): AuthenticatedPrincipal {
    return {
      userId: identity.userId,
      sessionId,
      email: identity.email,
      roles: identity.roles,
      permissions: resolvePermissions(identity.roles),
      sessionVersion: identity.sessionVersion,
      scope: {
        organizationId: identity.organizationId,
        locationIds: new Set(identity.locationIds),
        organizationWide: identity.organizationWide,
      },
    };
  }
}

export function setRefreshCookie(response: Response, refreshToken: string): void {
  response.cookie(refreshCookieName, refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/api/v1/auth',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}
export function clearRefreshCookie(response: Response): void {
  response.clearCookie(refreshCookieName, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/api/v1/auth',
  });
}
export function getRefreshCookie(cookieHeader: string | undefined): string | undefined {
  return cookieHeader
    ?.split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${refreshCookieName}=`))
    ?.slice(`${refreshCookieName}=`.length);
}
