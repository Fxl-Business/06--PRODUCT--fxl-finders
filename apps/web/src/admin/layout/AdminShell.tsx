import { Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton';
import { AdminNav } from './AdminNav';

/**
 * Admin section layout (Phase 02, T01). Mirrors AppShell but with the admin nav.
 * Admin pages are React.lazy — Suspense fallback keeps the chrome visible.
 */
export function AdminShell() {
  return (
    <div className="flex h-screen bg-background">
      <AdminNav />
      <div className="flex flex-1 flex-col overflow-hidden">
        <main className="flex-1 overflow-y-auto p-8">
          <Suspense fallback={<Skeleton className="h-64 w-full" />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  );
}
