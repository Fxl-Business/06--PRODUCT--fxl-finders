import { useUser } from '@clerk/clerk-react';
import { Navigate } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * Admin route guard (Phase 02, T01) — UX-only redirect.
 *
 * Reads the role from the Clerk client (publicMetadata.role). This is a
 * convenience gate for the SPA; the AUTHORITATIVE check is the backend
 * `requireAdmin` middleware (D-B). A non-admin who bypasses this still gets 403
 * from every /api/v1/admin/* call.
 */
export function AdminGuard({ children }: { children: React.ReactNode }) {
  const { isLoaded, user } = useUser();

  if (!isLoaded) {
    return <Skeleton className="h-screen w-full" />;
  }

  const role = user?.publicMetadata?.role;
  if (role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
