import { createHash, randomBytes } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { AppError } from '../errors/app-error.js';

export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
export const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

interface AccessTokenPayload {
  sub: string;
  org: string;
  sid: string;
  sv: number;
  typ: 'access';
}

export function createAccessToken(input: {
  userId: string;
  organizationId: string;
  sessionId: string;
  sessionVersion: number;
}): string {
  return jwt.sign(
    { org: input.organizationId, sid: input.sessionId, sv: input.sessionVersion, typ: 'access' },
    env.JWT_ACCESS_SECRET,
    {
      algorithm: 'HS256',
      subject: input.userId,
      expiresIn: ACCESS_TOKEN_TTL_SECONDS,
      issuer: 'kavach-api',
      audience: 'kavach-web',
    },
  );
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  try {
    const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET, {
      algorithms: ['HS256'],
      issuer: 'kavach-api',
      audience: 'kavach-web',
    });
    if (
      typeof decoded === 'string' ||
      decoded.typ !== 'access' ||
      typeof decoded.sub !== 'string' ||
      typeof decoded.org !== 'string' ||
      typeof decoded.sid !== 'string' ||
      typeof decoded.sv !== 'number'
    ) {
      throw new Error('Invalid access token claims.');
    }
    return { sub: decoded.sub, org: decoded.org, sid: decoded.sid, sv: decoded.sv, typ: 'access' };
  } catch {
    throw new AppError({
      statusCode: 401,
      code: 'AUTHENTICATION_REQUIRED',
      message: 'Authentication is required.',
    });
  }
}

export function createRefreshToken(): string {
  return randomBytes(48).toString('base64url');
}
export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
export function refreshTokenExpiry(): Date {
  return new Date(Date.now() + REFRESH_TOKEN_TTL_MS);
}
