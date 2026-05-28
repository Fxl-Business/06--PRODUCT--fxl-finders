import { useAuth } from '@clerk/clerk-react';
import { useQuery } from '@tanstack/react-query';
import { finderClicksApi } from '@/lib/api-client';
import type { ClickRow, ClickStats } from '@/finder/types';

/**
 * Finder clicks TanStack Query hooks (Phase 04, T09). Consumes the FIRST-CLASS
 * paginated GET /api/v1/finder/clicks endpoint (org-isolated via the
 * clicks_select_tenant RLS policy). Token via useAuth().getToken() (D-J).
 */

export function useFinderClicks(linkId?: string) {
  const { getToken } = useAuth();
  return useQuery({
    queryKey: ['finder', 'clicks', linkId ?? null],
    queryFn: async () =>
      finderClicksApi.list(linkId ? { linkId } : undefined, (await getToken()) ?? ''),
    select: (d): ClickRow[] => (Array.isArray(d.clicks) ? d.clicks : []),
  });
}

export function useFinderClickStats() {
  const { getToken } = useAuth();
  return useQuery({
    queryKey: ['finder', 'clicks', 'stats'],
    queryFn: async (): Promise<ClickStats> => finderClicksApi.getStats((await getToken()) ?? ''),
  });
}
