import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Copy } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import type { ReferralLink } from '@/finder/types';
import { useRevokeLink } from './useLinks';

interface LinkCardProps {
  link: ReferralLink;
  fullUrl?: string;
}

function formatCents(cents: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' }).format(new Date(iso));
}

export function LinkCard({ link, fullUrl }: LinkCardProps) {
  const { t } = useTranslation();
  const revoke = useRevokeLink();
  const [copied, setCopied] = useState(false);
  const url = fullUrl ?? `https://finders.fxl.com.br/r/${link.code}`;

  async function handleCopy() {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <code className="font-mono text-xs text-muted-foreground">{link.code}</code>
          <Badge variant={link.status === 'active' ? 'default' : 'secondary'}>
            {t(`finder.links.card.status.${link.status}`)}
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          <code className="flex-1 truncate rounded bg-muted px-2 py-1 font-mono text-xs">{url}</code>
          <Button type="button" variant="outline" size="sm" onClick={handleCopy}>
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            <span className="ml-1">
              {copied ? t('finder.links.card.copied') : t('finder.links.card.copy')}
            </span>
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">{t('finder.links.card.quotedSetup')}</p>
            <p>{formatCents(link.quotedSetupBrl)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{t('finder.links.card.quotedMonthly')}</p>
            <p>{formatCents(link.quotedMonthlyBrl)}</p>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            {t('finder.links.card.createdAt')}: {formatDate(link.createdAt)}
          </p>
          {link.status === 'active' ? (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button type="button" variant="ghost" size="sm" className="text-destructive">
                  {t('finder.links.card.revoke')}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t('finder.links.card.revoke')}</AlertDialogTitle>
                  <AlertDialogDescription>
                    {t('finder.links.card.revokeConfirm')}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => revoke.mutate({ linkId: link.id })}
                    disabled={revoke.isPending}
                  >
                    {t('finder.links.card.revoke')}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
