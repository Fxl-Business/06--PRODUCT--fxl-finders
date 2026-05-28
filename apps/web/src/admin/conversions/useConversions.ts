import { useAuth } from '@clerk/clerk-react';
import { useQuery } from '@tanstack/react-query';
import { adminConversionsApi, type AdminConversionRow } from '@/lib/api-client';

/**
 * Admin conversions reconciliation hook (Phase 05 T10). Resolves the Clerk token via
 * useAuth().getToken() and threads it into adminConversionsApi (D-J). The select guard
 * returns [] when the payload is malformed (FXL array-hook rule).
 */
export function useAdminConversions(filters?: { source?: string; finderId?: string }) {
  const { getToken } = useAuth();
  return useQuery({
    queryKey: ['admin', 'conversions', filters],
    queryFn: async () => adminConversionsApi.list(filters, (await getToken()) ?? ''),
    select: (d): AdminConversionRow[] => (Array.isArray(d.conversions) ? d.conversions : []),
  });
}
