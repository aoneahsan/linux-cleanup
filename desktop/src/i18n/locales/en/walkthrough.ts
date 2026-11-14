/** Walkthrough page (app-walkthrough.html). */
export default {
  dateline: 'Walkthrough · six screens · about two minutes',
  title: 'How a cleanup goes, start to finish.',
  lede: 'Each step below is a real screen of macleanup on a Mac.',
  try: 'Try it now',
  shot: 'Screenshot: {{title}}',
  stepLabel: 'Step {{n}}: {{title}}',
  s1: { h: 'Read the disk honestly', p: 'The Overview splits free space into used, purgeable and free, and notes when snapshots hold space.', b1: 'Snapshot-held space is named, not hidden', b2: 'Every figure says where it came from' },
  s2: { h: 'Pick the plates', p: 'Sections are numbered plates with a recovery stamp each.', b1: 'Filter by shelf or stamp', b2: 'The selection rides along the bottom' },
  s3: { h: 'Preview for free', p: 'The dry run lists every path and size and deletes nothing.', b1: 'Unique data gets keep, archive or delete', b2: 'Previews never use a monthly run' },
  s4: { h: 'Confirm on purpose', p: 'One screen starts a real run, after the typed word and the allowance check.', b1: 'Permanent sections need the word permanent', b2: 'The allowance line says what the run uses' },
  s5: { h: 'Watch it work', p: 'A lamp per section and the raw output beside it.', b1: 'Cancel stops after the current item', b2: 'Skipped is never counted as done' },
  s6: { h: 'Keep the receipt', p: 'Attempted, completed, skipped and failed, with before and after.', b1: 'Saved on this Mac with paths', b2: 'Synced as numbers only when signed in' },
  readyIdx: '§ 07',
  ready: 'Ready?',
  previewSafe: 'Preview the safe batch',
  manual: 'Read the manual ↗',
} as const;
