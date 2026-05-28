import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ProductDetail } from './ProductDetail';

/**
 * Route wrapper for /admin/products/:id — extracts the param and renders
 * ProductDetail (Phase 02, T07).
 */
export function ProductDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  if (!id) {
    return <p className="text-sm text-muted-foreground">{t('admin.products.notFound')}</p>;
  }
  return <ProductDetail productId={id} />;
}
