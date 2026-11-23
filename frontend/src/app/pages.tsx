import {
  Activity,
  AlertTriangle,
  ArrowRight,
  ClipboardCheck,
  Clock3,
  FileWarning,
  Filter,
  PackageCheck,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  Wrench,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Area,
  AreaChart,
} from 'recharts';
import { assetDistribution, inventoryTrend, pageData, type TableRow } from './demo-data';
import { Breadcrumbs, ConfirmDialog, StatusBadge } from '../components/ui';
import { TransferWorkflowPanel } from '../components/TransferWorkflowPanel';
import { ReconciliationPanel } from '../components/ReconciliationPanel';
import type { ToastTone } from '../components/ui';

type DataState = 'ready' | 'loading' | 'empty' | 'error';

function PageHeader({
  title,
  description,
  action,
  onAction,
}: {
  title: string;
  description: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <>
      <Breadcrumbs current={title} />
      <div className="page-heading">
        <div>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        {action && (
          <button className="button button--primary" onClick={onAction} type="button">
            <Plus size={17} />
            {action}
          </button>
        )}
      </div>
    </>
  );
}

export function DashboardPage({
  notify,
}: {
  notify: (title: string, detail: string, tone?: ToastTone) => void;
}) {
  return (
    <div className="page-wrap">
      <PageHeader
        action="Review approvals"
        description="A scoped view of fictional operational data. This dashboard is not connected to a production API."
        onAction={() =>
          notify(
            'Demo approval queue opened',
            'Approval actions are illustrative until backend workflows are connected.',
            'info',
          )
        }
        title="Operations Dashboard"
      />
      <section className="demo-banner">
        <ShieldAlert size={17} />
        <span>
          <strong>Demo environment</strong> — all people, locations, assets, balances, and alerts
          shown here are fictional.
        </span>
        <button
          onClick={() =>
            notify('Demo notice acknowledged', 'Live API integration has not been enabled.', 'info')
          }
          type="button"
        >
          Got it
        </button>
      </section>
      <section aria-label="Operational metrics" className="metric-grid">
        <Metric
          icon={<PackageCheck />}
          label="Total registered assets"
          value="2,847"
          detail="+34 this month"
          tone="blue"
        />
        <Metric
          icon={<ClipboardCheck />}
          label="Available inventory"
          value="486"
          detail="Across 3 locations"
          tone="green"
        />
        <Metric
          icon={<Activity />}
          label="Allocated inventory"
          value="244"
          detail="33 requests active"
          tone="slate"
        />
        <Metric
          icon={<Clock3 />}
          label="Pending approvals"
          value="7"
          detail="3 approaching SLA"
          tone="amber"
        />
        <Metric
          icon={<FileWarning />}
          label="Open discrepancies"
          value="2"
          detail="1 needs escalation"
          tone="red"
        />
        <Metric
          icon={<Wrench />}
          label="Maintenance due"
          value="14"
          detail="4 due this week"
          tone="purple"
        />
      </section>
      <section className="dashboard-grid dashboard-grid--charts">
        <article className="panel chart-panel">
          <header className="panel-heading">
            <div>
              <h2>Inventory availability trend</h2>
              <p>Six-month fictional balance projection</p>
            </div>
            <button
              className="icon-button"
              onClick={() =>
                notify(
                  'Chart refreshed',
                  'The demo chart was refreshed with the same fictional dataset.',
                  'success',
                )
              }
              type="button"
            >
              <RefreshCw size={17} />
            </button>
          </header>
          <div className="chart-area">
            <ResponsiveContainer height="100%" width="100%">
              <AreaChart data={inventoryTrend} margin={{ top: 8, right: 6, left: -24, bottom: 0 }}>
                <defs>
                  <linearGradient id="availableFill" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#2563eb" stopOpacity={0.22} />
                    <stop offset="100%" stopColor="#2563eb" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  axisLine={false}
                  dataKey="label"
                  tickLine={false}
                  tick={{ fill: '#64748b', fontSize: 12 }}
                />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                <Tooltip
                  contentStyle={{
                    border: '1px solid #dbe4ee',
                    borderRadius: '8px',
                    boxShadow: '0 8px 20px rgba(15, 23, 42, .12)',
                  }}
                />
                <Area
                  dataKey="available"
                  fill="url(#availableFill)"
                  name="Available"
                  stroke="#2563eb"
                  strokeWidth={2}
                  type="monotone"
                />
                <Area
                  dataKey="allocated"
                  fill="none"
                  name="Allocated"
                  stroke="#d97706"
                  strokeWidth={2}
                  type="monotone"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </article>
        <article className="panel distribution-panel">
          <header className="panel-heading">
            <div>
              <h2>Asset category distribution</h2>
              <p>Registered asset profile</p>
            </div>
          </header>
          <div className="pie-area">
            <ResponsiveContainer height="100%" width="100%">
              <PieChart>
                <Pie
                  cx="50%"
                  cy="45%"
                  data={assetDistribution}
                  dataKey="value"
                  innerRadius={58}
                  outerRadius={84}
                  paddingAngle={3}
                >
                  <>
                    {assetDistribution.map((entry) => (
                      <Cell fill={entry.color} key={entry.name} />
                    ))}
                  </>
                </Pie>
                <Tooltip />
                <Legend iconType="circle" layout="vertical" verticalAlign="bottom" />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </article>
      </section>
      <section className="dashboard-grid dashboard-grid--lower">
        <RecentActivity notify={notify} />
        <Approvals notify={notify} />
        <Exceptions notify={notify} />
      </section>
    </div>
  );
}

