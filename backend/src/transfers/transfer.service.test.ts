import { describe, expect, it } from 'vitest';
import {
  resolvePermissions,
  type AuthenticatedPrincipal,
  type Role,
} from '../auth/authorization.js';
import { InMemoryTransferRepository } from './in-memory-transfer.repository.js';
import { requestHash, TransferService } from './transfer.service.js';
import type { CreateTransferInput, TransferCommand } from './transfer.types.js';

const organizationId = 'org-demo';
const sourceLocationId = 'loc-source';
const destinationLocationId = 'loc-destination';
const itemId = 'item-battery';
function principal(userId: string, roles: Role[]): AuthenticatedPrincipal {
  return {
    userId,
    sessionId: `${userId}-session`,
    email: `${userId}@example.test`,
    roles,
    permissions: resolvePermissions(roles),
    sessionVersion: 1,
    scope: {
      organizationId,
      locationIds: new Set([sourceLocationId, destinationLocationId]),
      organizationWide: false,
    },
  };
}
function command(actorId: string, idempotencyKey: string, reason?: string): TransferCommand {
  return {
    actorId,
    idempotencyKey,
    requestHash: requestHash({ idempotencyKey, reason }),
    ...(reason ? { reason } : {}),
  };
}
function creation(actorId: string, key = 'create-1', quantity = 10): CreateTransferInput {
  return {
    organizationId,
    sourceLocationId,
    destinationLocationId,
    requesterId: actorId,
    actorId,
    idempotencyKey: key,
    requestHash: requestHash({ key, quantity }),
    lines: [{ catalogItemId: itemId, quantity }],
  };
}

