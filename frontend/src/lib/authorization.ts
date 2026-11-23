export type UiPermission =
  | 'asset.read'
  | 'inventory.balance.read'
  | 'inventory.transaction.create'
  | 'stocktake.count'
  | 'maintenance.work_order.manage'
  | 'audit.read'
  | 'role.manage';

// Demonstration identity only. Real permissions must come from GET /api/v1/auth/me after login.
export const demoIdentity = {
  name: 'Priya Nair',
  roleLabel: 'Organization Administrator',
  permissions: new Set<UiPermission>([
    'asset.read',
    'inventory.balance.read',
    'inventory.transaction.create',
    'stocktake.count',
    'maintenance.work_order.manage',
    'audit.read',
    'role.manage',
  ]),
};

export function canNavigate(requiredPermission: UiPermission | undefined): boolean {
  return !requiredPermission || demoIdentity.permissions.has(requiredPermission);
}
