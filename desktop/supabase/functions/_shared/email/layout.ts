/**
 * The ONE email layout for linux-cleanup: the mark, one heading, a facts card, one button,
 * a plain-text part and the same footer. Nothing outside _shared/email/ writes email HTML.
 *
 * Colours: Survey Chartreuse, OKLCH hue 95 (~/.claude/palettes/project-palettes.json), converted
 * once to hex because mail clients do not support OKLCH. Contrast measured 2026-11-14.
 */

/** The signal fill oklch(0.80 0.15 95); dark ink on it measures 10.08:1 (AA). */
const ACCENT = '#DCBC33';
/** Ink used on the signal button. */
const ACCENT_INK = '#13120D';
/** Deep olive oklch(0.42 0.09 95) for links and the eyebrow on white: 8.45:1. */
const ACCENT_DEEP = '#5D4C00';
/** Tint and line for the facts card and logo tile. */
const SURFACE_TINT = '#FAF4DD';
const SURFACE_LINE = '#EEE5C3';
/** Ink and muted ink (18.8:1 and 9.2:1 on white). */
const INK = '#13120D';
const INK_MUTED = '#4A483F';
const PAGE = '#F6F4ED';
const FONT = "'Segoe UI',Ubuntu,Cantarell,'Noto Sans',Roboto,Helvetica,Arial,sans-serif";

/** Everything a composer hands the layout. Values are display text, never keys. */
export interface EmailContent {
  subject: string;
  preheader: string;
  eyebrow: string;
  heading: string;
  intro: string;
  facts: Array<[label: string, value: string]>;
  button: { label: string; url: string };
  /** Why this person gets the email; defaults to the account footer. */
  footer?: string;
}

/** The rendered message the transport sends. */
export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

/** Escape a value for HTML text and attribute positions. */
export function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/** FilesHub merge fields a stored template may use as its button link; FilesHub fills them at send time. */
const MERGE_LINKS = new Set(['{{confirm_url}}']);

/** Only an https: URL may become an href; anything else is refused. */
export function safeHref(url: string): string {
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:') throw new Error('Email links must be https.');
  return parsed.toString();
}

/** The product's live site, used for every link in the footer and the logo. */
export function siteUrl(): string {
  return Deno.env.get('APP_WEBSITE_URL') ?? 'https://linux-cleanup.aoneahsan.com';
}

function logoUrl(): string {
  return safeHref(Deno.env.get('EMAIL_LOGO_URL') ?? `${siteUrl()}/email/logo-56.png`);
}

const FOOTER_WHY = 'You get this email because of your linux-cleanup account.';
const FOOTER_STOP = 'Account emails like this one cannot be switched off. Deleting the account in the app stops them.';
const ACCOUNT_FOOTER = `${FOOTER_WHY} ${FOOTER_STOP}`;

/** Render the branded HTML and the plain-text part from the same content, in the same order. */
export function render(content: EmailContent): RenderedEmail {
  const href = MERGE_LINKS.has(content.button.url) ? content.button.url : safeHref(content.button.url);
  const footer = content.footer ?? ACCOUNT_FOOTER;
  const site = safeHref(siteUrl());
  const e = escapeHtml;
  const rows = content.facts.map(([label, value]) => `
          <tr>
            <td style="padding:8px 12px;border-bottom:1px solid ${SURFACE_LINE};color:${INK_MUTED};font:400 14px/1.4 ${FONT};">${e(label)}</td>
            <td style="padding:8px 12px;border-bottom:1px solid ${SURFACE_LINE};color:${INK};font:600 14px/1.4 ${FONT};text-align:right;word-break:break-word;overflow-wrap:anywhere;">${e(value)}</td>
          </tr>`).join('');

  const html = `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${e(content.subject)}</title>
<style>
  @media (max-width: 480px) { .card { padding: 20px !important; } }
  @media (prefers-color-scheme: dark) {
    .page { background: #07231A !important; }
    .card { background: #083327 !important; }
    .ink { color: #EEF8F4 !important; }
    .muted { color: #B5DBCC !important; }
    .facts { background: #004936 !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:${PAGE};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${e(content.preheader)}${'&#8199;&#65279;&#847;'.repeat(40)}</div>
<table role="presentation" class="page" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${PAGE};">
  <tr><td align="center" style="padding:24px 12px;">
    <table role="presentation" class="card" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background:#FFFFFF;border-radius:12px;padding:32px;">
      <tr><td style="padding-bottom:24px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
          <td style="background:${SURFACE_TINT};border-radius:8px;padding:4px;"><img src="${e(logoUrl())}" width="28" height="28" alt="linux-cleanup" style="display:block;border:0;"></td>
          <td class="ink" style="padding-left:10px;color:${INK};font:700 17px/1 ${FONT};">linux-cleanup</td>
        </tr></table>
      </td></tr>
      <tr><td class="muted" style="color:${ACCENT_DEEP};font:600 12px/1.4 ${FONT};letter-spacing:.06em;text-transform:uppercase;">${e(content.eyebrow)}</td></tr>
      <tr><td class="ink" style="padding-top:6px;color:${INK};font:700 24px/1.25 ${FONT};">${e(content.heading)}</td></tr>
      <tr><td class="muted" style="padding-top:12px;color:${INK_MUTED};font:400 16px/1.55 ${FONT};">${e(content.intro)}</td></tr>
      <tr><td style="padding-top:20px;">
        <table role="presentation" class="facts" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${SURFACE_TINT};border-radius:8px;">${rows}
        </table>
      </td></tr>
      <tr><td style="padding-top:24px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
          <td bgcolor="${ACCENT}" style="border-radius:8px;background:${ACCENT};">
            <a href="${e(href)}" style="display:inline-block;padding:14px 24px;color:${ACCENT_INK};font:600 16px/1.2 ${FONT};text-decoration:none;border-radius:8px;">${e(content.button.label)}</a>
          </td>
        </tr></table>
      </td></tr>
      <tr><td class="muted" style="padding-top:12px;color:${INK_MUTED};font:400 13px/1.5 ${FONT};word-break:break-all;">${e(href)}</td></tr>
      <tr><td class="muted" style="padding-top:28px;border-top:1px solid ${SURFACE_LINE};color:${INK_MUTED};font:400 13px/1.6 ${FONT};">
        The linux-cleanup team · <a href="${e(site)}privacy" style="color:${ACCENT_DEEP};">Privacy</a> · <a href="${e(site)}terms" style="color:${ACCENT_DEEP};">Terms</a> · <a href="${e(site)}" style="color:${ACCENT_DEEP};">linux-cleanup.aoneahsan.com</a><br>
        ${e(footer)}
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;

  const text = [
    content.heading,
    '',
    content.intro,
    '',
    ...content.facts.map(([label, value]) => `${label}: ${value}`),
    '',
    `${content.button.label}: ${href}`,
    '',
    '— The linux-cleanup team',
    `Privacy: ${site}privacy · Terms: ${site}terms · ${site}`,
    footer,
  ].join('\n');

  return { subject: content.subject, html, text };
}
