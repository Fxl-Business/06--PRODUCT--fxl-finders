import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link2, MousePointerClick, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { KPICard } from '@/components/ui/kpi-card';
import { Skeleton } from '@/components/ui/skeleton';
import type { ReferralLink } from '@/finder/types';
import { LinkCard } from './LinkCard';
import { LinkGeneratorForm } from './LinkGeneratorForm';
import { useFinderClickStats, useFinderLinks } from './useLinks';

export function LinksPage() {
  const { t } = useTranslation();
  const linksQuery = useFinderLinks();
  const statsQuery = useFinderClickStats();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [justGenerated, setJustGenerated] = useState<{ link: ReferralLink; fullUrl: string } | null>(
    null,
  );

  const links = linksQuery.data ?? [];
  const activeCount = links.filter((l) => l.status === 'active').length;
  const stats = statsQuery.data;

  function handleGenerated(link: ReferralLink, fullUrl: string) {
    setDialogOpen(false);
    setJustGenerated({ link, fullUrl });
  }

  const generateButton = (
    <Button type="button" onClick={() => setDialogOpen(true)}>
      {t('finder.links.generate')}
    </Button>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{t('finder.links.title')}</h1>
        {generateButton}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KPICard
          title={t('finder.links.kpi.active')}
          value={activeCount}
          icon={Link2}
          isLoading={linksQuery.isLoading}
          colorScheme="primary"
        />
        <KPICard
          title={t('finder.links.kpi.totalClicks')}
          value={stats?.total ?? '—'}
          icon={MousePointerClick}
          isLoading={statsQuery.isLoading}
        />
        <KPICard
          title={t('finder.links.kpi.uniqueClicks')}
          value={stats?.unique ?? '—'}
          icon={Users}
          isLoading={statsQuery.isLoading}
        />
      </div>

      {justGenerated ? (
        <div className="rounded-md border border-primary/30 bg-primary/5 p-4">
          <p className="mb-2 text-sm font-medium">{t('finder.links.justGenerated')}</p>
          <LinkCard link={justGenerated.link} fullUrl={justGenerated.fullUrl} />
        </div>
      ) : null}

      {linksQuery.isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : links.length === 0 ? (
        <EmptyState
          title={t('finder.links.empty')}
          description={t('finder.links.emptyDesc')}
          icon={Link2}
          action={generateButton}
        />
      ) : (
        <div className="space-y-3">
          {links.map((link) => (
            <LinkCard key={link.id} link={link} />
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('finder.links.generate')}</DialogTitle>
          </DialogHeader>
          <LinkGeneratorForm key={dialogOpen ? 'open' : 'closed'} onSuccess={handleGenerated} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
