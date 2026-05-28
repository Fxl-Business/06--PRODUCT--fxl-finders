import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { AppRow } from '@/admin/types';
import { useCreateApp, useUpdateApp } from './useApps';

interface AppDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  app?: AppRow;
}

/**
 * Outer dialog shell. The form body is a separate component mounted with a `key`
 * so its local state initializes fresh on each open (the React "reset state with
 * key" pattern — avoids resetting via an effect).
 */
export function AppDialog({ open, onOpenChange, app }: AppDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {open ? (
          <AppDialogForm key={app?.id ?? 'create'} app={app} onClose={() => onOpenChange(false)} />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function AppDialogForm({ app, onClose }: { app?: AppRow; onClose: () => void }) {
  const { t } = useTranslation();
  const isEdit = Boolean(app);
  const createApp = useCreateApp();
  const updateApp = useUpdateApp();

  const [slug, setSlug] = useState(app?.slug ?? '');
  const [name, setName] = useState(app?.name ?? '');
  const [hosts, setHosts] = useState((app?.allowedRedirectHosts ?? []).join('\n'));
  const [attributionWindowDays, setAttributionWindowDays] = useState(app?.attributionWindowDays ?? 30);
  const [commissionHoldDays, setCommissionHoldDays] = useState(app?.commissionHoldDays ?? 30);
  const [error, setError] = useState<string | null>(null);

  const pending = createApp.isPending || updateApp.isPending;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const allowedRedirectHosts = hosts
      .split('\n')
      .map((h) => h.trim())
      .filter((h) => h.length > 0);
    try {
      if (isEdit && app) {
        await updateApp.mutateAsync({
          id: app.id,
          data: { name, allowedRedirectHosts, attributionWindowDays, commissionHoldDays },
        });
      } else {
        await createApp.mutateAsync({
          slug,
          name,
          allowedRedirectHosts,
          attributionWindowDays,
          commissionHoldDays,
        });
      }
      onClose();
    } catch {
      setError(t('admin.apps.saveError'));
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{isEdit ? t('admin.apps.editTitle') : t('admin.apps.createTitle')}</DialogTitle>
        <DialogDescription>{t('admin.apps.dialogDesc')}</DialogDescription>
      </DialogHeader>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="app-slug">{t('admin.apps.field.slug')}</Label>
          <Input
            id="app-slug"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            disabled={isEdit}
            required={!isEdit}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="app-name">{t('admin.apps.field.name')}</Label>
          <Input id="app-name" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="app-hosts">{t('admin.apps.field.hosts')}</Label>
          <textarea
            id="app-hosts"
            value={hosts}
            onChange={(e) => setHosts(e.target.value)}
            rows={3}
            placeholder="checkout.fxlfinanciero.com.br"
            className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <p className="text-xs text-muted-foreground">{t('admin.apps.field.hostsHelp')}</p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="app-attr">{t('admin.apps.field.attributionWindowDays')}</Label>
            <Input
              id="app-attr"
              type="number"
              min={1}
              value={attributionWindowDays}
              onChange={(e) => setAttributionWindowDays(Number(e.target.value))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="app-hold">{t('admin.apps.field.commissionHoldDays')}</Label>
            <Input
              id="app-hold"
              type="number"
              min={1}
              value={commissionHoldDays}
              onChange={(e) => setCommissionHoldDays(Number(e.target.value))}
            />
          </div>
        </div>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? t('common.saving') : t('common.save')}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}
