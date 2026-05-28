import { useTranslation } from 'react-i18next';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import type { ClickRow } from '@/finder/types';

interface ClicksTableProps {
  clicks: ClickRow[];
  isLoading: boolean;
}

function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(
    new Date(iso),
  );
}

function capitalize(s: string | null): string {
  if (!s) return '—';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function ClicksTable({ clicks, isLoading }: ClicksTableProps) {
  const { t } = useTranslation();

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-full" />
        ))}
      </div>
    );
  }

  if (clicks.length === 0) {
    return <EmptyState title={t('finder.clicks.empty')} description={t('finder.clicks.emptyDesc')} />;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t('finder.clicks.table.date')}</TableHead>
          <TableHead>{t('finder.clicks.table.browser')}</TableHead>
          <TableHead>{t('finder.clicks.table.origin')}</TableHead>
          <TableHead>{t('finder.clicks.table.country')}</TableHead>
          <TableHead>{t('finder.clicks.table.utmSource')}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {/* PRIVACY: never render click_id / ip_hash / link_id. */}
        {clicks.map((click) => (
          <TableRow key={click.id}>
            <TableCell>{formatDateTime(click.createdAt)}</TableCell>
            <TableCell>{capitalize(click.uaFamily)}</TableCell>
            <TableCell>{click.referer ?? '—'}</TableCell>
            <TableCell>{click.country ?? '—'}</TableCell>
            <TableCell>{click.utmSource ?? '—'}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
