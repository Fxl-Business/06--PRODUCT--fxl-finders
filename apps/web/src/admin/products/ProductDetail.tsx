import { useTranslation } from 'react-i18next';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { PriceBand } from '@/admin/types';
import { CommissionRuleForm } from './CommissionRuleForm';
import { PriceBandForm } from './PriceBandForm';
import { useAdminProduct } from './useProducts';

interface ProductDetailProps {
  productId: string;
}

export function ProductDetail({ productId }: ProductDetailProps) {
  const { t } = useTranslation();
  const { data, isLoading } = useAdminProduct(productId);

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!data) {
    return <p className="text-sm text-muted-foreground">{t('admin.products.notFound')}</p>;
  }

  const setupBand = data.priceBands.find((b: PriceBand) => b.component === 'setup');
  const monthlyBand = data.priceBands.find((b: PriceBand) => b.component === 'monthly');

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold">{data.product.name}</h2>
      <Tabs defaultValue="priceBands">
        <TabsList>
          <TabsTrigger value="priceBands">{t('admin.products.tabs.priceBands')}</TabsTrigger>
          <TabsTrigger value="commission">{t('admin.products.tabs.commission')}</TabsTrigger>
        </TabsList>
        <TabsContent value="priceBands">
          <div className="grid gap-4 md:grid-cols-2">
            <PriceBandForm productId={productId} component="setup" initialData={setupBand} />
            <PriceBandForm productId={productId} component="monthly" initialData={monthlyBand} />
          </div>
        </TabsContent>
        <TabsContent value="commission">
          <div className="max-w-md">
            <CommissionRuleForm productId={productId} initialData={data.commissionRule} />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
