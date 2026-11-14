import { EMAIL_COPY as C } from './catalogue.ts';
import { render, type RenderedEmail, siteUrl } from './layout.ts';

/** The project's formatting locale; times are always stated in UTC. */
const LOCALE = 'en-GB';

/** '29 October 2026 (UTC)'. */
export function formatDate(iso: string): string {
  const day = new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(iso));
  return `${day} (UTC)`;
}

/** '$36.00' from integer cents. */
export function formatMoney(cents: number, currency: string): string {
  return new Intl.NumberFormat(LOCALE, { style: 'currency', currency: currency.toUpperCase() }).format(cents / 100);
}

const link = (path: string) => new URL(path, siteUrl()).toString();

/** Welcome: sent once, after an anonymous device links a Google account. */
export function welcomeEmail(d: { email: string; deviceRuns: number; accountRuns: number }): RenderedEmail {
  const w = C.welcome;
  return render({
    subject: w.subject, preheader: w.intro(d.accountRuns, d.deviceRuns), eyebrow: w.eyebrow, heading: w.heading,
    intro: w.intro(d.accountRuns, d.deviceRuns),
    facts: [[w.facts.account, d.email], [w.facts.runs, String(d.deviceRuns + d.accountRuns)], [w.facts.previews, w.facts.unlimited]],
    button: { label: w.button, url: link('/download') },
  });
}

/** Receipt for a paid period, at the database price. */
export function receiptEmail(d: {
  planName: string; interval: string; amountCents: number; currency: string;
  periodStart: string; periodEnd: string; seats: number;
}): RenderedEmail {
  const r = C.receipt;
  const facts: Array<[string, string]> = [
    [r.facts.plan, `${d.planName} · ${C.intervals[d.interval] ?? d.interval}`],
    [r.facts.amount, formatMoney(d.amountCents, d.currency)],
    [r.facts.period, `${formatDate(d.periodStart)} – ${formatDate(d.periodEnd)}`],
  ];
  if (d.seats > 1) facts.push([r.facts.seats, String(d.seats)]);
  facts.push([r.facts.paidWith, r.paidWith]);
  return render({
    subject: r.subject(d.planName), preheader: r.intro, eyebrow: r.eyebrow, heading: r.heading(d.planName),
    intro: r.intro, facts, button: { label: r.button, url: link('/download') },
  });
}

/** A payment the bank or provider returned: the period it paid for has ended. */
export function returnedEmail(d: {
  planName: string; interval: string; amountCents: number; currency: string; planNow: string;
}): RenderedEmail {
  const r = C.returned;
  return render({
    subject: r.subject, preheader: r.heading, eyebrow: r.eyebrow, heading: r.heading, intro: r.intro(d.planName),
    facts: [
      [r.facts.plan, `${d.planName} · ${C.intervals[d.interval] ?? d.interval}`],
      [r.facts.amount, formatMoney(d.amountCents, d.currency)],
      [r.facts.planNow, d.planNow],
    ],
    button: { label: r.button, url: link('/pricing') },
  });
}

/** To the referrer, when a friend's account is confirmed. */
export function referralEmail(d: { points: number; confirmed: number; threshold: number; rewarded: boolean }): RenderedEmail {
  const r = C.referral;
  return render({
    subject: r.subject, preheader: r.heading, eyebrow: r.eyebrow, heading: r.heading,
    intro: r.intro(d.confirmed, d.threshold, d.rewarded),
    facts: [
      [r.facts.points, `+${d.points}`],
      [r.facts.confirmed, String(d.confirmed)],
      [r.facts.reward, d.rewarded ? r.rewardYes : r.rewardNotYet],
    ],
    button: { label: r.button, url: link('/download') },
  });
}

/** To an invitee. The link opens the app; acceptance needs the invited Google account. */
export function inviteEmail(d: { teamName: string; invitedBy: string }): RenderedEmail {
  const i = C.invite;
  return render({
    subject: i.subject, preheader: i.heading(d.teamName), eyebrow: i.eyebrow, heading: i.heading(d.teamName),
    intro: i.intro,
    facts: [[i.facts.team, d.teamName], [i.facts.invitedBy, d.invitedBy], [i.facts.seat, i.seatMember]],
    button: { label: i.button, url: link('/download') },
  });
}

/** '153.5 GiB' from kilobytes (1 GiB = 1024 × 1024 KB), one decimal, in the formatting locale. */
export function formatGiB(kb: number): string {
  const gib = kb / (1024 * 1024);
  return `${new Intl.NumberFormat(LOCALE, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(gib)} GiB`;
}

/**
 * A scheduled run finished. Wording from the dummy's sixth email (emails.html, "Scheduled
 * run finished"). `name` is the schedule's display name, `ranAt` and `nextRun` are display
 * times already formatted for the reader (e.g. '09:00', 'Monday 09:00').
 */
export function scheduleFinishedEmail(d: {
  name: string; ranAt: string; attempted: number; completed: number;
  freeBeforeKb: number; freeAfterKb: number; nextRun: string;
}): RenderedEmail {
  const s = C.schedule;
  const freeBefore = formatGiB(d.freeBeforeKb).replace(' GiB', '');
  return render({
    subject: s.subject(d.name), preheader: s.heading, eyebrow: s.eyebrow, heading: s.heading,
    intro: s.intro(d.name, d.ranAt),
    facts: [
      [s.facts.sections, s.sectionCounts(d.attempted, d.completed)],
      [s.facts.freeSpace, `${freeBefore} → ${formatGiB(d.freeAfterKb)}`],
      [s.facts.nextRun, d.nextRun],
    ],
    button: { label: s.button, url: link('/download') },
  });
}

/**
 * The double opt-in confirmation FilesHub sends for the "linux-cleanup releases" list. Stored once as a FilesHub
 * template; FilesHub fills {{confirm_url}} per sign-up.
 */
export function confirmNewsEmail(): RenderedEmail {
  const c = C.confirmNews;
  return render({
    subject: c.subject, preheader: c.intro, eyebrow: c.eyebrow, heading: c.heading, intro: c.intro,
    facts: [[c.facts.list, c.facts.listName], [c.facts.often, c.facts.oftenValue], [c.facts.stop, c.facts.stopValue]],
    button: { label: c.button, url: '{{confirm_url}}' },
    footer: c.footer,
  });
}