function Metric({
  icon,
  label,
  value,
  detail,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail: string;
  tone: string;
}) {
  return (
    <article className="metric-card">
      <span className={`metric-icon metric-icon--${tone}`}>{icon}</span>
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
        <small>{detail}</small>
      </div>
    </article>
  );
}

function RecentActivity({
  notify,
}: {
  notify: (title: string, detail: string, tone?: ToastTone) => void;
}) {
  return (
    <article className="panel activity-panel">
      <header className="panel-heading">
        <div>
          <h2>Recent activity</h2>
          <p>Fictional system events</p>
        </div>
        <button
          className="link-button"
          onClick={() =>
            notify(
              'Audit history selected',
              'Use the Audit Logs navigation page to inspect demo records.',
              'info',
            )
          }
          type="button"
        >
          View log <ArrowRight size={15} />
        </button>
      </header>
      <div className="activity-list">
        <ActivityItem
          title="Custody acknowledgement recorded"
          meta="AST-00428 · Northbridge Service Centre · 12 min ago"
          tone="success"
        />
        <ActivityItem
          title="Transfer submitted for approval"
          meta="TRF-0020 · Harborpoint → Northbridge · 38 min ago"
          tone="info"
        />
        <ActivityItem
          title="Count variance requires review"
          meta="CNT-0042 · Portable radio battery · 1 hr ago"
          tone="danger"
        />
        <ActivityItem
          title="Maintenance work order opened"
          meta="MNT-0075 · Calibration Kit · Yesterday"
          tone="warning"
        />
      </div>
    </article>
  );
}
function ActivityItem({ title, meta, tone }: { title: string; meta: string; tone: string }) {
  return (
    <div className="activity-item">
      <span className={`activity-marker activity-marker--${tone}`} />
      <div>
        <strong>{title}</strong>
        <p>{meta}</p>
      </div>
    </div>
  );
}
function Approvals({
  notify,
}: {
  notify: (title: string, detail: string, tone?: ToastTone) => void;
}) {
  return (
    <article className="panel approvals-panel">
      <header className="panel-heading">
        <div>
          <h2>Pending approvals</h2>
          <p>Requires your review</p>
        </div>
        <StatusBadge tone="warning">7 pending</StatusBadge>
      </header>
      <div className="approval-item">
        <div>
          <strong>Transfer request TRF-0020</strong>
          <p>12 battery units · Harborpoint Depot</p>
        </div>
        <button
          className="text-action"
          onClick={() =>
            notify(
              'Approval preview opened',
              'This demo does not post an approval decision.',
              'info',
            )
          }
          type="button"
        >
          Review
        </button>
      </div>
      <div className="approval-item">
        <div>
          <strong>Adjustment request ADJ-0014</strong>
          <p>Count variance · Lakeside Operations Hub</p>
        </div>
        <button
          className="text-action"
          onClick={() =>
            notify('Approval preview opened', 'This demo does not post an adjustment.', 'info')
          }
          type="button"
        >
          Review
        </button>
      </div>
      <div className="approval-item">
        <div>
          <strong>Custody handover ASG-0061</strong>
          <p>Latitude 7440 · Northbridge Service Centre</p>
        </div>
        <button
          className="text-action"
          onClick={() =>
            notify('Approval preview opened', 'This demo does not change custody.', 'info')
          }
          type="button"
        >
          Review
        </button>
      </div>
    </article>
  );
}
function Exceptions({
  notify,
}: {
  notify: (title: string, detail: string, tone?: ToastTone) => void;
}) {
  return (
    <article className="panel exception-panel">
      <header className="panel-heading">
        <div>
          <h2>Exceptions</h2>
          <p>Operational attention required</p>
        </div>
        <AlertTriangle color="#b45309" size={19} />
      </header>
      <div className="exception-item">
        <StatusBadge tone="danger">Critical</StatusBadge>
        <div>
          <strong>Unresolved physical variance</strong>
          <p>Battery count differs from book balance by 4 units.</p>
          <button
            className="link-button"
            onClick={() =>
              notify('Exception opened', 'Resolution workflow is a demo state only.', 'info')
            }
            type="button"
          >
            Inspect discrepancy
          </button>
        </div>
      </div>
      <div className="exception-item">
        <StatusBadge tone="warning">Watch</StatusBadge>
        <div>
          <strong>Maintenance approaching SLA</strong>
          <p>4 assets are due for scheduled maintenance this week.</p>
          <button
            className="link-button"
            onClick={() => notify('Maintenance list opened', 'This uses fictional data.', 'info')}
            type="button"
          >
            View work orders
          </button>
        </div>
      </div>
    </article>
  );
}

