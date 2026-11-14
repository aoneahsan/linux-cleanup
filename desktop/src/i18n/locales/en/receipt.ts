/** Receipt slips and the receipt screen. */
export default {
  real: 'REAL RUN',
  preview: 'PREVIEW',
  attempted: 'attempted',
  completed: 'completed',
  skipped: 'skipped',
  failed: 'failed',
  freeSpace: 'Free space · {{value}}',
  freeChange: '{{before}} → {{after}}',
  nothingDeleted: 'Nothing deleted',
  sectionsLine: 'Sections {{ids}}',
  interrupted: 'The run was interrupted; the unfinished step is counted as failed.',
  cancelled: 'Cancelled by you; the unfinished step is listed as failed: interrupted.',
} as const;
