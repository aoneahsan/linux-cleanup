/**
 * Typed wrapper for every Tauri command and event in docs/CONTRACTS.md §2.
 * Outside the macleanup app (a plain browser) every command rejects with
 * `{ kind: 'not_in_app' }` and every listener is a no-op, so screens can show the
 * named "Run inside the macleanup app" state instead of fake data.
 */
import { invoke, isTauri as coreIsTauri } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';

export type AppErrorKind =
  | 'cli_missing' | 'cli_failed' | 'permission_denied' | 'not_found' | 'invalid_input' | 'io' | 'cancelled'
  | 'not_in_app' | 'unknown';

/** The serialised Rust `AppError`, plus the two kinds the UI adds. */
export interface AppError {
  kind: AppErrorKind;
  message: string;
}

export interface CliInfo { version: string; path: string; ok: boolean }
export interface SystemInfo { os_version: string; arch: string; ram_bytes: number; device_id: string }
export interface HealthInfo {
  full_disk_access: boolean | null;
  battery: { present: boolean; condition: string | null; cycle_count: number | null; charge_percent: number | null };
  smart_status: string | null;
}
export interface BackupStatus { configured: boolean; destinations: number; last_backup_ms: number | null; local_snapshots: number }
export interface ScheduleRunFile { file: string; scheduleId: string; startedMs: number; sizeBytes: number }
export interface DiskStatus { total_kb: number; free_kb: number; purgeable_kb: number | null; snapshots: number }
/** Settings passed to the CLI as flags (CONTRACTS §2). Absent keys keep the CLI defaults and ~/.macleanuprc. */
export interface RunOptions {
  idleDays?: number;
  cacheAgeDays?: number;
  unusedAppDays?: number;
  staleBuildDays?: number;
  largeFileDays?: number;
  largeFileSizeGb?: number;
  scanRoots?: string[];
  excludePaths?: string[];
  noSudo?: boolean;
}

export interface RunCliArgs {
  sections: number[];
  dryRun: boolean;
  deepOk: boolean;
  profile: string | null;
  /** Unique paths the user chose to keep (left in place). */
  keepPaths?: string[];
  /** Unique paths to archive to ~/.macleanup/archives/ before removal. */
  archivePaths?: string[];
  options?: RunOptions;
}
export interface LocalHistoryEntry { file: string; kind: 'report' | 'log'; modified_ms: number; size_bytes: number }
export interface ScheduleSpec {
  id: string;
  kind: 'preview' | 'cleanup';
  /** 0-6, or null for daily. Ignored when dayOfMonth is set. */
  weekday: number | null;
  /** 1-28 for a monthly schedule, else null. */
  dayOfMonth: number | null;
  hour: number;
  minute: number;
  sections: number[];
}

export interface CliEventPayload { runId: string; line: unknown }
export interface CliStderrPayload { runId: string; text: string }
export interface CliExitPayload { runId: string; code: number | null; cancelled: boolean }
export interface AskpassRequestPayload { requestId: string; prompt: string }
export interface OauthCallbackPayload { url: string }
export type MenuId = 'preferences' | 'check-updates' | 'new-preview' | 'history' | 'help' | 'about';
export interface MenuPayload { id: MenuId }

interface EventMap {
  'cli-event': CliEventPayload;
  'cli-stderr': CliStderrPayload;
  'cli-exit': CliExitPayload;
  'askpass-request': AskpassRequestPayload;
  'oauth-callback': OauthCallbackPayload;
  menu: MenuPayload;
}

/** True only inside the Tauri webview. */
export function isTauri(): boolean {
  try {
    return coreIsTauri();
  } catch {
    return false;
  }
}

const KNOWN: readonly AppErrorKind[] = [
  'cli_missing', 'cli_failed', 'permission_denied', 'not_found', 'invalid_input', 'io', 'cancelled', 'not_in_app',
];

/** Normalise anything a command can throw into an AppError. */
export function toAppError(error: unknown): AppError {
  if (typeof error === 'object' && error !== null && 'kind' in error) {
    const e = error as { kind: unknown; message?: unknown };
    const kind = KNOWN.includes(e.kind as AppErrorKind) ? (e.kind as AppErrorKind) : 'unknown';
    return { kind, message: typeof e.message === 'string' ? e.message : '' };
  }
  return { kind: 'unknown', message: error instanceof Error ? error.message : String(error) };
}

/** Narrow an unknown error to an AppError. */
export function isAppError(error: unknown): error is AppError {
  return typeof error === 'object' && error !== null && 'kind' in error && 'message' in error;
}

async function call<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  if (!isTauri()) throw { kind: 'not_in_app', message: command } satisfies AppError;
  try {
    return await invoke<T>(command, args);
  } catch (error) {
    throw toAppError(error);
  }
}

/** Every command in CONTRACTS §2, typed. */
export const commands = {
  cliInfo: () => call<CliInfo>('cli_info'),
  systemInfo: () => call<SystemInfo>('system_info'),
  diskStatus: () => call<DiskStatus>('disk_status'),
  healthInfo: () => call<HealthInfo>('health_info'),
  runCli: (args: RunCliArgs) => call<string>('run_cli', { ...args }),
  cancelRun: (runId: string) => call<void>('cancel_run', { runId }),
  askpassReply: (requestId: string, password: string | null) => call<void>('askpass_reply', { requestId, password }),
  listLocalHistory: (limit: number) => call<LocalHistoryEntry[]>('list_local_history', { limit }),
  openPath: (path: string) => call<void>('open_path', { path }),
  revealPath: (path: string) => call<void>('reveal_path', { path }),
  /** One-shot loopback listener; the redirect must carry `?n=<nonce>`. */
  oauthListen: () => call<{ port: number; nonce: string }>('oauth_listen'),
  scheduleList: () => call<ScheduleSpec[]>('schedule_list'),
  scheduleInstall: (spec: ScheduleSpec) => call<void>('schedule_install', { ...spec }),
  scheduleRemove: (id: string) => call<void>('schedule_remove', { id }),
  backupStatus: () => call<BackupStatus>('backup_status'),
  exportJson: (filename: string, content: string) => call<{ path: string }>('export_json', { filename, content }),
  setTrayMode: (enabled: boolean) => call<void>('set_tray_mode', { enabled }),
  listScheduleRuns: () => call<ScheduleRunFile[]>('list_schedule_runs'),
  readScheduleRun: (file: string) => call<string[]>('read_schedule_run', { file }),
  ackScheduleRun: (file: string) => call<void>('ack_schedule_run', { file }),
};

/** Subscribe to one Tauri event; a no-op outside the app. Always call the returned function. */
export async function on<K extends keyof EventMap>(event: K, handler: (payload: EventMap[K]) => void): Promise<UnlistenFn> {
  if (!isTauri()) return () => undefined;
  return listen<EventMap[K]>(event, (e) => handler(e.payload));
}

/**
 * Subscribe from a React effect. The listener registers asynchronously, so a
 * cleanup that runs first (StrictMode) still unsubscribes once registration lands.
 */
export function subscribe<K extends keyof EventMap>(event: K, handler: (payload: EventMap[K]) => void): () => void {
  let disposed = false;
  let unlisten: UnlistenFn | null = null;
  void on(event, handler).then((fn) => {
    if (disposed) fn();
    else unlisten = fn;
  });
  return () => {
    disposed = true;
    unlisten?.();
  };
}
