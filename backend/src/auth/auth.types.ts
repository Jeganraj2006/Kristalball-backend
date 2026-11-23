import type { Role } from './authorization.js';

export interface StoredIdentity {
  userId: string;
  organizationId: string;
  email: string;
  passwordHash: string;
  status: 'ACTIVE' | 'SUSPENDED';
  sessionVersion: number;
  roles: Role[];
  locationIds: string[];
  organizationWide: boolean;
}

export interface RefreshSessionRecord {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
}

export interface SecurityEventInput {
  organizationId?: string;
  actorId?: string;
  action: string;
  outcome: 'SUCCESS' | 'DENIED' | 'FAILURE';
  correlationId: string;
  metadata?: Record<string, string | number | boolean>;
}

export interface AuthRepository {
  findIdentityByEmail(email: string): Promise<StoredIdentity | null>;
  findIdentityById(userId: string): Promise<StoredIdentity | null>;
  createRefreshSession(input: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<RefreshSessionRecord>;
  findRefreshSessionById(sessionId: string): Promise<RefreshSessionRecord | null>;
  findRefreshSessionByHash(tokenHash: string): Promise<RefreshSessionRecord | null>;
  revokeRefreshSession(sessionId: string, replacedBy?: string): Promise<void>;
  recordSecurityEvent(event: SecurityEventInput): Promise<void>;
}
