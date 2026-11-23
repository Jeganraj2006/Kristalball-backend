import { AppError } from '../errors/app-error.js';

export const roles = [
  'SUPER_ADMIN',
  'ORGANIZATION_ADMIN',
  'BASE_COMMANDER',
  'LOGISTICS_OFFICER',
  'INVENTORY_OFFICER',
  'AUDITOR',
  'MAINTENANCE_OFFICER',
] as const;

export type Role = (typeof roles)[number];

export const permissions = [
  'asset.read',
  'asset.create',
  'asset.lifecycle.request',
  'inventory.balance.read',
  'inventory.transaction.create',
  'inventory.transaction.approve',
  'inventory.adjustment.request',
  'stocktake.count',
  'stocktake.resolve',
  'maintenance.work_order.manage',
  'audit.read',
  'export.create',
  'role.manage',
  'location.grant.manage',
] as const;

export type Permission = (typeof permissions)[number];

const allPermissions = new Set<Permission>(permissions);

const rolePermissions: Record<Role, ReadonlySet<Permission>> = {
  SUPER_ADMIN: allPermissions,
  ORGANIZATION_ADMIN: allPermissions,
  BASE_COMMANDER: new Set([
    'asset.read',
    'asset.lifecycle.request',
    'inventory.balance.read',
    'inventory.transaction.create',
    'inventory.transaction.approve',
    'stocktake.count',
    'stocktake.resolve',
    'maintenance.work_order.manage',
    'audit.read',
  ]),
  LOGISTICS_OFFICER: new Set([
    'asset.read',
    'asset.create',
    'asset.lifecycle.request',
    'inventory.balance.read',
    'inventory.transaction.create',
    'inventory.adjustment.request',
  ]),
  INVENTORY_OFFICER: new Set([
    'asset.read',
    'inventory.balance.read',
    'inventory.transaction.create',
    'stocktake.count',
  ]),
  AUDITOR: new Set(['asset.read', 'inventory.balance.read', 'audit.read']),
  MAINTENANCE_OFFICER: new Set(['asset.read', 'maintenance.work_order.manage']),
};

export interface AuthorizedScope {
  organizationId: string;
  locationIds: ReadonlySet<string>;
  organizationWide: boolean;
}

export interface AuthenticatedPrincipal {
  userId: string;
  sessionId: string;
  email: string;
  roles: Role[];
  permissions: ReadonlySet<Permission>;
  scope: AuthorizedScope;
  sessionVersion: number;
}

export function resolvePermissions(roleCodes: readonly string[]): ReadonlySet<Permission> {
  const resolved = new Set<Permission>();

  for (const role of roleCodes) {
    if (!isRole(role)) continue;
    for (const permission of rolePermissions[role]) resolved.add(permission);
  }

  return resolved;
}

export function isRole(value: string): value is Role {
  return roles.some((role) => role === value);
}

export function requirePermission(principal: AuthenticatedPrincipal, permission: Permission): void {
  if (!principal.permissions.has(permission)) {
    throw new AppError({
      statusCode: 403,
      code: 'FORBIDDEN',
      message: 'You are not authorized to perform this action.',
    });
  }
}

export function requireLocationScope(
  principal: AuthenticatedPrincipal,
  organizationId: string,
  locationId: string,
): void {
  if (
    principal.scope.organizationId !== organizationId ||
    (!principal.scope.organizationWide && !principal.scope.locationIds.has(locationId))
  ) {
    throw new AppError({
      statusCode: 404,
      code: 'RESOURCE_NOT_FOUND',
      message: 'The requested resource is unavailable.',
    });
  }
}

export function requireIndependentApproval(
  principal: AuthenticatedPrincipal,
  requesterId: string,
  organizationId: string,
  locationId: string,
): void {
  requirePermission(principal, 'inventory.transaction.approve');
  requireLocationScope(principal, organizationId, locationId);

  if (principal.userId === requesterId) {
    throw new AppError({
      statusCode: 403,
      code: 'SELF_APPROVAL_FORBIDDEN',
      message: 'A requester cannot approve their own restricted transaction.',
    });
  }
}

export function isReadOnlyPrincipal(principal: AuthenticatedPrincipal): boolean {
  return principal.roles.includes('AUDITOR') && principal.roles.length === 1;
}
