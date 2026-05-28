import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import type { CommissionStatus } from '@/lib/api-client';

const VARIANT: Record<CommissionStatus, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  pending: 'secondary',
  approved: 'outline', // forward-compat; v1.0 auto path never produces it (D-K)
  locked: 'default',
  paid: 'default',
  reversed: 'destructive',
};

/** Renders a commission status as a labelled pt-BR badge. */
export function CommissionStateBadge({ status }: { status: CommissionStatus }) {
  const { t } = useTranslation();
  return <Badge variant={VARIANT[status]}>{t(`admin.commissions.status.${status}`)}</Badge>;
}
