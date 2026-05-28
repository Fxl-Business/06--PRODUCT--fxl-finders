import { useTranslation } from 'react-i18next';
import { Activity, TrendingUp, Users } from 'lucide-react';
import { KPICard } from '@/components/ui/kpi-card';
import { EmptyState } from '@/components/ui/empty-state';

export function HomePage() {
  const { t } = useTranslation();

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-semibold">{t('nav.home')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t('empty.description')}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <KPICard title="Total" value="—" icon={Activity} colorScheme="primary" />
        <KPICard title="Ativos" value="—" icon={Users} colorScheme="success" />
        <KPICard title="Crescimento" value="—" icon={TrendingUp} colorScheme="default" />
      </div>

      <EmptyState
        title={t('empty.title')}
        description={t('empty.description')}
      />
    </div>
  );
}
