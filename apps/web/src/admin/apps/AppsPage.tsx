import { useState } from 'react';
import { useTranslation } from 'react-i18next';
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
import type { AppRow } from '@/admin/types';
import { AppDialog } from './AppDialog';
import { KeyRevealModal } from './KeyRevealModal';
import { useAdminApps, useSetAppStatus } from './useApps';

export function AppsPage() {
  const { t } = useTranslation();
  const { data: apps, isLoading } = useAdminApps();
  const setStatus = useSetAppStatus();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editApp, setEditApp] = useState<AppRow | undefined>(undefined);
  const [revealOpen, setRevealOpen] = useState(false);
  const [revealAppId, setRevealAppId] = useState<string>('');
  const [revealKeyType, setRevealKeyType] = useState<'secretKey' | 'webhookSecret'>('secretKey');

  function openCreate() {
    setEditApp(undefined);
    setDialogOpen(true);
  }

  function openEdit(app: AppRow) {
    setEditApp(app);
    setDialogOpen(true);
  }

  function openReveal(appId: string, keyType: 'secretKey' | 'webhookSecret') {
    setRevealAppId(appId);
    setRevealKeyType(keyType);
    setRevealOpen(true);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold">{t('admin.apps.heading')}</h2>
        <Button onClick={openCreate}>{t('admin.apps.create')}</Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : !apps || apps.length === 0 ? (
        <EmptyState
          title={t('admin.apps.empty')}
          description={t('admin.apps.emptyDesc')}
          action={<Button onClick={openCreate}>{t('admin.apps.create')}</Button>}
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('admin.apps.col.name')}</TableHead>
              <TableHead>{t('admin.apps.col.slug')}</TableHead>
              <TableHead>{t('admin.apps.col.publishableKey')}</TableHead>
              <TableHead>{t('admin.apps.col.secretKey')}</TableHead>
              <TableHead>{t('admin.apps.col.status')}</TableHead>
              <TableHead className="text-right">{t('admin.apps.col.actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {apps.map((app) => (
              <TableRow key={app.id}>
                <TableCell className="font-medium">{app.name}</TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">{app.slug}</TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {app.publishableKey}
                </TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {app.secretKeyPrefix}
                </TableCell>
                <TableCell>
                  <Badge variant={app.status === 'active' ? 'default' : 'secondary'}>
                    {t(`admin.status.${app.status}`)}
                  </Badge>
                </TableCell>
                <TableCell className="space-x-2 text-right">
                  <Button size="sm" variant="outline" onClick={() => openEdit(app)}>
                    {t('common.edit')}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setStatus.mutate({
                        id: app.id,
                        status: app.status === 'active' ? 'disabled' : 'active',
                      })
                    }
                  >
                    {app.status === 'active' ? t('admin.apps.disable') : t('admin.apps.enable')}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => openReveal(app.id, 'secretKey')}>
                    {t('admin.apps.rotateSecret')}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openReveal(app.id, 'webhookSecret')}
                  >
                    {t('admin.apps.rotateWebhook')}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <AppDialog open={dialogOpen} onOpenChange={setDialogOpen} app={editApp} />
      <KeyRevealModal
        open={revealOpen}
        onOpenChange={setRevealOpen}
        appId={revealAppId}
        keyType={revealKeyType}
      />
    </div>
  );
}
