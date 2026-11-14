import { corsHeaders } from './cors.ts';

/** Machine-readable error codes every function may return. */
export type ErrorCode =
  | 'invalid_request' | 'not_authenticated' | 'forbidden' | 'signed_in_required'
  | 'plan_required' | 'not_found' | 'conflict' | 'method_not_allowed'
  | 'billing_unavailable' | 'upstream_error' | 'internal_error' | string;

/** A refusal that carries its HTTP status and envelope code through the handler. */
export class HttpError extends Error {
  constructor(readonly status: number, readonly code: ErrorCode, message: string) {
    super(message);
  }
}

/** JSON response with CORS. Contract shapes sit at the top level beside `ok`. */
export function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/** Success: `{ ok: true, ...shape }`. */
export function ok(shape: Record<string, unknown> = {}, status = 200): Response {
  return json({ ok: true, ...shape }, status);
}

/** Failure: `{ ok: false, error: { code, message } }`. */
export function fail(status: number, code: ErrorCode, message: string): Response {
  return json({ ok: false, error: { code, message } }, status);
}
