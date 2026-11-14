/** Empty, error, offline and environment states. */
export default {
  notInApp: {
    title: 'Run inside the macleanup app.',
    body: 'This screen reads your Mac through the macleanup desktop app. Open the app to preview, run and read receipts; a browser tab cannot reach your files.',
    action: 'Download macleanup',
  },
  accountsOff: {
    title: 'Account service not configured.',
    body: 'This build has no account server ({{vars}} missing), so macleanup runs local-only. Previews, runs, receipts, history, settings and schedules all work on this Mac.',
  },
  cliMissing: {
    title: 'The bundled script failed its check.',
    body: 'The checksum of macleanup.sh does not match this release, so the app will not run it. Reinstalling restores the right file. Previews and runs are paused until then.',
    fix: 'Reinstall the script',
    copy: 'Copy the check command',
  },
  permission: {
    title: 'macOS refused a folder.',
    body: 'A section could not read a protected folder. The section skipped it and finished the rest. Full Disk Access lets it measure protected folders.',
    grant: 'How to grant access',
  },
  offline: {
    title: 'You are offline.',
    body: "Previews, runs and receipts work as normal. The account pool cannot be checked, so a real run uses this Mac's pool. Run numbers sync when you are back online.",
    keepWorking: 'Keep working',
  },
  server: {
    title: 'The account server did not answer.',
    body: 'Your plan and history are safe. macleanup retries in the background; sign-in and plan changes wait until it answers. Local work continues.',
    retry: 'Try again',
  },
  runFailed: {
    title: 'A section failed.',
    body: 'Section {{id}} exited with an error: {{message}}. It is counted as failed, not completed. Every other section ran.',
    receipt: 'Open the receipt',
    report: 'Report this problem ↗',
  },
  nothing: {
    title: 'Nothing to remove.',
    body: 'The preview found nothing older than the age threshold in these sections. That is a good result; nothing needs to run.',
    adjust: 'Adjust thresholds',
  },
  crash: {
    title: 'This screen stopped.',
    body: 'Something in the app failed while drawing this screen. Nothing on your Mac was changed. Reload the screen, or go back to the Overview.',
    reload: 'Reload the screen',
    home: 'Back to the Overview',
  },
  notFound: {
    title: 'No screen at this address.',
    body: 'The link points at a screen this version of macleanup does not have.',
    home: 'Back to the Overview',
  },
  deviceOwned: {
    title: 'This Mac is linked to another macleanup account.',
    body: 'Its monthly runs are counted on that account, so this account cannot use them. Previews still work. Give this Mac a new id to start its own count here; the other account keeps its history.',
    action: 'Use a new id for this Mac',
    done: 'This Mac now has its own id on this account.',
  },
  loading: 'Loading…',
  copied: 'Copied.',
  genericError: 'That did not work: {{message}}',
} as const;
