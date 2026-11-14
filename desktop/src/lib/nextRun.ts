/**
 * When a schedule fires next, in the Mac's local time (LaunchAgent
 * StartCalendarInterval semantics: monthly day, else weekday, else daily).
 */
export interface Cadence {
  weekday: number | null;
  dayOfMonth: number | null;
  hour: number;
  minute: number;
}

/** The first firing strictly after `fromMs`. */
export function nextRun(c: Cadence, fromMs: number): number {
  const from = new Date(fromMs);
  const at = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), c.hour, c.minute, 0, 0);
  if (c.dayOfMonth) {
    for (let m = 0; m < 3; m += 1) {
      const t = new Date(from.getFullYear(), from.getMonth() + m, c.dayOfMonth, c.hour, c.minute, 0, 0);
      if (t.getTime() > fromMs) return t.getTime();
    }
  }
  for (let d = 0; d < 8; d += 1) {
    const day = at(new Date(from.getFullYear(), from.getMonth(), from.getDate() + d));
    if (day.getTime() <= fromMs) continue;
    if (c.weekday === null || day.getDay() === c.weekday) return day.getTime();
  }
  return fromMs;
}