describe('controlled transfer workflow', () => {
  it('completes a valid transfer and posts stock only at dispatch and receipt', async () => {
    const repository = new InMemoryTransferRepository();
    repository.setBalance(organizationId, sourceLocationId, itemId, 100);
    const service = new TransferService(repository);
    const logistics = principal('logistics', ['LOGISTICS_OFFICER']);
    const commander = principal('commander', ['BASE_COMMANDER']);
    const draft = await service.create(logistics, creation(logistics.userId));
    expect(draft.status).toBe('DRAFT');
    expect(repository.balance(organizationId, sourceLocationId, itemId).onHand).toBe(100);
    const submitted = await service.submit(
      logistics,
      draft.id,
      command(logistics.userId, 'submit-1'),
    );
    expect(submitted.status).toBe('SUBMITTED');
    expect(repository.balance(organizationId, sourceLocationId, itemId).onHand).toBe(100);
    await service.approve(commander, draft.id, command(commander.userId, 'approve-1'));
    const dispatched = await service.dispatch(
      logistics,
      draft.id,
      command(logistics.userId, 'dispatch-1'),
    );
    expect(dispatched.status).toBe('DISPATCHED');
    expect(repository.balance(organizationId, sourceLocationId, itemId).onHand).toBe(90);
    expect(repository.balance(organizationId, destinationLocationId, itemId).onHand).toBe(0);
    const received = await service.receive(
      logistics,
      draft.id,
      command(logistics.userId, 'receive-1'),
      [{ transferLineId: dispatched.lines[0]!.id, receivedQuantity: 10 }],
    );
    expect(received.status).toBe('RECEIVED');
    expect(repository.balance(organizationId, destinationLocationId, itemId).onHand).toBe(10);
    expect(received.events.map((event) => event.type)).toEqual([
      'CREATED',
      'SUBMITTED',
      'APPROVED',
      'DISPATCHED',
      'RECEIVED',
      'COMPLETED',
    ]);
  });

  it('rejects invalid state transitions and direct dispatch from draft', async () => {
    const repository = new InMemoryTransferRepository();
    repository.setBalance(organizationId, sourceLocationId, itemId, 20);
    const service = new TransferService(repository);
    const logistics = principal('logistics', ['LOGISTICS_OFFICER']);
    const draft = await service.create(logistics, creation(logistics.userId));
    await expect(
      service.dispatch(logistics, draft.id, command(logistics.userId, 'dispatch-draft')),
    ).rejects.toMatchObject({ code: 'INVALID_TRANSFER_STATE' });
    expect(repository.balance(organizationId, sourceLocationId, itemId).onHand).toBe(20);
  });

  it('returns the original request for an idempotent create and rejects a changed duplicate', async () => {
    const repository = new InMemoryTransferRepository();
    const service = new TransferService(repository);
    const logistics = principal('logistics', ['LOGISTICS_OFFICER']);
    const first = await service.create(logistics, creation(logistics.userId, 'same-key'));
    const same = await service.create(logistics, creation(logistics.userId, 'same-key'));
    expect(same.id).toBe(first.id);
    await expect(
      service.create(logistics, {
        ...creation(logistics.userId, 'same-key', 11),
        requestHash: requestHash({ changed: true }),
      }),
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_KEY_REUSED' });
  });

  it('does not dispatch when available inventory is insufficient', async () => {
    const repository = new InMemoryTransferRepository();
    repository.setBalance(organizationId, sourceLocationId, itemId, 10, 4);
    const service = new TransferService(repository);
    const logistics = principal('logistics', ['LOGISTICS_OFFICER']);
    const commander = principal('commander', ['BASE_COMMANDER']);
    const draft = await service.create(logistics, creation(logistics.userId, 'insufficient', 7));
    await service.submit(logistics, draft.id, command(logistics.userId, 'submit-insufficient'));
    await service.approve(commander, draft.id, command(commander.userId, 'approve-insufficient'));
    await expect(
      service.dispatch(logistics, draft.id, command(logistics.userId, 'dispatch-insufficient')),
    ).rejects.toMatchObject({ code: 'INSUFFICIENT_INVENTORY' });
    expect(repository.balance(organizationId, sourceLocationId, itemId).onHand).toBe(10);
    expect((await service.get(logistics, draft.id)).status).toBe('APPROVED');
  });

  it('does not mutate stock for rejected transfers and rejects self approval', async () => {
    const repository = new InMemoryTransferRepository();
    repository.setBalance(organizationId, sourceLocationId, itemId, 30);
    const service = new TransferService(repository);
    const commander = principal('commander', ['BASE_COMMANDER']);
    const draft = await service.create(commander, creation(commander.userId, 'reject'));
    await service.submit(commander, draft.id, command(commander.userId, 'submit-reject'));
    await expect(
      service.approve(commander, draft.id, command(commander.userId, 'self-approve')),
    ).rejects.toMatchObject({ code: 'SELF_APPROVAL_FORBIDDEN' });
    const rejected = await service.reject(
      principal('approver', ['BASE_COMMANDER']),
      draft.id,
      command('approver', 'reject-1', 'Incorrect destination'),
    );
    expect(rejected.status).toBe('REJECTED');
    expect(repository.balance(organizationId, sourceLocationId, itemId).onHand).toBe(30);
  });

  it('records incomplete receipts as a discrepancy without inventing missing stock', async () => {
    const repository = new InMemoryTransferRepository();
    repository.setBalance(organizationId, sourceLocationId, itemId, 30);
    const service = new TransferService(repository);
    const logistics = principal('logistics', ['LOGISTICS_OFFICER']);
    const commander = principal('commander', ['BASE_COMMANDER']);
    const draft = await service.create(logistics, creation(logistics.userId, 'short', 10));
    await service.submit(logistics, draft.id, command(logistics.userId, 'submit-short'));
    await service.approve(commander, draft.id, command(commander.userId, 'approve-short'));
    const dispatched = await service.dispatch(
      logistics,
      draft.id,
      command(logistics.userId, 'dispatch-short'),
    );
    const result = await service.receive(
      logistics,
      draft.id,
      command(logistics.userId, 'receive-short'),
      [{ transferLineId: dispatched.lines[0]!.id, receivedQuantity: 8 }],
    );
    expect(result.status).toBe('DISCREPANCY');
    expect(repository.balance(organizationId, destinationLocationId, itemId).onHand).toBe(8);
    expect(result.events.at(-1)?.type).toBe('DISCREPANCY_RECORDED');
  });

  it('serializes concurrent submissions so exactly one state transition posts', async () => {
    const repository = new InMemoryTransferRepository();
    const service = new TransferService(repository);
    const logistics = principal('logistics', ['LOGISTICS_OFFICER']);
    const draft = await service.create(logistics, creation(logistics.userId, 'concurrent'));
    const settled = await Promise.allSettled([
      service.submit(logistics, draft.id, command(logistics.userId, 'submit-a')),
      service.submit(logistics, draft.id, command(logistics.userId, 'submit-b')),
    ]);
    expect(settled.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(settled.filter((result) => result.status === 'rejected')).toHaveLength(1);
    expect(
      (await service.get(logistics, draft.id)).events.filter((event) => event.type === 'SUBMITTED'),
    ).toHaveLength(1);
  });
});
