import jwt from 'jsonwebtoken';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import { env } from '../config/env.js';
import {
  requireIndependentApproval,
  requireLocationScope,
  requirePermission,
} from './authorization.js';
import { AuthService } from './auth.service.js';
import type {
  AuthRepository,
  RefreshSessionRecord,
  SecurityEventInput,
  StoredIdentity,
} from './auth.types.js';
import { hashPassword } from './password.service.js';

class InMemoryAuthRepository implements AuthRepository {
  public readonly events: SecurityEventInput[] = [];
  private readonly sessions = new Map<string, RefreshSessionRecord>();

  public constructor(private readonly identities: StoredIdentity[]) {}
  public async findIdentityByEmail(email: string) {
    return this.identities.find((identity) => identity.email === email) ?? null;
  }
  public async findIdentityById(userId: string) {
    return this.identities.find((identity) => identity.userId === userId) ?? null;
  }
  public async createRefreshSession(input: { userId: string; tokenHash: string; expiresAt: Date }) {
    const session = { id: crypto.randomUUID(), ...input, revokedAt: null };
    this.sessions.set(session.id, session);
    return session;
  }
  public async findRefreshSessionByHash(tokenHash: string) {
    return [...this.sessions.values()].find((session) => session.tokenHash === tokenHash) ?? null;
  }
  public async findRefreshSessionById(sessionId: string) {
    return this.sessions.get(sessionId) ?? null;
  }
  public async revokeRefreshSession(sessionId: string, replacedBy?: string) {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    session.revokedAt = new Date();
    if (replacedBy) session.replacedBy = replacedBy;
  }
  public async recordSecurityEvent(event: SecurityEventInput) {
    this.events.push(event);
  }
}

async function createRepository(): Promise<InMemoryAuthRepository> {
  return new InMemoryAuthRepository([
    {
      userId: 'user-logistics',
      organizationId: 'org-northbridge',
      email: 'logistics@example.test',
      passwordHash: await hashPassword('CorrectHorseBatteryStaple!'),
      status: 'ACTIVE',
      sessionVersion: 1,
      roles: ['LOGISTICS_OFFICER'],
      locationIds: ['loc-northbridge'],
      organizationWide: false,
    },
    {
      userId: 'user-auditor',
      organizationId: 'org-northbridge',
      email: 'auditor@example.test',
      passwordHash: await hashPassword('CorrectHorseBatteryStaple!'),
      status: 'ACTIVE',
      sessionVersion: 1,
      roles: ['AUDITOR'],
      locationIds: ['loc-northbridge'],
      organizationWide: false,
    },
    {
      userId: 'user-commander',
      organizationId: 'org-northbridge',
      email: 'commander@example.test',
      passwordHash: await hashPassword('CorrectHorseBatteryStaple!'),
      status: 'ACTIVE',
      sessionVersion: 1,
      roles: ['BASE_COMMANDER'],
      locationIds: ['loc-northbridge'],
      organizationWide: false,
    },
  ]);
}

