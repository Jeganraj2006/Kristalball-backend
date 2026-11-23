export type StatusTone = 'success' | 'warning' | 'danger' | 'neutral' | 'info';

export interface TableRow {
  id: string;
  primary: string;
  secondary: string;
  location: string;
  owner: string;
  status: string;
  tone: StatusTone;
  updated: string;
}

export const inventoryTrend = [
  { label: 'May', available: 418, allocated: 196 },
  { label: 'Jun', available: 438, allocated: 204 },
  { label: 'Jul', available: 401, allocated: 238 },
  { label: 'Aug', available: 462, allocated: 221 },
  { label: 'Sep', available: 455, allocated: 256 },
  { label: 'Oct', available: 486, allocated: 244 },
];

export const assetDistribution = [
  { name: 'IT equipment', value: 38, color: '#2563eb' },
  { name: 'Facilities', value: 25, color: '#0f766e' },
  { name: 'Safety', value: 18, color: '#d97706' },
  { name: 'Operations', value: 19, color: '#64748b' },
];

export const registryRows: TableRow[] = [
  {
    id: 'AST-00428',
    primary: 'Latitude 7440 Rugged Laptop',
    secondary: 'Serialized · IT-HW-044',
    location: 'Northbridge Service Centre',
    owner: 'Priya Nair',
    status: 'In service',
    tone: 'success',
    updated: '12 min ago',
  },
  {
    id: 'AST-00431',
    primary: 'Portable Calibration Kit',
    secondary: 'Serialized · OPS-CAL-028',
    location: 'Harborpoint Depot',
    owner: 'Unassigned',
    status: 'Maintenance due',
    tone: 'warning',
    updated: '38 min ago',
  },
  {
    id: 'AST-00442',
    primary: 'Thermal Label Printer',
    secondary: 'Serialized · WH-LBL-016',
    location: 'Northbridge Service Centre',
    owner: 'Evan Cole',
    status: 'Assigned',
    tone: 'info',
    updated: '1 hr ago',
  },
  {
    id: 'AST-00451',
    primary: 'Emergency Response Cabinet',
    secondary: 'Serialized · SAFE-ERC-008',
    location: 'Lakeside Operations Hub',
    owner: 'Facilities Team',
    status: 'Count variance',
    tone: 'danger',
    updated: 'Yesterday',
  },
];

export const inventoryRows: TableRow[] = [
  {
    id: 'INV-1029',
    primary: 'Protective gloves, size M',
    secondary: 'Bulk · SAF-GLO-M',
    location: 'Harborpoint Depot',
    owner: 'On-hand 240 · Available 182',
    status: 'Healthy',
    tone: 'success',
    updated: 'Today, 09:12',
  },
  {
    id: 'INV-1037',
    primary: 'Portable radio battery',
    secondary: 'Bulk · COM-BAT-100',
    location: 'Northbridge Service Centre',
    owner: 'On-hand 108 · Available 90',
    status: 'Reorder watch',
    tone: 'warning',
    updated: 'Today, 08:46',
  },
  {
    id: 'INV-1044',
    primary: 'Thermal label roll',
    secondary: 'Bulk · WH-LBL-ROLL',
    location: 'Lakeside Operations Hub',
    owner: 'On-hand 480 · Available 418',
    status: 'Healthy',
    tone: 'success',
    updated: 'Yesterday',
  },
];

export const pageData: Record<
  string,
  { title: string; description: string; action: string; rows: TableRow[] }
> = {
  'asset-registry': {
    title: 'Asset Registry',
    description:
      'Serialized assets with independently tracked custody, location, availability, and condition.',
    action: 'Register asset',
    rows: registryRows,
  },
  inventory: {
    title: 'Inventory',
    description:
      'Bulk stock balance projections. Allocation reduces availability, not organizational on-hand quantity.',
    action: 'Create inventory request',
    rows: inventoryRows,
  },
  transfers: {
    title: 'Transfers',
    description:
      'Review controlled movements between fictional locations before dispatch and receipt.',
    action: 'Create transfer',
    rows: registryRows.map((row, index) => ({
      ...row,
      id: `TRF-00${index + 18}`,
      primary: index === 1 ? 'Harborpoint → Northbridge' : 'Northbridge → Lakeside',
      secondary: `${index + 2} line items · Demo request`,
      status: index === 1 ? 'Awaiting receipt' : 'Pending approval',
      tone: index === 1 ? 'info' : 'warning',
    })),
  },
  assignments: {
    title: 'Assignments',
    description:
      'Custody acknowledgements and active allocations, presented separately from ownership.',
    action: 'Create assignment',
    rows: registryRows,
  },
  reconciliation: {
    title: 'Physical Reconciliation',
    description:
      'Count sessions compare physical observations to the ledger-derived book balance at a fixed cutoff.',
    action: 'Start count session',
    rows: inventoryRows.map((row, index) => ({
      ...row,
      id: `CNT-00${index + 41}`,
      status: index === 1 ? 'Variance pending' : 'Count complete',
      tone: index === 1 ? 'danger' : 'success',
    })),
  },
  maintenance: {
    title: 'Maintenance',
    description:
      'Work orders and asset availability states. Closing a work order preserves lifecycle history.',
    action: 'Open work order',
    rows: registryRows.map((row, index) => ({
      ...row,
      id: `MNT-00${index + 74}`,
      status: index === 0 ? 'Scheduled' : index === 1 ? 'Overdue' : 'In progress',
      tone: index === 1 ? 'danger' : 'warning',
    })),
  },
  audit: {
    title: 'Audit Logs',
    description:
      'Read-only event history. This demo illustrates audit records; production events are server-authoritative.',
    action: 'Export audit log',
    rows: registryRows.map((row, index) => ({
      ...row,
      id: `AUD-00${index + 551}`,
      primary:
        [
          'Assignment acknowledged',
          'Transfer approved',
          'Stocktake completed',
          'Asset condition updated',
        ][index] ?? row.primary,
      secondary: `Actor: ${row.owner} · Fictional demo event`,
      status: 'Recorded',
      tone: 'neutral',
    })),
  },
  reports: {
    title: 'Reports',
    description:
      'Scope-aware operational reporting with as-of context and projection freshness in the production service.',
    action: 'Create report',
    rows: inventoryRows,
  },
  users: {
    title: 'User Management',
    description:
      'Fictional user profiles, roles, and location grants. Permissions remain enforced by the backend.',
    action: 'Invite user',
    rows: registryRows.map((row, index) => ({
      ...row,
      id: `USR-00${index + 102}`,
      primary: ['Priya Nair', 'Evan Cole', 'Maya Torres', 'Jordan Lee'][index] ?? row.primary,
      secondary: ['Asset Manager', 'Storekeeper', 'Approver', 'Auditor'][index] ?? row.secondary,
      status: 'Active',
      tone: 'success',
    })),
  },
  settings: {
    title: 'Settings',
    description:
      'Organization controls and configurable defaults. These demo controls do not modify a production environment.',
    action: 'Save review',
    rows: [
      {
        id: 'SET-01',
        primary: 'Location hierarchy',
        secondary: 'Fictional organization structure',
        location: 'Organization',
        owner: 'Inherited access enabled',
        status: 'Configured',
        tone: 'success',
        updated: 'Demo',
      },
    ],
  },
};
