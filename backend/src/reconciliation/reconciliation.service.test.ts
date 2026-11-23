import { describe, expect, it } from 'vitest';
import {
  resolvePermissions,
  type AuthenticatedPrincipal,
  type Role,
} from '../auth/authorization.js';
import { InMemoryReconciliationRepository } from './in-memory-reconciliation.repository.js';
import { reconciliationHash, ReconciliationService } from './reconciliation.service.js';
const org = 'org';
const location = 'location';
const item = 'item';
function user(id: string, roles: Role[]): AuthenticatedPrincipal {
  return {
    userId: id,
    sessionId: id,
    email: `${id}@test`,
    roles,
    permissions: resolvePermissions(roles),
    sessionVersion: 1,
    scope: { organizationId: org, locationIds: new Set([location]), organizationWide: false },
  };
}
function command(actorId: string, key: string) {
  return { actorId, key, hash: reconciliationHash(key) };
}
describe('physical reconciliation', () => {
  it('preserves expected snapshot, distinguishes zero from uncounted, and posts only approved variance', async () => {
    const repo = new InMemoryReconciliationRepository();
    repo.setBalance(org, location, item, 10);
    const service = new ReconciliationService(repo);
    const counter = user('counter', ['INVENTORY_OFFICER']);
    const approver = user('approver', ['BASE_COMMANDER']);
    const stocktake = await service.create(
      counter,
      location,
      [item],
      command(counter.userId, 'create'),
    );
    repo.setBalance(org, location, item, 18);
    expect(stocktake.lines[0]?.expectedQuantity).toBe(10);
    const counted = await service.count(counter, stocktake.id, {
      ...command(counter.userId, 'count'),
      lines: [{ lineId: stocktake.lines[0]!.id, actualQuantity: 0 }],
    });
    expect(counted.lines[0]?.actualQuantity).toBe(0);
    expect(counted.lines[0]?.variance).toBe(-10);
    expect(repo.balance(org, location, item)).toBe(18);
    await service.submit(counter, stocktake.id, command(counter.userId, 'submit'));
    await service.approve(approver, stocktake.id, command(approver.userId, 'approve'));
    await service.post(approver, stocktake.id, command(approver.userId, 'post'));
    expect(repo.balance(org, location, item)).toBe(0);
    expect(repo.ledger[0]?.delta).toBe(-10);
  });
  it('rejects self approval and invalid transitions', async () => {
    const repo = new InMemoryReconciliationRepository();
    const service = new ReconciliationService(repo);
    const counter = user('counter', ['BASE_COMMANDER']);
    const stocktake = await service.create(
      counter,
      location,
      [item],
      command(counter.userId, 'create'),
    );
    await expect(
      service.approve(counter, stocktake.id, command(counter.userId, 'approve')),
    ).rejects.toMatchObject({ code: 'SELF_APPROVAL_FORBIDDEN' });
    await expect(
      service.submit(counter, stocktake.id, command(counter.userId, 'submit')),
    ).rejects.toMatchObject({ code: 'INVALID_STOCKTAKE' });
  });
  it('computes reconciliation rate from counted records only', async () => {
    const repo = new InMemoryReconciliationRepository();
    repo.setBalance(org, location, item, 5);
    const service = new ReconciliationService(repo);
    const counter = user('counter', ['INVENTORY_OFFICER']);
    const stocktake = await service.create(
      counter,
      location,
      [item],
      command(counter.userId, 'create'),
    );
    const result = await service.count(counter, stocktake.id, {
      ...command(counter.userId, 'count'),
      lines: [{ lineId: stocktake.lines[0]!.id, actualQuantity: 5 }],
    });
    const counted = result.lines.filter((line) => line.actualQuantity !== null);
    expect((counted.filter((line) => line.variance === 0).length / counted.length) * 100).toBe(100);
  });
});