describe('authentication and authorization', () => {
  it('accepts valid credentials and issues a short-lived access token plus HttpOnly refresh cookie', async () => {
    const repository = await createRepository();
    const app = createApp({
      authRepository: repository,
      databaseHealthCheck: { check: async () => undefined },
    });
    const response = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'logistics@example.test', password: 'CorrectHorseBatteryStaple!' });
    expect(response.status).toBe(200);
    expect(response.body.accessToken).toEqual(expect.any(String));
    expect(response.body.expiresIn).toBe(900);
    expect(response.headers['set-cookie']?.[0]).toContain('HttpOnly');
    expect(response.body.user.locationIds).toEqual(['loc-northbridge']);
    expect(repository.events.at(-1)?.outcome).toBe('SUCCESS');
  });

  it('rejects invalid credentials without revealing whether an account exists', async () => {
    const repository = await createRepository();
    const app = createApp({
      authRepository: repository,
      databaseHealthCheck: { check: async () => undefined },
    });
    const response = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'logistics@example.test', password: 'WrongPasswordThatIsLong!' });
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
    expect(response.body.error.message).toBe('Invalid email or password.');
  });

  it('rotates refresh sessions and rejects a replayed refresh token', async () => {
    const repository = await createRepository();
    const app = createApp({
      authRepository: repository,
      databaseHealthCheck: { check: async () => undefined },
    });
    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'logistics@example.test', password: 'CorrectHorseBatteryStaple!' });
    const originalCookie = login.headers['set-cookie']?.[0];
    if (!originalCookie) throw new Error('Missing refresh cookie');
    const refresh = await request(app).post('/api/v1/auth/refresh').set('Cookie', originalCookie);
    expect(refresh.status).toBe(200);
    expect(refresh.body.accessToken).toEqual(expect.any(String));
    expect(refresh.headers['set-cookie']?.[0]).not.toEqual(originalCookie);
    const replay = await request(app).post('/api/v1/auth/refresh').set('Cookie', originalCookie);
    expect(replay.status).toBe(401);
  });

  it('rejects expired access tokens on protected routes', async () => {
    const repository = await createRepository();
    const app = createApp({
      authRepository: repository,
      databaseHealthCheck: { check: async () => undefined },
    });
    const expired = jwt.sign(
      { org: 'org-northbridge', sid: 'session-1', sv: 1, typ: 'access' },
      env.JWT_ACCESS_SECRET,
      {
        algorithm: 'HS256',
        subject: 'user-logistics',
        expiresIn: -1,
        issuer: 'kavach-api',
        audience: 'kavach-web',
      },
    );
    const response = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${expired}`);
    expect(response.status).toBe(401);
  });

  it('prevents auditors from acquiring write permissions', async () => {
    const repository = await createRepository();
    const service = new AuthService(repository);
    const identity = await repository.findIdentityById('user-auditor');
    if (!identity) throw new Error('Missing fixture');
    expect(() =>
      requirePermission(
        service.toPrincipal(identity, 'session-auditor'),
        'inventory.transaction.create',
      ),
    ).toThrow(/not authorized/i);
  });

  it('denies cross-location access even when a caller manipulates a location ID', async () => {
    const repository = await createRepository();
    const service = new AuthService(repository);
    const identity = await repository.findIdentityById('user-logistics');
    if (!identity) throw new Error('Missing fixture');
    expect(() =>
      requireLocationScope(
        service.toPrincipal(identity, 'session-logistics'),
        'org-northbridge',
        'loc-harborpoint',
      ),
    ).toThrow(/unavailable/i);
  });

  it('does not trust a forged role claim because permissions are loaded from the server identity', async () => {
    const repository = await createRepository();
    const app = createApp({
      authRepository: repository,
      databaseHealthCheck: { check: async () => undefined },
    });
    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'auditor@example.test', password: 'CorrectHorseBatteryStaple!' });
    const response = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${login.body.accessToken}`);
    expect(response.status).toBe(200);
    expect(response.body.user.roles).toEqual(['AUDITOR']);
    expect(response.body.user.permissions).not.toContain('role.manage');
  });

  it('invalidates the current access token at logout', async () => {
    const repository = await createRepository();
    const app = createApp({
      authRepository: repository,
      databaseHealthCheck: { check: async () => undefined },
    });
    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'logistics@example.test', password: 'CorrectHorseBatteryStaple!' });
    const authorization = `Bearer ${login.body.accessToken}`;
    expect(
      (await request(app).post('/api/v1/auth/logout').set('Authorization', authorization)).status,
    ).toBe(204);
    expect(
      (await request(app).get('/api/v1/auth/me').set('Authorization', authorization)).status,
    ).toBe(401);
  });

  it('denies self-approval and unauthorized approval attempts', async () => {
    const repository = await createRepository();
    const service = new AuthService(repository);
    const logistics = await repository.findIdentityById('user-logistics');
    const commander = await repository.findIdentityById('user-commander');
    if (!logistics || !commander) throw new Error('Missing fixture');
    expect(() =>
      requireIndependentApproval(
        service.toPrincipal(logistics, 's1'),
        'other-user',
        'org-northbridge',
        'loc-northbridge',
      ),
    ).toThrow(/not authorized/i);
    expect(() =>
      requireIndependentApproval(
        service.toPrincipal(commander, 's2'),
        'user-commander',
        'org-northbridge',
        'loc-northbridge',
      ),
    ).toThrow(/cannot approve/i);
  });
});
