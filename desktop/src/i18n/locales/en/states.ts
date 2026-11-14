/** Empty, error, offline and environment states. */
export default {
  notInApp: {
    title: 'Run inside the linux-cleanup app.',
    body: 'This screen reads your computer through the linux-cleanup desktop app. Open the app to preview, run and read receipts; a browser tab cannot reach your files.',
    action: 'Download linux-cleanup',
  },
  accountsOff: {
    title: 'Account service not configured.',
    body: 'This build has no account server ({{vars}} missing), so linux-cleanup runs local-only. Dry runs, runs, receipts, history, settings and schedules all work on this computer.',
  },
  cliMissing: {
    title: 'The bundled script failed its check.',
    body: 'The bundled linux-cleanup CLI is missing or incomplete, so the app will not run it. Reinstalling the app restores it. Dry runs and runs are paused until then.',
    fix: 'Reinstall the script',
    copy: 'Copy the check command',
  },
  permission: {
    title: 'Linux refused a folder.',
    body: 'The cleanup could not read a folder (permission denied). It skipped that folder, finished the rest and listed it on the receipt.',
    grant: 'How to grant access',
  },
  offline: {
    title: 'You are offline.',
    body: "Dry runs, runs and receipts work as normal. The account pool cannot be checked, so a real run uses this computer's pool. Run numbers sync when you are back online.",
    keepWorking: 'Keep working',
  },
  server: {
    title: 'The account server did not answer.',
    body: 'Your plan and history are safe. linux-cleanup retries in the background; sign-in and plan changes wait until it answers. Local work continues.',
    retry: 'Try again',
  },
  runFailed: {
    title: 'The cleanup failed.',
    body: 'The cleanup exited with an error: {{message}}. It is counted as failed, not completed. What it removed before the error is on the receipt.',
    receipt: 'Open the receipt',
    report: 'Report this problem ↗',
  },
  nothing: {
    title: 'Nothing to remove.',
    body: 'The dry run found no cache past its idle threshold. Nothing needs to run.',
    adjust: 'Adjust thresholds',
  },
  crash: {
    title: 'This screen stopped.',
    body: 'Something in the app failed while drawing this screen. Nothing on your computer was changed. Reload the screen, or go back to the Overview.',
    reload: 'Reload the screen',
    home: 'Back to the Overview',
  },
  notFound: {
    title: 'No screen at this address.',
    body: 'The link points at a screen this version of linux-cleanup does not have.',
    home: 'Back to the Overview',
  },
  deviceOwned: {
    title: 'This computer is linked to another linux-cleanup account.',
    body: 'Its monthly runs are counted on that account, so this account cannot use them. Dry runs still work. Give this computer a new id to start its own count here; the other account keeps its history.',
    action: 'Use a new id for this computer',
    done: 'This computer now has its own id on this account.',
  },
  loading: 'Loading…',
  copied: 'Copied.',
  genericError: 'That did not work: {{message}}',
} as const;
