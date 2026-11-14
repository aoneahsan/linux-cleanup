import { useState } from 'react';
import { Btn, StateCard } from '@/components/ui/primitives';
import { useT, translate } from '@/i18n';
import { refreshAllowance, replaceDeviceId } from '@/services/account';
import { toast } from '@/lib/feedback';

/** 403 device_owned: this Mac's id belongs to another account. One action: take a fresh id. */
export function DeviceOwned() {
  const t = useT();
  const [busy, setBusy] = useState(false);
  return (
    <StateCard tone="offline" icon="person" title={t('states.deviceOwned.title')} actions={
      <Btn icon="refresh" isDisabled={busy} onPress={() => {
        setBusy(true);
        replaceDeviceId();
        void refreshAllowance()
          .then(() => toast(translate('states.deviceOwned.done')))
          .catch(() => toast(translate('help.errors.stillNo')))
          .finally(() => setBusy(false));
      }}>{t('states.deviceOwned.action')}</Btn>
    }>
      {t('states.deviceOwned.body')}
    </StateCard>
  );
}
