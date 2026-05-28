import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Coins, Clock, Wallet } from 'lucide-react';
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
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
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
import { CommissionStateBadge } from './CommissionStateBadge';
import { useAdminCommissions, useLockCommission, useReverseCommission } from './useAdminCommissions';

function brl(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function CommissionsPage() {
  const { t } = useTranslation();
  const { data: commissions, isLoading } = useAdminCommissions();
  const lock = useLockCommission();
  const reverse = useReverseCommission();

  const [reverseId, setReverseId] = useState<string | null>(null);
  const [reason, setReason] = useState('');

  const list = commissions ?? [];
  const total = list.length;
  const pending = list.filter((c) => c.status === 'pending').length;
  const toPay = list.filter((c) => c.status === 'locked').reduce((s, c) => s + c.amountBrl, 0);

  function confirmReverse() {
    if (reverseId && reason.trim()) {
      reverse.mutate({ commissionId: reverseId, reason: reason.trim() });
      setReverseId(null);
      setReason('');
    }
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold">{t('admin.commissions.title')}</h2>

      <div className="grid gap-4 sm:grid-cols-3">
        <KPICard title={t('admin.commissions.kpi.total')} value={total} icon={Coins} isLoading={isLoading} />
        <KPICard
          title={t('admin.commissions.kpi.pending')}
          value={pending}
          icon={Clock}
          isLoading={isLoading}
          colorScheme="warning"
        />
        <KPICard
          title={t('admin.commissions.kpi.toLock')}
          value={brl(toPay)}
          icon={Wallet}
          isLoading={isLoading}
          colorScheme="success"
        />
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <EmptyState title={t('admin.commissions.empty')} />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('admin.commissions.columns.kind')}</TableHead>
              <TableHead className="text-right">{t('admin.commissions.columns.basis')}</TableHead>
              <TableHead className="text-right">{t('admin.commissions.columns.rate')}</TableHead>
              <TableHead className="text-right">{t('admin.commissions.columns.amount')}</TableHead>
              <TableHead>{t('admin.commissions.columns.status')}</TableHead>
              <TableHead>{t('admin.commissions.columns.holdUntil')}</TableHead>
              <TableHead className="text-right">{t('admin.commissions.columns.actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">
                  {t(`admin.commissions.kind.${c.kind}`)}
                </TableCell>
                <TableCell className="text-right">{brl(c.basisBrl)}</TableCell>
                <TableCell className="text-right">{Number(c.ratePct).toFixed(2)}%</TableCell>
                <TableCell className="text-right font-medium">{brl(c.amountBrl)}</TableCell>
                <TableCell>
                  <CommissionStateBadge status={c.status} />
                </TableCell>
                <TableCell>{new Date(c.holdUntil).toLocaleDateString('pt-BR')}</TableCell>
                <TableCell className="space-x-2 text-right">
                  {c.status === 'pending' ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={lock.isPending}
                      onClick={() => lock.mutate(c.id)}
                    >
                      {t('admin.commissions.actions.lock')}
                    </Button>
                  ) : null}
                  {c.status === 'pending' || c.status === 'locked' ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setReverseId(c.id);
                        setReason('');
                      }}
                    >
                      {t('admin.commissions.actions.reverse')}
                    </Button>
                  ) : null}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <AlertDialog open={reverseId !== null} onOpenChange={(open) => !open && setReverseId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('admin.commissions.actions.reverseConfirm')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('admin.commissions.actions.reverseReason')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t('admin.commissions.actions.reverseReason')}
          />
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction disabled={!reason.trim() || reverse.isPending} onClick={confirmReverse}>
              {t('admin.commissions.actions.reverse')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
