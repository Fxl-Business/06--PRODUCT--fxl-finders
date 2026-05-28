import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { PayoutStatus } from '@/lib/api-client';
import { useDownloadPayoutCsv, useMarkPayoutPaid, usePayoutsList } from './usePayouts';

function brl(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

const STATUS_VARIANT: Record<PayoutStatus, 'secondary' | 'default' | 'outline'> = {
  draft: 'secondary',
  exported: 'outline',
  paid: 'default',
  voided: 'secondary',
};

/**
 * Admin payouts list (Phase 06 T10, D-Q). Lists payouts (draft|exported|paid|voided),
 * downloads the CSV (Blob via apiFetchBlob — carries the Bearer token, D-J), and marks
 * a payout paid (with a confirm dialog). NO two-person-approval badge (D6 deferred).
 */
export function PayoutBatchesPage() {
  const { t } = useTranslation();
  const { data: payouts, isLoading } = usePayoutsList();
  const markPaid = useMarkPayoutPaid();
  const downloadCsv = useDownloadPayoutCsv();
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const list = payouts ?? [];

  function confirmPaid() {
    if (confirmId) {
      markPaid.mutate(confirmId);
      setConfirmId(null);
    }
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold">{t('payouts.batches.title')}</h2>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <EmptyState title={t('payouts.batches.empty')} />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('payouts.batches.columns.id')}</TableHead>
              <TableHead>{t('payouts.batches.columns.createdAt')}</TableHead>
              <TableHead className="text-right">{t('payouts.batches.columns.amount')}</TableHead>
              <TableHead>{t('payouts.batches.columns.status')}</TableHead>
              <TableHead className="text-right">{t('payouts.batches.columns.actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-mono text-xs">{p.id.slice(0, 8)}…</TableCell>
                <TableCell>{new Date(p.createdAt).toLocaleDateString('pt-BR')}</TableCell>
                <TableCell className="text-right font-medium">{brl(p.totalBrl)}</TableCell>
                <TableCell>
                  <Badge variant={STATUS_VARIANT[p.status]}>
                    {t(`payouts.batches.status.${p.status}`)}
                  </Badge>
                </TableCell>
                <TableCell className="space-x-2 text-right">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={downloadCsv.isPending}
                    onClick={() => downloadCsv.mutate(p.id)}
                  >
                    {t('payouts.batches.download')}
                  </Button>
                  {p.status === 'draft' || p.status === 'exported' ? (
                    <Button size="sm" onClick={() => setConfirmId(p.id)}>
                      {t('payouts.batches.markPaid')}
                    </Button>
                  ) : null}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <AlertDialog open={confirmId !== null} onOpenChange={(open) => !open && setConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('payouts.batches.markPaid')}</AlertDialogTitle>
            <AlertDialogDescription>{t('payouts.batches.confirmPaid')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction disabled={markPaid.isPending} onClick={confirmPaid}>
              {t('payouts.batches.markPaid')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
