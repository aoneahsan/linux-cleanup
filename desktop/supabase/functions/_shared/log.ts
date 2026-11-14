/**
 * The one logger for Edge Functions. Deno's console is the platform's server-side log
 * stream, so this is the only file allowed to touch it. One JSON line per event; never
 * pass a secret, a token, an email body or a request payload as a field.
 */
type Level = 'info' | 'warn' | 'error';

/** Write one structured log line. `fields` must hold identifiers and codes only. */
export function log(level: Level, event: string, fields: Record<string, unknown> = {}): void {
  const line = JSON.stringify({ level, event, at: new Date().toISOString(), ...fields });
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.info(line);
}
