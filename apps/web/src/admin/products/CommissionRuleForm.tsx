import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { CommissionBasis, CommissionRule } from '@/admin/types';
import { useUpsertCommissionRule } from './useProducts';

interface CommissionRuleFormProps {
  productId: string;
  initialData?: CommissionRule;
}

export function CommissionRuleForm({ productId, initialData }: CommissionRuleFormProps) {
  const { t } = useTranslation();
  const upsert = useUpsertCommissionRule(productId);

  const [setupRatePct, setSetupRatePct] = useState(initialData?.setupRatePct ?? '0');
  const [recurringRatePct, setRecurringRatePct] = useState(initialData?.recurringRatePct ?? '0');
  const [recurringMonths, setRecurringMonths] = useState(String(initialData?.recurringMonths ?? 0));
  const [basis, setBasis] = useState<CommissionBasis>(initialData?.basis ?? 'quoted_net');
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    try {
      await upsert.mutateAsync({
        setupRatePct: Number(setupRatePct),
        recurringRatePct: Number(recurringRatePct),
        recurringMonths: Number(recurringMonths),
        basis,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setError(t('admin.products.commission.error'));
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('admin.products.commission.title')}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="setup-rate">{t('admin.products.commission.setupRate')}</Label>
            <Input
              id="setup-rate"
              type="number"
              step="0.01"
              min="0"
              max="100"
              value={setupRatePct}
              onChange={(e) => setSetupRatePct(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="recurring-rate">{t('admin.products.commission.recurringRate')}</Label>
            <Input
              id="recurring-rate"
              type="number"
              step="0.01"
              min="0"
              max="100"
              value={recurringRatePct}
              onChange={(e) => setRecurringRatePct(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="recurring-months">{t('admin.products.commission.recurringMonths')}</Label>
            <Input
              id="recurring-months"
              type="number"
              min="0"
              value={recurringMonths}
              onChange={(e) => setRecurringMonths(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="basis">{t('admin.products.commission.basis')}</Label>
            <Select value={basis} onValueChange={(v) => setBasis(v as CommissionBasis)}>
              <SelectTrigger id="basis">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="quoted_net">{t('admin.products.commission.basisQuoted')}</SelectItem>
                <SelectItem value="list_net">{t('admin.products.commission.basisList')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button type="submit" disabled={upsert.isPending}>
            {saved ? t('admin.products.commission.saved') : t('common.save')}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