export function DataPage({
  pageKey,
  notify,
}: {
  pageKey: string;
  notify: (title: string, detail: string, tone?: ToastTone) => void;
}) {
  const page = pageData[pageKey] ?? {
    title: 'Unavailable page',
    description: 'This demo route has not been configured.',
    action: 'Return to dashboard',
    rows: [],
  };
  const [query, setQuery] = useState('');
  const [state, setState] = useState<DataState>('ready');
  const [confirming, setConfirming] = useState(false);
  const rows = useMemo(
    () =>
      page.rows.filter((row) =>
        `${row.id} ${row.primary} ${row.location} ${row.status}`
          .toLowerCase()
          .includes(query.toLowerCase()),
      ),
    [page.rows, query],
  );
  return (
    <div className="page-wrap">
      <PageHeader
        action={page.action}
        description={page.description}
        onAction={() => setConfirming(true)}
        title={page.title}
      />
      <section className="demo-banner demo-banner--compact">
        <ShieldAlert size={16} />
        <span>
          UI demonstration only. Records shown are fictional and no command will be submitted.
        </span>
      </section>
      <section className="page-toolbar">
        <label className="table-search">
          <Search size={17} />
          <input
            aria-label={`Search ${page.title}`}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={`Search ${page.title.toLowerCase()}…`}
            value={query}
          />
        </label>
        <div className="toolbar-actions">
          <select
            aria-label="Data state"
            onChange={(event) => setState(event.target.value as DataState)}
            value={state}
          >
            <option value="ready">Show demo records</option>
            <option value="loading">Show loading state</option>
            <option value="empty">Show empty state</option>
            <option value="error">Show error state</option>
          </select>
          <button
            className="button button--secondary"
            onClick={() => {
              setQuery('');
              notify('Filters reset', 'The fictional demo filter state was reset.', 'success');
            }}
            type="button"
          >
            <Filter size={16} />
            Filters
          </button>
        </div>
      </section>
      <DataStateView
        onRetry={() => setState('ready')}
        onView={(row) =>
          notify(
            'Demo record opened',
            `${row.id} is a fictional preview; no live record was retrieved.`,
            'info',
          )
        }
        rows={rows}
        state={state}
        title={page.title}
      />
      {pageKey === 'transfers' && <TransferWorkflowPanel notify={notify} />}
      {pageKey === 'reconciliation' && <ReconciliationPanel notify={notify} />}
      {confirming && (
        <ConfirmDialog
          confirmLabel="Continue demo"
          detail={`Continue to the ${page.action.toLowerCase()} interface? No real record will be created.`}
          onCancel={() => setConfirming(false)}
          onConfirm={() => {
            setConfirming(false);
            notify(
              'Demo action confirmed',
              `${page.action} is intentionally not connected to a production workflow.`,
              'info',
            );
          }}
          title={page.action}
        />
      )}
    </div>
  );
}

