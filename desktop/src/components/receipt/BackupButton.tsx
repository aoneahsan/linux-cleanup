import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { Btn, TagChip, goTo } from '@/components/ui/primitives';
import { useT, translate } from '@/i18n';
import { usePlans } from '@/hooks/usePlans';
import { backupOne, mayBackUp, type BackupOutcome } from '@/services/autoBackup';
import { toast } from '@/lib/feedback';
import type { Receipt } from '@/stores/receipts';

/** The receipt page's "Back up this receipt" (Pro). Free or signed out goes to Receipt backups, which explains Pro. */
export function BackupButton({ receipt }: { receipt: Receipt }) {
  const t = useT();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const pro = usePlans().data?.find((p) => p.id === 'pro');
  const done = Boolean(receipt.backedUp);
  const say = (o: BackupOutcome) => {
    if (o === 'done' || o === 'duplicate') toast(translate('backups.receipt.done'));
    else if (o === 'full') toast(pro?.receipt_backup_max ? translate('backups.receipt.full', { n: pro.receipt_backup_max }) : translate('backups.receipt.fullPlain'));
    else if (o === 'owned') toast(translate('backups.receipt.owned'));
    else if (o === 'offline') toast(translate('backups.receipt.offline'));
    else if (o === 'plan' || o === 'signin') goTo(navigate, '/backups');
    else toast(translate('backups.receipt.failed'));
  };
  return (
    <Btn icon="cloudup" isDisabled={done || busy} aria-busy={busy} onPress={() => {
      if (!mayBackUp()) { goTo(navigate, '/backups'); return; }
      setBusy(true);
      void backupOne(receipt).then(say).finally(() => setBusy(false));
    }}>
      <span>{done ? t('backups.receipt.backedUp') : busy ? t('backups.receipt.working') : t('backups.receipt.backUp')}</span>
      <TagChip tone="pro">{t('backups.proTag')}</TagChip>
    </Btn>
  );
}
