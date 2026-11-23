import type {
  AuthRepository,
  RefreshSessionRecord,
  SecurityEventInput,
  StoredIdentity,
} from './auth.types.js';
import { isRole, type Role } from './authorization.js';
import { prisma } from '../lib/prisma.js';

export class PrismaAuthRepository implements AuthRepository {
  public async findIdentityByEmail(email: string): Promise<StoredIdentity | null> {
    const user = await prisma.user.findFirst({
      where: { email },
      include: {
        roles: { include: { role: true } },
        locationGrants: {
          where: {
            validFrom: { lte: new Date() },
            OR: [{ validUntil: null }, { validUntil: { gt: new Date() } }],
          },
        },
      },
    });
    return user ? await this.toIdentity(user) : null;
  }

  public async findIdentityById(userId: string): Promise<StoredIdentity | null> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        roles: { include: { role: true } },
        locationGrants: {
          where: {
            validFrom: { lte: new Date() },
            OR: [{ validUntil: null }, { validUntil: { gt: new Date() } }],
          },
        },
      },
    });
    return user ? await this.toIdentity(user) : null;
  }

  public async createRefreshSession(input: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<RefreshSessionRecord> {
    const session = await prisma.refreshSession.create({ data: input });
    return {
      id: session.id,
      userId: session.userId,
      tokenHash: session.tokenHash,
      expiresAt: session.expiresAt,
      revokedAt: session.revokedAt,
    };
  }

  public async findRefreshSessionByHash(tokenHash: string): Promise<RefreshSessionRecord | null> {
    const session = await prisma.refreshSession.findUnique({ where: { tokenHash } });
    return session
      ? {
          id: session.id,
          userId: session.userId,
          tokenHash: session.tokenHash,
          expiresAt: session.expiresAt,
          revokedAt: session.revokedAt,
        }
      : null;
  }

  public async findRefreshSessionById(sessionId: string): Promise<RefreshSessionRecord | null> {
    const session = await prisma.refreshSession.findUnique({ where: { id: sessionId } });
    return session
      ? {
          id: session.id,
          userId: session.userId,
          tokenHash: session.tokenHash,
          expiresAt: session.expiresAt,
          revokedAt: session.revokedAt,
        }
      : null;
  }

  public async revokeRefreshSession(sessionId: string, replacedBy?: string): Promise<void> {
    await prisma.refreshSession.update({
      where: { id: sessionId },
      data: { revokedAt: new Date(), ...(replacedBy ? { replacedBy } : {}) },
    });
  }

  public async recordSecurityEvent(event: SecurityEventInput): Promise<void> {
    await prisma.securityAuditEvent.create({
      data: {
        ...(event.organizationId ? { organizationId: event.organizationId } : {}),
        ...(event.actorId ? { actorId: event.actorId } : {}),
        action: event.action,
        outcome: event.outcome,
        correlationId: event.correlationId,
        ...(event.metadata ? { metadata: event.metadata } : {}),
      },
    });
  }

  private async toIdentity(user: {
    id: string;
    organizationId: string;
    email: string;
    passwordHash: string;
    status: 'ACTIVE' | 'SUSPENDED';
    sessionVersion: number;
    roles: { role: { code: string } }[];
    locationGrants: {
      locationId: string | null;
      scopeMode: 'LOCATION' | 'ORGANIZATION';
      inheritDescendants: boolean;
    }[];
  }): Promise<StoredIdentity> {
    const roles = user.roles.map((item) => item.role.code).filter(isRole) as Role[];
    const directLocations = user.locationGrants.flatMap((grant) =>
      grant.locationId ? [grant.locationId] : [],
    );
    const inheritedLocations = await Promise.all(
      user.locationGrants
        .filter((grant) => grant.inheritDescendants && grant.locationId)
        .map(
          async (grant) =>
            prisma.$queryRaw<
              { id: string }[]
            >`WITH RECURSIVE location_tree AS (SELECT id FROM locations WHERE id = ${grant.locationId!} UNION ALL SELECT child.id FROM locations child JOIN location_tree parent ON child.parent_id = parent.id) SELECT id FROM location_tree`,
        ),
    );
    return {
      userId: user.id,
      organizationId: user.organizationId,
      email: user.email,
      passwordHash: user.passwordHash,
      status: user.status,
      sessionVersion: user.sessionVersion,
      roles,
      locationIds: [
        ...new Set([
          ...directLocations,
          ...inheritedLocations.flat().map((location) => location.id),
        ]),
      ],
      organizationWide: user.locationGrants.some((grant) => grant.scopeMode === 'ORGANIZATION'),
    };
  }
}
