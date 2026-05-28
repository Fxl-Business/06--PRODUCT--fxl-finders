import { useState } from 'react';
import { useTranslation } from 'react-i18next';
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
import { useAuditLog, useVerifyChain } from './useAuditLog';

export function AuditLogPage() {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const { data, isLoading } = useAuditLog(page);
  const verify = useVerifyChain();

  const entries = data?.entries ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold">{t('admin.audit.title')}</h2>
        <div className="flex items-center gap-3">
          {/* Per-page chain badge — labelled "Página" (page-scoped), NOT "Cadeia" (D-R NIT). */}
          {isLoading ? (
            <Skeleton className="h-6 w-28" />
          ) : data?.page_chain_valid ? (
            <Badge variant="default">{t('admin.audit.pageValid')}</Badge>
          ) : (
            <Badge variant="destructive">{t('admin.audit.pageBroken')}</Badge>
          )}
          <Button size="sm" variant="outline" disabled={verify.isPending} onClick={() => verify.mutate()}>
            {t('admin.audit.verifyFullChain')}
          </Button>
        </div>
      </div>

      {/* Authoritative whole-ledger result banner. */}
      {verify.data ? (
        verify.data.chain_valid ? (
          <div className="rounded-md border border-green-600/30 bg-green-600/10 px-4 py-3 text-sm text-green-700">
            {t('admin.audit.chainValid')}
          </div>
        ) : (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {t('admin.audit.chainBroken')} (#{verify.data.broken_at})
          </div>
        )
      ) : null}

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <EmptyState title={t('admin.audit.empty')} />
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('admin.audit.columns.ts')}</TableHead>
                <TableHead>{t('admin.audit.columns.actor')}</TableHead>
                <TableHead>{t('admin.audit.columns.action')}</TableHead>
                <TableHead>{t('admin.audit.columns.entity')}</TableHead>
                <TableHead>{t('admin.audit.columns.entityId')}</TableHead>
                <TableHead>{t('admin.audit.columns.requestId')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="whitespace-nowrap text-xs">
                    {new Date(e.ts).toLocaleString('pt-BR')}
                  </TableCell>
                  <TableCell>
                    {e.actorUserId === 'system' ? (
                      <Badge variant="secondary">{t('admin.audit.systemActor')}</Badge>
                    ) : (
                      <span className="font-mono text-xs text-muted-foreground">{e.actorUserId}</span>
                    )}
                  </TableCell>
                  <TableCell className="font-medium">{e.action}</TableCell>
                  <TableCell>{e.entityType}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{e.entityId}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {e.requestId ?? '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="flex items-center justify-end gap-2">
            <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              {t('common.previous')}
            </Button>
            <span className="text-sm text-muted-foreground">
              {t('admin.audit.pageN', { n: page })}
            </span>
            <Button
              size="sm"
              variant="outline"
              disabled={entries.length < 50}
              onClick={() => setPage((p) => p + 1)}
            >
              {t('common.next')}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
