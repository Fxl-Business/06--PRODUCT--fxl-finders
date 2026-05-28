import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { MousePointerClick, Percent, Users, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { KPICard } from '@/components/ui/kpi-card';
import { ClicksTable } from './ClicksTable';
import { useFinderClicks, useFinderClickStats } from './useClicks';

export function ClicksPage() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const linkId = searchParams.get('linkId') ?? undefined;

  const clicksQuery = useFinderClicks(linkId);
  const statsQuery = useFinderClickStats();
  const clicks = clicksQuery.data ?? [];
  const stats = statsQuery.data;

  function clearFilter() {
    const next = new URLSearchParams(searchParams);
    next.delete('linkId');
    setSearchParams(next);
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">{t('finder.clicks.title')}</h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KPICard
          title={t('finder.clicks.kpi.total')}
          value={stats?.total ?? '—'}
          icon={MousePointerClick}
          isLoading={statsQuery.isLoading}
        />
        <KPICard
          title={t('finder.clicks.kpi.unique')}
          value={stats?.unique ?? '—'}
          icon={Users}
          isLoading={statsQuery.isLoading}
        />
        {/* Conversion rate is a Phase 05 placeholder — always '—', never a number. */}
        <KPICard
          title={t('finder.clicks.kpi.conversionRate')}
          value="—"
          icon={Percent}
          isLoading={false}
        />
      </div>

      {linkId ? (
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">{t('finder.clicks.filterLabel')}</span>
          <Button type="button" variant="outline" size="sm" onClick={clearFilter}>
            <X className="mr-1 h-3 w-3" />
            {t('finder.clicks.clearFilter')}
          </Button>
        </div>
      ) : null}

      <ClicksTable clicks={clicks} isLoading={clicksQuery.isLoading} />
    </div>
  );
}
