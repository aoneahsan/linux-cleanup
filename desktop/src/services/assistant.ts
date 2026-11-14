/**
 * The Explain-my-preview assistant client (CONTRACTS §3 "Assistant (2026-10-30)", docs/AI.md).
 * One Edge Function, three routes: GET assistant/status, POST assistant/ask and POST
 * assistant/transcribe. The request carries ONLY the allow-listed preview numbers: section
 * id, planned KB, recovery tier, item count and status, plus the person's question. It
 * never carries a path, a file name, an item label or a section title (the server holds
 * the titles). Audio goes up once to be transcribed and is not stored.
 */
import { AccountError, callFunction, getDeviceId, hasCode } from '@/services/account';
import type { Stamp, SectionState } from '@/lib/events';

/** The level a person sees; never a model or provider name. */
export type AssistantLevel = 'spark' | 'pulse' | 'surge';

/** The monthly counters every assistant response carries. */
export interface AssistantCounters {
  questions_left: number;
  questions_limit: number;
  month: string;
  resets_at: string;
}

export interface AssistantStatus extends AssistantCounters {
  level: AssistantLevel;
  /** Set while the assistant rests (no free credit and no paid fallback); ISO instant. */
  paused_until: string | null;
}

/** One preview section, exactly the server's allow-list. */
export interface AssistantSection {
  id: number;
  planned_kb: number;
  tier: Stamp;
  item_count: number;
  status: SectionState;
}

export type AskResult =
  | ({ ok: true; answer: string; sources: string[]; level: AssistantLevel } & AssistantCounters)
  | ({ ok: false; reason: 'limit_reached'; level: AssistantLevel } & AssistantCounters)
  | { ok: false; reason: 'paused' };

export type TranscribeResult =
  | { ok: true; transcript: string }
  | ({ ok: false; reason: 'limit_reached' } & AssistantCounters)
  | { ok: false; reason: 'paused' };

/** Server caps, mirrored so the UI can stop early; the server enforces them. */
export const ASSISTANT_LIMITS = { questionChars: 500, recordingMs: 30_000, recordingBytes: 1_500_000 } as const;

/** TanStack Query key for the status; invalidate it after every ask or transcribe. */
export const assistantStatusKey = ['assistant', 'status'] as const;

/** Read once per stale window (10 min), never on a loop. */
export const ASSISTANT_STATUS_STALE_MS = 10 * 60_000;

/** GET assistant/status: level, questions left this month and the paused-until time. */
export async function assistantStatus(): Promise<AssistantStatus> {
  return callFunction<AssistantStatus>('assistant/status', { method: 'GET', query: { device_id: await getDeviceId() } });
}

/** Keep only the allow-listed fields, whatever object the caller hands in. */
function allowListed(sections: readonly AssistantSection[]): AssistantSection[] {
  return sections.map((s) => ({
    id: s.id,
    planned_kb: Math.max(0, Math.round(s.planned_kb)),
    tier: s.tier,
    item_count: Math.max(0, Math.round(s.item_count)),
    status: s.status,
  }));
}

/** POST assistant/ask. A question that gets no answer is not counted (the server refunds it). */
export async function askAssistant(question: string, sections: readonly AssistantSection[]): Promise<AskResult> {
  try {
    return await callFunction<AskResult>('assistant/ask', {
      body: { device_id: await getDeviceId(), question: question.trim(), sections: allowListed(sections) },
    });
  } catch (error) {
    if (hasCode(error, 'ai_paused')) return { ok: false, reason: 'paused' };
    throw error;
  }
}

/**
 * POST assistant/transcribe: the recording becomes text for the person to read and edit
 * before asking. Speaking needs a question left this month but does not spend one.
 */
export async function transcribeQuestion(audio: Blob, durationMs: number): Promise<TranscribeResult> {
  if (durationMs > ASSISTANT_LIMITS.recordingMs || audio.size > ASSISTANT_LIMITS.recordingBytes) {
    throw new AccountError('server', 'audio_too_long', 'audio_too_long');
  }
  const form = new FormData();
  form.append('audio', audio, 'recording');
  form.append('device_id', await getDeviceId());
  form.append('duration_ms', String(Math.max(1, Math.round(durationMs))));
  try {
    return await callFunction<TranscribeResult>('assistant/transcribe', { body: form });
  } catch (error) {
    if (hasCode(error, 'ai_paused')) return { ok: false, reason: 'paused' };
    throw error;
  }
}
