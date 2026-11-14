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
  interrupted: 'The run was interrupted; unfinished sections are counted as failed.',
  cancelled: 'Cancelled by you; unfinished sections are listed as failed: interrupted.',
} as const;
