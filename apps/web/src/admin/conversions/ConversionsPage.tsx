import { useTranslation } from 'react-i18next';
import { DollarSign, RefreshCw, TrendingUp } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';
import { KPICard } from '@/components/ui/kpi-card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useAdminConversions } from './useConversions';

/** BRL cents → pt-BR currency string. */
function brl(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function ConversionsPage() {
  const { t } = useTranslation();
  const { data: conversions, isLoading } = useAdminConversions();

  const list = conversions ?? [];
  const total = list.length;
  const setupTotal = list.reduce((s, c) => s + c.realizedSetupBrl, 0);
  const recurringTotal = list.reduce((s, c) => s + c.realizedMonthlyBrl, 0);

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold">{t('admin.conversions.title')}</h2>

      <div className="grid gap-4 sm:grid-cols-3">
        <KPICard
          title={t('admin.conversions.kpi.total')}
          value={total}
          icon={TrendingUp}
          isLoading={isLoading}
        />
        <KPICard
          title={t('admin.conversions.kpi.setupTotal')}
          value={brl(setupTotal)}
          icon={DollarSign}
          isLoading={isLoading}
          colorScheme="success"
        />
        <KPICard
          title={t('admin.conversions.kpi.recurringTotal')}
          value={brl(recurringTotal)}
          icon={RefreshCw}
          isLoading={isLoading}
          colorScheme="primary"
        />
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <EmptyState title={t('admin.conversions.empty')} />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('admin.conversions.columns.source')}</TableHead>
              <TableHead>{t('admin.conversions.columns.orderId')}</TableHead>
              <TableHead>{t('admin.conversions.columns.finder')}</TableHead>
              <TableHead>{t('admin.conversions.columns.seller')}</TableHead>
              <TableHead className="text-right">{t('admin.conversions.columns.setup')}</TableHead>
              <TableHead className="text-right">{t('admin.conversions.columns.monthly')}</TableHead>
              <TableHead>{t('admin.conversions.columns.closedAt')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.source}</TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {c.externalOrderId}
                </TableCell>
                <TableCell>{c.finderDisplayName ?? '—'}</TableCell>
                <TableCell>{c.sellerDisplayName ?? '—'}</TableCell>
                <TableCell className="text-right">{brl(c.realizedSetupBrl)}</TableCell>
                <TableCell className="text-right">{brl(c.realizedMonthlyBrl)}</TableCell>
                <TableCell>{new Date(c.closedAt).toLocaleDateString('pt-BR')}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
