/**
 * The one logger. Nothing else in the app may call `console.*`. The default level
 * is `warn` in development and production; a log line never carries a password,
 * a token or a file path that came from the user's Mac.
 */
type Level = 'debug' | 'info' | 'warn' | 'error';
const ORDER: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const threshold: Level = 'warn';

function emit(level: Level, message: string, detail?: unknown): void {
  if (ORDER[level] < ORDER[threshold]) return;
  const line = `[macleanup] ${message}`;
  if (level === 'error') console.error(line, detail ?? '');
  else if (level === 'warn') console.warn(line, detail ?? '');
  else console.info(line, detail ?? '');
}

/** Structured app logger. */
export const logger = {
  debug: (message: string, detail?: unknown) => emit('debug', message, detail),
  info: (message: string, detail?: unknown) => emit('info', message, detail),
  warn: (message: string, detail?: unknown) => emit('warn', message, detail),
  error: (message: string, detail?: unknown) => emit('error', message, detail),
};
