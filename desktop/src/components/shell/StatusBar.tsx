import { useT } from '@/i18n';
import { env } from '@/config/env';
import { formatShortDateTime } from '@/i18n/format';
import { AppLink } from '@/components/ui/primitives';
import { useCliInfo, useLocalHistory } from '@/hooks/useLocal';
import { useOnline } from '@/hooks/useOnline';
import { useUpdateState } from '@/stores/update';
import { useAllowanceSummary } from '@/stores/allowance';
import { useReceipts } from '@/stores/receipts';

/** Footer status bar: CLI version from cli_info, last run, runs left, update state. */
export function StatusBar() {
  const t = useT();
  const cli = useCliInfo();
  const history = useLocalHistory(1);
  const online = useOnline();
  const update = useUpdateState((s) => s.status);
  const updateVersion = useUpdateState((s) => s.version);
  const runs = useAllowanceSummary();
  const lastReceipt = useReceipts((s) => s.receipts[0]?.at ?? null);
  const lastMs = lastReceipt ?? history.data?.[0]?.modified_ms ?? null;

  const cliText = cli.data
    ? t(cli.data.ok ? 'shell.status.cliOk' : 'shell.status.cliBad', { version: cli.data.version, app: env.appVersion })
    : t('shell.status.cliUnknown', { app: env.appVersion });

  return (
    <footer className="statusbar">
      <span>
        <span className={`lamp${cli.data && !cli.data.ok ? ' warn' : ''}`} />
        {cliText}
      </span>
      <span>{lastMs ? t('shell.status.lastRun', { when: formatShortDateTime(lastMs) }) : t('shell.status.noRunYet')}</span>
      {runs ? <span>{runs.unlimited ? t('shell.status.noLimit') : t('shell.status.runsLeft', { count: runs.left })}</span> : null}
      <span>
        {t('shell.status.updates')}{' '}
        <AppLink to="/updates">
          {update === 'available' && updateVersion
            ? t('shell.status.updateReady', { version: updateVersion })
            : update === 'current'
              ? t('shell.status.updateCurrent')
              : t('shell.status.updatesCheck')}
        </AppLink>
      </span>
      {!online ? <span className="status-offline">{t('shell.status.offline')}</span> : null}
    </footer>
  );
}