function DataStateView({
  rows,
  state,
  title,
  onRetry,
  onView,
}: {
  rows: TableRow[];
  state: DataState;
  title: string;
  onRetry: () => void;
  onView: (row: TableRow) => void;
}) {
  if (state === 'loading')
    return (
      <section className="state-card">
        <span className="spinner" />
        <h2>Loading {title.toLowerCase()}…</h2>
        <p>Example loading state for an API-backed screen.</p>
      </section>
    );
  if (state === 'empty')
    return (
      <section className="state-card">
        <ClipboardCheck size={28} />
        <h2>No matching records</h2>
        <p>There are no fictional records matching the current filter.</p>
      </section>
    );
  if (state === 'error')
    return (
      <section className="state-card state-card--error">
        <AlertTriangle size={28} />
        <h2>Couldn’t load demo data</h2>
        <p>This example error state does not imply a production API failure.</p>
        <button className="button button--secondary" onClick={onRetry} type="button">
          Try again
        </button>
      </section>
    );
  return (
    <section className="table-card">
      <div className="table-meta">
        <span>
          {rows.length} demo record{rows.length === 1 ? '' : 's'}
        </span>
        <span>Last refreshed just now</span>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Record</th>
              <th>Location</th>
              <th>Custody / balance</th>
              <th>Status</th>
              <th>Updated</th>
              <th>
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>
                  <strong>{row.primary}</strong>
                  <span>
                    {row.id} · {row.secondary}
                  </span>
                </td>
                <td>{row.location}</td>
                <td>{row.owner}</td>
                <td>
                  <StatusBadge tone={row.tone}>{row.status}</StatusBadge>
                </td>
                <td>{row.updated}</td>
                <td>
                  <button className="text-action" onClick={() => onView(row)} type="button">
                    View
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function LoginPage({
  notify,
}: {
  notify: (title: string, detail: string, tone?: ToastTone) => void;
}) {
  const [error, setError] = useState(false);
  return (
    <main className="login-page">
      <section className="login-panel">
        <div className="login-brand">
          <ShieldAlert size={25} />
          <span>KAVACH</span>
        </div>
        <p className="section-kicker">Fictional demonstration environment</p>
        <h1>Accountability starts with a clear record.</h1>
        <p>
          Sign-in is shown for interface review only. Authentication will be connected to the
          approved identity service in a later phase.
        </p>
        <button
          className="button button--primary button--full"
          onClick={() => notify('Demo sign-in requested', 'No user session was created.', 'info')}
          type="button"
        >
          Continue with demo identity
        </button>
        <button
          className="button button--secondary button--full"
          onClick={() => setError(true)}
          type="button"
        >
          Show sign-in error state
        </button>
        {error && (
          <div className="form-error">
            <AlertTriangle size={17} />
            Sign-in is unavailable in the UI demo. No credentials were processed.
          </div>
        )}
        <small>Fictional data only · Secure authentication pending backend integration</small>
      </section>
    </main>
  );
}
