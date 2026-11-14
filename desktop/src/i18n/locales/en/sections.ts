/** Section names. Linux streams one cleanup section (0) plus the read-only scan (1). */
export default {
  s0: { title: 'All-safe cleanup', what: 'Caches past their idle threshold, old logs and leftover temp files, outside the protected folders.' },
  s1: { title: 'Scan', what: 'Reads and measures the paths the cleanup checks. Removes nothing.' },
  allSafe: 'All-safe cleanup',
} as const;
