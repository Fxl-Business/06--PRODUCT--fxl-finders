import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { PriceBand, PriceBandComponent } from '@/admin/types';
import { useUpsertPriceBand } from './useProducts';

interface PriceBandFormProps {
  productId: string;
  component: PriceBandComponent;
  initialData?: PriceBand;
}

// Money is int cents at the API boundary; the form edits R$ (reais) floats.
const centsToReais = (cents: number) => (cents / 100).toFixed(2);
const reaisToCents = (reais: string) => Math.round(Number(reais) * 100);

export function PriceBandForm({ productId, component, initialData }: PriceBandFormProps) {
  const { t } = useTranslation();
  const upsert = useUpsertPriceBand(productId);

  const [min, setMin] = useState(initialData ? centsToReais(initialData.minBrl) : '');
  const [list, setList] = useState(initialData ? centsToReais(initialData.listBrl) : '');
  const [max, setMax] = useState(initialData ? centsToReais(initialData.maxBrl) : '');
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const minC = reaisToCents(min);
  const listC = reaisToCents(list);
  const maxC = reaisToCents(max);
  const valid =
    min !== '' &&
    list !== '' &&
    max !== '' &&
    Number.isFinite(minC) &&
    Number.isFinite(listC) &&
    Number.isFinite(maxC) &&
    minC >= 0 &&
    minC <= listC &&
    listC <= maxC;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return;
    setError(null);
    setSaved(false);
    try {
      await upsert.mutateAsync({ component, data: { minBrl: minC, listBrl: listC, maxBrl: maxC } });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setError(t('admin.products.priceBand.error'));
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t(`admin.products.priceBand.${component}`)}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor={`${component}-min`}>{t('admin.products.priceBand.min')}</Label>
            <Input
              id={`${component}-min`}
              type="number"
              step="0.01"
              min="0"
              value={min}
              onChange={(e) => setMin(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${component}-list`}>{t('admin.products.priceBand.list')}</Label>
            <Input
              id={`${component}-list`}
              type="number"
              step="0.01"
              min="0"
              value={list}
              onChange={(e) => setList(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${component}-max`}>{t('admin.products.priceBand.max')}</Label>
            <Input
              id={`${component}-max`}
              type="number"
              step="0.01"
              min="0"
              value={max}
              onChange={(e) => setMax(e.target.value)}
            />
          </div>
          {!valid && min !== '' && list !== '' && max !== '' ? (
            <p className="text-sm text-destructive">{t('admin.products.priceBand.invalidOrder')}</p>
          ) : null}
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button type="submit" disabled={!valid || upsert.isPending}>
            {saved ? t('admin.products.priceBand.saved') : t('common.save')}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
