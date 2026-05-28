import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { ProductListRow } from '@/admin/types';
import { ProductDialog } from './ProductDialog';
import { useAdminProducts } from './useProducts';

export function ProductsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: products, isLoading } = useAdminProducts();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editProduct, setEditProduct] = useState<ProductListRow | undefined>(undefined);

  function openCreate() {
    setEditProduct(undefined);
    setDialogOpen(true);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold">{t('admin.products.heading')}</h2>
        <Button onClick={openCreate}>{t('admin.products.create')}</Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : !products || products.length === 0 ? (
        <EmptyState
          title={t('admin.products.empty')}
          description={t('admin.products.emptyDesc')}
          action={<Button onClick={openCreate}>{t('admin.products.create')}</Button>}
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('admin.products.col.name')}</TableHead>
              <TableHead>{t('admin.products.col.slug')}</TableHead>
              <TableHead>{t('admin.products.col.app')}</TableHead>
              <TableHead>{t('admin.products.col.status')}</TableHead>
              <TableHead className="text-right">{t('admin.products.col.actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.map((product) => (
              <TableRow key={product.id}>
                <TableCell className="font-medium">{product.name}</TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {product.slug}
                </TableCell>
                <TableCell>{product.appName}</TableCell>
                <TableCell>
                  <Badge variant={product.status === 'active' ? 'default' : 'secondary'}>
                    {t(`admin.status.${product.status}`)}
                  </Badge>
                </TableCell>
                <TableCell className="space-x-2 text-right">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setEditProduct(product);
                      setDialogOpen(true);
                    }}
                  >
                    {t('common.edit')}
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => navigate(`/admin/products/${product.id}`)}
                  >
                    {t('admin.products.manage')}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <ProductDialog open={dialogOpen} onOpenChange={setDialogOpen} product={editProduct} />
    </div>
  );
}
