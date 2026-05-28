import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useRotateSecretKey, useRotateWebhookSecret } from './useApps';

interface KeyRevealModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appId: string;
  keyType: 'secretKey' | 'webhookSecret';
}

/**
 * Reveal-once key rotation modal (Phase 02, T08).
 *
 * Flow: warn → confirm → rotate mutation → reveal plaintext once → copy → close.
 * The plaintext lives ONLY in this component's local state and is dropped when
 * the component unmounts on close (keyed remount per open). It is NEVER persisted
 * to localStorage/sessionStorage or any store — re-rotation is the only way to
 * retrieve it again.
 */
export function KeyRevealModal({ open, onOpenChange, appId, keyType }: KeyRevealModalProps) {
  // Keyed inner component → state resets fresh on each open (no reset effect).
  if (!open) return null;
  return (
    <KeyRevealModalBody
      key={`${appId}:${keyType}`}
      appId={appId}
      keyType={keyType}
      onClose={() => onOpenChange(false)}
    />
  );
}

function KeyRevealModalBody({
  appId,
  keyType,
  onClose,
}: {
  appId: string;
  keyType: 'secretKey' | 'webhookSecret';
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const rotateSecret = useRotateSecretKey();
  const rotateWebhook = useRotateWebhookSecret();

  const [revealed, setRevealed] = useState(false);
  const [plaintext, setPlaintext] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirmCloseOpen, setConfirmCloseOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pending = rotateSecret.isPending || rotateWebhook.isPending;

  async function handleConfirmRotate() {
    setError(null);
    try {
      if (keyType === 'secretKey') {
        const res = await rotateSecret.mutateAsync(appId);
        setPlaintext(res.secretKeyPlaintext);
      } else {
        const res = await rotateWebhook.mutateAsync(appId);
        setPlaintext(res.webhookSigningSecretPlaintext);
      }
      setRevealed(true);
    } catch {
      setError(t('admin.apps.keyReveal.rotateError'));
    }
  }

  async function handleCopy() {
    if (!plaintext) return;
    await navigator.clipboard.writeText(plaintext);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // Intercept close: if revealed but not yet copied, ask for confirmation.
  function requestClose(next: boolean) {
    if (next) return;
    if (revealed && !copied) {
      setConfirmCloseOpen(true);
      return;
    }
    onClose();
  }

  return (
    <>
      <Dialog open onOpenChange={requestClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('admin.apps.keyReveal.title')}</DialogTitle>
            <DialogDescription>
              {keyType === 'secretKey'
                ? t('admin.apps.keyReveal.warnSecret')
                : t('admin.apps.keyReveal.warnWebhook')}
            </DialogDescription>
          </DialogHeader>

          {!revealed ? (
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => requestClose(false)}>
                {t('common.cancel')}
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={pending}
                onClick={handleConfirmRotate}
              >
                {pending ? t('common.saving') : t('admin.apps.keyReveal.confirmRotate')}
              </Button>
            </DialogFooter>
          ) : (
            <div className="space-y-4">
              <div className="rounded-md border border-amber-400 bg-amber-50 p-3 text-sm text-amber-900">
                {t('admin.apps.keyReveal.warning')}
              </div>
              <code className="block break-all rounded-md bg-muted p-3 font-mono text-xs">
                {plaintext}
              </code>
              <div className="flex justify-between">
                <Button type="button" variant="outline" onClick={handleCopy}>
                  {copied ? t('admin.apps.keyReveal.copied') : t('admin.apps.keyReveal.copy')}
                </Button>
                <Button type="button" onClick={() => requestClose(false)}>
                  {t('admin.apps.keyReveal.close')}
                </Button>
              </div>
            </div>
          )}
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmCloseOpen} onOpenChange={setConfirmCloseOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('admin.apps.keyReveal.notCopiedWarning')}</AlertDialogTitle>
            <AlertDialogDescription>{t('admin.apps.keyReveal.warning')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('admin.apps.keyReveal.back')}</AlertDialogCancel>
            <AlertDialogAction onClick={onClose}>
              {t('admin.apps.keyReveal.closeAnyway')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
