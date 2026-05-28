import { useAuth } from '@clerk/clerk-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminProductsApi } from '@/lib/api-client';
import type {
  CreateProductBody,
  PriceBandComponent,
  ProductListRow,
  UpdateProductBody,
  UpsertCommissionRuleBody,
  UpsertPriceBandBody,
} from '@/admin/types';

/**
 * Admin products / price-bands / commission-rules hooks (Phase 02, T07). Token
 * resolved via useAuth().getToken(), threaded into adminProductsApi (D-J).
 */

export function useAdminProducts(appId?: string) {
  const { getToken } = useAuth();
  return useQuery({
    queryKey: ['admin', 'products', appId ?? 'all'],
    queryFn: async () => adminProductsApi.list(appId, (await getToken()) ?? ''),
    select: (d): ProductListRow[] => (Array.isArray(d.products) ? d.products : []),
  });
}

export function useAdminProduct(id: string) {
  const { getToken } = useAuth();
  return useQuery({
    queryKey: ['admin', 'products', id],
    queryFn: async () => adminProductsApi.get(id, (await getToken()) ?? ''),
    enabled: Boolean(id),
  });
}

export function useCreateProduct() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateProductBody) =>
      adminProductsApi.create(data, (await getToken()) ?? ''),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'products'] });
    },
  });
}

export function useUpdateProduct() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateProductBody }) =>
      adminProductsApi.update(id, data, (await getToken()) ?? ''),
    onSuccess: (_res, { id }) => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'products'] });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'products', id] });
    },
  });
}

export function useUpsertPriceBand(productId: string) {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      component,
      data,
    }: {
      component: PriceBandComponent;
      data: UpsertPriceBandBody;
    }) => adminProductsApi.upsertPriceBand(productId, component, data, (await getToken()) ?? ''),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'products', productId] });
    },
  });
}

export function useUpsertCommissionRule(productId: string) {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: UpsertCommissionRuleBody) =>
      adminProductsApi.upsertCommissionRule(productId, data, (await getToken()) ?? ''),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'products', productId] });
    },
  });
}
