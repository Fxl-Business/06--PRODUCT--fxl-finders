import { useTranslation } from 'react-i18next';
import { Settings } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';

export function ConfigPage() {
  const { t } = useTranslation();

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-semibold">{t('nav.config')}</h2>
      </div>

      <EmptyState
        icon={Settings}
        title={t('empty.title')}
        description={t('empty.description')}
      />
    </div>
  );
}
