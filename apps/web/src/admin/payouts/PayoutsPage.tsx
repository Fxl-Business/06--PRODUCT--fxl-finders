import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Users, Wallet, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import type { ApiError } from '@/lib/api-client';
import { useCreatePayoutBatches, useFindersReady } from './usePayouts';

function brl(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/** Masks a CPF for display: 12345678901 → ***.456.789-** */
function maskCpf(cpf: string | null): string {
  if (!cpf) return '—';
  const digits = cpf.replace(/\D/g, '');
  if (digits.length !== 11) return cpf;
  return `***.${digits.slice(3, 6)}.${digits.slice(6, 9)}-**`;
}

/**
 * Admin "Finders ready for payout" page (Phase 06 T09, D-Q). Lists finders with
 * locked, not-yet-reserved commissions. Finders missing cpf/pix_key are SHOWN with a
 * "Sem CPF/PIX" badge and a DISABLED checkbox (cannot be selected) — never dropped.
 */
export function PayoutsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: finders, isLoading } = useFindersReady();
  const createBatches = useCreatePayoutBatches();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const list = useMemo(() => finders ?? [], [finders]);

  function toggle(finderId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(finderId)) next.delete(finderId);
      else next.add(finderId);
      return next;
    });
  }

  function createPayouts() {
    setError(null);
    const ids = [...selected];
    if (ids.length === 0) return;
    createBatches.mutate(ids, {
      onSuccess: () => {
        setSelected(new Set());
        navigate('/admin/payouts/batches');
      },
      onError: (err) => {
        const apiErr = err as unknown as ApiError;
        setError(
          apiErr.error === 'finder_not_payable'
            ? t('payouts.errors.notPayable')
            : t('payouts.errors.generic'),
        );
      },
    });
  }

  const totalReady = list.reduce((s, f) => s + (f.payable ? f.totalBrl : 0), 0);
  const blocked = list.filter((f) => !f.payable).length;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold">{t('payouts.findersReady')}</h2>

      <div className="grid gap-4 sm:grid-cols-3">
        <KPICard title={t('payouts.kpi.finders')} value={list.length} icon={Users} isLoading={isLoading} />
        <KPICard
          title={t('payouts.kpi.totalReady')}
          value={brl(totalReady)}
          icon={Wallet}
          isLoading={isLoading}
          colorScheme="success"
        />
        <KPICard
          title={t('payouts.kpi.blocked')}
          value={blocked}
          icon={AlertTriangle}
          isLoading={isLoading}
          colorScheme="warning"
        />
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <EmptyState title={t('payouts.empty')} />
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10" />
                <TableHead>{t('payouts.columns.finderName')}</TableHead>
                <TableHead>{t('payouts.columns.cpf')}</TableHead>
                <TableHead>{t('payouts.columns.pixKey')}</TableHead>
                <TableHead>{t('payouts.columns.pixKeyType')}</TableHead>
                <TableHead className="text-right">{t('payouts.columns.amount')}</TableHead>
                <TableHead className="text-right">{t('payouts.columns.commissionCount')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map((f) => (
                <TableRow key={f.finderId}>
                  <TableCell>
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-input accent-primary disabled:cursor-not-allowed disabled:opacity-50"
                      aria-label={f.finderName}
                      disabled={!f.payable}
                      checked={selected.has(f.finderId)}
                      onChange={() => toggle(f.finderId)}
                    />
                  </TableCell>
                  <TableCell className="font-medium">
                    {f.finderName}
                    {!f.payable ? (
                      <Badge variant="secondary" className="ml-2">
                        {t('payouts.notPayable')}
                      </Badge>
                    ) : null}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{maskCpf(f.cpf)}</TableCell>
                  <TableCell>{f.pixKey ?? '—'}</TableCell>
                  <TableCell>{f.pixKeyType ?? '—'}</TableCell>
                  <TableCell className="text-right font-medium">{brl(f.totalBrl)}</TableCell>
                  <TableCell className="text-right">{f.commissionIds.length}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="flex justify-end">
            <Button
              disabled={selected.size === 0 || createBatches.isPending}
              onClick={createPayouts}
            >
              {t('payouts.createBatch')}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
