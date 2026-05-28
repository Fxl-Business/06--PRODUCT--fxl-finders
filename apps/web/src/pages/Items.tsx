import { useTranslation } from 'react-i18next';
import { ListTodo } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';

export function ItemsPage() {
  const { t } = useTranslation();

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-semibold">{t('nav.items')}</h2>
      </div>

      <EmptyState
        icon={ListTodo}
        title={t('empty.title')}
        description={t('empty.description')}
      />
    </div>
  );
}
