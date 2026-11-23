import {
  AlertCircle,
  Bell,
  CheckCircle2,
  ChevronDown,
  Command,
  Menu,
  Search,
  X,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { navigation } from '../app/navigation';
import { cn } from '../lib/utils';
import { demoIdentity } from '../lib/authorization';

export type ToastTone = 'success' | 'info' | 'danger';

export interface ToastItem {
  id: number;
  title: string;
  detail: string;
  tone: ToastTone;
}

export function StatusBadge({ tone, children }: { tone: string; children: ReactNode }) {
  return <span className={cn('status-badge', `status-badge--${tone}`)}>{children}</span>;
}

export function ToastRegion({
  toasts,
  onDismiss,
}: {
  toasts: ToastItem[];
  onDismiss: (id: number) => void;
}) {
  return (
    <div aria-live="polite" aria-relevant="additions" className="toast-region">
      {toasts.map((toast) => (
        <article className={cn('toast', `toast--${toast.tone}`)} key={toast.id}>
          {toast.tone === 'danger' ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
          <div>
            <strong>{toast.title}</strong>
            <p>{toast.detail}</p>
          </div>
          <button
            aria-label="Dismiss notification"
            className="icon-button"
            onClick={() => onDismiss(toast.id)}
            type="button"
          >
            <X size={16} />
          </button>
        </article>
      ))}
    </div>
  );
}

export function ConfirmDialog({
  title,
  detail,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  title: string;
  detail: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const confirmButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    confirmButton.current?.focus();
  }, []);

  return (
    <div aria-labelledby="dialog-title" aria-modal="true" className="dialog-backdrop" role="dialog">
      <section className="confirm-dialog">
        <p className="section-kicker">Confirmation required</p>
        <h2 id="dialog-title">{title}</h2>
        <p>{detail}</p>
        <div className="dialog-actions">
          <button className="button button--secondary" onClick={onCancel} type="button">
            Cancel
          </button>
          <button
            className="button button--primary"
            onClick={onConfirm}
            ref={confirmButton}
            type="button"
          >
            {confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}

export function GlobalSearch({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const searchInput = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const results = navigation.filter((item) =>
    item.label.toLowerCase().includes(query.toLowerCase()),
  );

  useEffect(() => {
    if (open) searchInput.current?.focus();
  }, [open]);

  if (!open) return null;

  return (
    <div aria-label="Global search" aria-modal="true" className="search-backdrop" role="dialog">
      <section className="search-panel">
        <Search aria-hidden="true" size={20} />
        <input
          aria-label="Search KAVACH"
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search pages, assets, or request IDs…"
          ref={searchInput}
          value={query}
        />
        <button className="key-hint" onClick={onClose} type="button">
          Esc
        </button>
        <div className="search-results">
          <p className="search-label">Go to</p>
          {results.slice(0, 7).map((item) => (
            <button
              className="search-result"
              key={item.path}
              onClick={() => {
                navigate(item.path);
                onClose();
              }}
              type="button"
            >
              <item.icon size={16} />
              <span>{item.label}</span>
            </button>
          ))}
          {results.length === 0 && <p className="search-note">No demo pages match “{query}”.</p>}
          <p className="search-note">
            Fictional demo data only · Search is UI-only until API integration.
          </p>
        </div>
      </section>
    </div>
  );
}

export function CompactHeader({
  onMenu,
  onSearch,
  onNotify,
  onProfile,
}: {
  onMenu: () => void;
  onSearch: () => void;
  onNotify: () => void;
  onProfile: () => void;
}) {
  return (
    <header className="topbar">
      <button
        aria-label="Open navigation"
        className="icon-button mobile-menu"
        onClick={onMenu}
        type="button"
      >
        <Menu size={20} />
      </button>
      <button className="global-search-button" onClick={onSearch} type="button">
        <Search size={18} /> <span>Search KAVACH</span>
        <kbd>
          <Command size={12} />K
        </kbd>
      </button>
      <div className="topbar-actions">
        <button
          aria-label="Show notifications"
          className="icon-button notification-button"
          onClick={onNotify}
          type="button"
        >
          <Bell size={19} /> <span className="notification-dot" />
        </button>
        <button
          aria-label="Open user profile"
          className="profile-trigger"
          onClick={onProfile}
          type="button"
        >
          <span className="avatar">PN</span>
          <span className="profile-copy">
            <strong>{demoIdentity.name}</strong>
            <small>{demoIdentity.roleLabel}</small>
          </span>
          <ChevronDown size={15} />
        </button>
      </div>
    </header>
  );
}

export function Breadcrumbs({ current }: { current: string }) {
  return (
    <nav aria-label="Breadcrumb" className="breadcrumbs">
      <Link to="/dashboard">Operations</Link>
      <span>/</span>
      <span>{current}</span>
    </nav>
  );
}
