import type { LucideIcon } from 'lucide-react';
import type { UiPermission } from '../lib/authorization';
import {
  ArrowLeftRight,
  BarChart3,
  Boxes,
  ClipboardCheck,
  FileSearch,
  Gauge,
  Settings,
  ShieldCheck,
  Users,
  Wrench,
} from 'lucide-react';

export interface NavigationItem {
  label: string;
  path: string;
  icon: LucideIcon;
  permission?: UiPermission;
}

export const navigation: NavigationItem[] = [
  { label: 'Dashboard', path: '/dashboard', icon: Gauge },
  { label: 'Asset Registry', path: '/asset-registry', icon: Boxes, permission: 'asset.read' },
  {
    label: 'Inventory',
    path: '/inventory',
    icon: ClipboardCheck,
    permission: 'inventory.balance.read',
  },
  {
    label: 'Transfers',
    path: '/transfers',
    icon: ArrowLeftRight,
    permission: 'inventory.transaction.create',
  },
  { label: 'Assignments', path: '/assignments', icon: ShieldCheck, permission: 'asset.read' },
  {
    label: 'Physical Reconciliation',
    path: '/reconciliation',
    icon: FileSearch,
    permission: 'stocktake.count',
  },
  {
    label: 'Maintenance',
    path: '/maintenance',
    icon: Wrench,
    permission: 'maintenance.work_order.manage',
  },
  { label: 'Audit Logs', path: '/audit', icon: FileSearch, permission: 'audit.read' },
  { label: 'Reports', path: '/reports', icon: BarChart3, permission: 'audit.read' },
  { label: 'User Management', path: '/users', icon: Users, permission: 'role.manage' },
  { label: 'Settings', path: '/settings', icon: Settings, permission: 'role.manage' },
];
