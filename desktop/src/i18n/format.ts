/** Intl format helpers, all on the decided English locale. */
import { FORMAT_LOCALE } from '@/i18n';

const KIB = 1024;

/** Kilobytes (1024-based, as macOS `df -k` reports) → "153.5 GiB". */
export function formatKb(kb: number): string {
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = kb;
  let unit = 0;
  while (Math.abs(value) >= KIB && unit < units.length - 1) {
    value /= KIB;
    unit += 1;
  }
  const digits = unit === 0 || value >= 100 ? 0 : 1;
  return `${new Intl.NumberFormat(FORMAT_LOCALE, { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(value)} ${units[unit]}`;
}

/** Kilobytes → GiB with one decimal, for the disk gauge. */
export function formatGiB(kb: number): string {
  return `${new Intl.NumberFormat(FORMAT_LOCALE, { maximumFractionDigits: 1, minimumFractionDigits: 1 }).format(kb / KIB / KIB)} GiB`;
}

/** A plain integer or decimal. */
export function formatNumber(n: number, digits = 0): string {
  return new Intl.NumberFormat(FORMAT_LOCALE, { maximumFractionDigits: digits }).format(n);
}

/** "Oct 27, 2026, 6:42 PM". */
export function formatDateTime(ms: number): string {
  return new Intl.DateTimeFormat(FORMAT_LOCALE, { dateStyle: 'medium', timeStyle: 'short' }).format(ms);
}

/** "Oct 27, 2026". */
export function formatDate(ms: number): string {
  return new Intl.DateTimeFormat(FORMAT_LOCALE, { dateStyle: 'medium' }).format(ms);
}

/** "Oct 27, 6:42 PM" — the status bar's short form. */
export function formatShortDateTime(ms: number): string {
  return new Intl.DateTimeFormat(FORMAT_LOCALE, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(ms);
}

/** Two-digit section plate, "05". */
export const plate = (n: number): string => String(n).padStart(2, '0');

/** A money amount from cents in the plan's currency. */
export function formatMoney(cents: number, currency = 'USD'): string {
  return new Intl.NumberFormat(FORMAT_LOCALE, { style: 'currency', currency, maximumFractionDigits: cents % 100 === 0 ? 0 : 2 }).format(cents / 100);
}
