import { useCallback, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import type { ToastItem, ToastTone } from '../components/ui';
import { DashboardPage, DataPage, LoginPage } from './pages';

export function App() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const notify = useCallback((title: string, detail: string, tone: ToastTone = 'success') => {
    const toast = { id: Date.now(), title, detail, tone };
    setToasts((items) => [...items, toast]);
    window.setTimeout(
      () => setToasts((items) => items.filter((item) => item.id !== toast.id)),
      5000,
    );
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts((items) => items.filter((item) => item.id !== id));
  }, []);

  return (
    <Routes>
      <Route element={<LoginPage notify={notify} />} path="/login" />
      <Route
        element={
          <AppShell onDismissToast={dismissToast} toasts={toasts}>
            <DashboardPage notify={notify} />
          </AppShell>
        }
        path="/dashboard"
      />
      {[
        'asset-registry',
        'inventory',
        'transfers',
        'assignments',
        'reconciliation',
        'maintenance',
        'audit',
        'reports',
        'users',
        'settings',
      ].map((pageKey) => (
        <Route
          element={
            <AppShell onDismissToast={dismissToast} toasts={toasts}>
              <DataPage notify={notify} pageKey={pageKey} />
            </AppShell>
          }
          key={pageKey}
          path={`/${pageKey}`}
        />
      ))}
      <Route element={<Navigate replace to="/dashboard" />} path="*" />
    </Routes>
  );
}
