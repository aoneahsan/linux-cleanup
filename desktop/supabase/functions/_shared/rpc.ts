import { HttpError } from './envelope.ts';
import type { SupabaseClient } from './supabase.ts';

/** SQL exception messages the migrations raise, mapped to HTTP status + envelope code. */
const KNOWN: Record<string, [number, string]> = {
  not_authenticated: [401, 'not_authenticated'],
  forbidden: [403, 'forbidden'],
  signed_in_required: [403, 'signed_in_required'],
  plan_required: [403, 'plan_required'],
  mac_limit: [403, 'mac_limit'],
  device_owned: [403, 'device_owned'],
  handoff_invalid: [403, 'handoff_invalid'],
  not_team_owner: [403, 'not_team_owner'],
  not_in_team: [403, 'not_in_team'],
  owner_cannot_leave: [409, 'owner_cannot_leave'],
  invite_email_mismatch: [403, 'invite_email_mismatch'],
  not_found: [404, 'not_found'],
  invite_not_found: [404, 'invite_not_found'],
  invalid_request: [422, 'invalid_request'],
  invalid_device: [422, 'invalid_request'],
  invalid_claim: [422, 'invalid_claim'],
  invalid_schedule: [422, 'invalid_schedule'],
  invalid_plan: [422, 'invalid_plan'],
  invalid_override: [422, 'invalid_override'],
  invalid_value: [422, 'invalid_value'],
  out_of_bounds: [422, 'out_of_bounds'],
  free_plan_required: [409, 'free_plan_required'],
  duplicate_summary: [409, 'duplicate_summary'],
  already_in_team: [409, 'already_in_team'],
  already_member: [409, 'already_member'],
  no_seats: [409, 'no_seats'],
};

/** Human messages for the codes a person can act on. */
const MESSAGES: Record<string, string> = {
  plan_required: 'Your plan does not include this.',
  mac_limit: 'Your plan already syncs the most computers it includes.',
  device_owned: 'This computer is registered to another account. Hand it over from that account first.',
  handoff_invalid: 'That hand-over code is wrong or has expired.',
    no_seats: 'All seats are in use. Add a seat on the Plans screen.',
  invite_email_mismatch: 'This invite is for a different email address.',
  owner_cannot_leave: 'The team owner cannot leave the team.',
  already_in_team: 'This account is already in a team.',
  out_of_bounds: 'That value is outside the allowed range.',
};

/** Call a SQL function and translate its raised exception into the envelope. */
export async function rpc<T>(client: SupabaseClient, fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await client.rpc(fn, args);
  if (error) {
    const known = KNOWN[error.message];
    if (known) throw new HttpError(known[0], known[1], MESSAGES[error.message] ?? error.message.replaceAll('_', ' '));
    throw new HttpError(502, 'upstream_error', 'The database refused the request.');
  }
  return data as T;
}
