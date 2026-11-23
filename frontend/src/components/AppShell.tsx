import { ChevronLeft, ChevronRight, LogOut, ShieldCheck, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { navigation } from '../app/navigation';
import { canNavigate, demoIdentity } from '../lib/authorization';
import { cn } from '../lib/utils';
import { CompactHeader, GlobalSearch, ToastRegion, type ToastItem } from './ui';

export function AppShell({
  children,
  toasts,
  onDismissToast,
}: {
  children: ReactNode;
  toasts: ToastItem[];
  onDismissToast: (id: number) => void;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const visibleNavigation = navigation.filter((item) => canNavigate(item.permission));

  return (
    <div className={cn('app-shell', collapsed && 'app-shell--collapsed')}>
      {mobileOpen && (
        <button
          aria-label="Close navigation"
          className="mobile-scrim"
          onClick={() => setMobileOpen(false)}
          type="button"
        />
      )}
      <aside className={cn('sidebar', mobileOpen && 'sidebar--mobile-open')}>
        <div className="brand-row">
          <Link aria-label="KAVACH dashboard" className="brand" to="/dashboard">
            <ShieldCheck size={24} />
            <span>KAVACH</span>
          </Link>
          <button
            aria-label="Close navigation"
            className="icon-button sidebar-close"
            onClick={() => setMobileOpen(false)}
            type="button"
          >
            <X size={18} />
          </button>
        </div>
        <p className="tenant-label">Fictional organization</p>
        <div className="location-switcher">
          <span className="location-dot" />
          <span>Northbridge Group</span>
          <ChevronRight size={15} />
        </div>
        <nav aria-label="Main navigation" className="sidebar-nav">
          {visibleNavigation.map((item) => {
            const active = location.pathname === item.path;
            return (
              <Link
                className={cn('nav-item', active && 'nav-item--active')}
                key={item.path}
                onClick={() => setMobileOpen(false)}
                to={item.path}
              >
                <item.icon size={19} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="sidebar-footer">
          <div className="demo-label">DEMO DATA ONLY</div>
          <button
            className="collapse-button"
            onClick={() => setCollapsed((value) => !value)}
            type="button"
          >
            {collapsed ? (
              <ChevronRight size={17} />
            ) : (
              <>
                <ChevronLeft size={17} />
                <span>Collapse sidebar</span>
              </>
            )}
          </button>
        </div>
      </aside>
      <div className="app-main">
        <CompactHeader
          onMenu={() => setMobileOpen(true)}
          onNotify={() => setNotificationOpen((value) => !value)}
          onProfile={() => setProfileOpen((value) => !value)}
          onSearch={() => setSearchOpen(true)}
        />
        {notificationOpen && (
          <section className="popover notification-popover">
            <header>
              <strong>Notifications</strong>
              <button
                className="link-button"
                onClick={() => setNotificationOpen(false)}
                type="button"
              >
                Dismiss panel
              </button>
            </header>
            <article>
              <span className="notice-indicator notice-indicator--warning" />
              <div>
                <strong>3 approvals waiting</strong>
                <p>Transfer and discrepancy requests need review.</p>
              </div>
            </article>
            <article>
              <span className="notice-indicator notice-indicator--danger" />
              <div>
                <strong>1 count variance open</strong>
                <p>Harborpoint Depot requires resolution.</p>
              </div>
            </article>
            <button className="popover-footer" onClick={() => navigate('/audit')} type="button">
              View audit log
            </button>
          </section>
        )}
        {profileOpen && (
          <section className="popover profile-popover">
            <strong>{demoIdentity.name}</strong>
            <p>{demoIdentity.roleLabel} · Northbridge Group</p>
            <button onClick={() => navigate('/settings')} type="button">
              Profile preferences
            </button>
            <button onClick={() => navigate('/login')} type="button">
              <LogOut size={15} /> Sign out
            </button>
          </section>
        )}
        <main className="content-area">{children}</main>
      </div>
      <GlobalSearch onClose={() => setSearchOpen(false)} open={searchOpen} />
      <ToastRegion onDismiss={onDismissToast} toasts={toasts} />
    </div>
  );
}
