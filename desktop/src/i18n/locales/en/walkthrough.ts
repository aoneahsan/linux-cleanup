/** Walkthrough page (click dummy app/walkthrough.html); captures in public/walkthrough/. */
export default {
  dateline: 'Walkthrough · six screens · about two minutes',
  title: 'How a cleanup goes, start to finish.',
  lede: 'Each step below is a real screen of linux-cleanup on a computer.',
  try: 'Try it now',
  shot: 'Screenshot: {{title}}',
  stepLabel: 'Step {{n}}: {{title}}',
  s1: { h: 'Read the disk plainly', p: 'The Overview shows used and free space on the volume that holds your home folder.', b1: 'Every figure says where it came from', b2: 'The protected folders are listed by name' },
  s2: { h: 'Dry-run for free', p: 'The dry run lists every path the all-safe cleanup would remove, with its size, and removes nothing.', b1: 'Refused paths are listed with the reason', b2: 'Dry runs never use a monthly run' },
  s3: { h: 'Read the list', p: 'The full list splits what would go from what stays, and can be saved as JSON.', b1: 'Sizes are measured, not estimated', b2: 'The list never leaves this computer' },
  s4: { h: 'Confirm on purpose', p: 'One screen starts a real run, after a recent dry run and the allowance check.', b1: 'It says plainly that removal is permanent', b2: 'The allowance line says what the run uses' },
  s5: { h: 'Watch it work', p: 'A lamp for the cleanup and the raw CLI output beside it.', b1: 'Cancel stops after the current step', b2: 'Skipped is never counted as done' },
  s6: { h: 'Keep the receipt', p: 'Attempted, completed, skipped and failed, with free space before and after.', b1: 'Saved on this computer with paths', b2: 'Synced as numbers only when signed in' },
  readyIdx: '§ 07',
  ready: 'Ready?',
  previewSafe: 'Dry-run the all-safe cleanup',
  manual: 'Read the manual ↗',
} as const;
