import { HttpError } from './envelope.ts';
import { serviceClient, type SupabaseClient, userClient } from './supabase.ts';

/** The authenticated caller, with a client that runs as them. */
export interface Caller {
  id: string;
  email: string | null;
  isAnonymous: boolean;
  client: SupabaseClient;
}

/** Gate step 2: a valid session JWT (anonymous device sessions included), or 401. */
export async function requireCaller(req: Request): Promise<Caller> {
  const header = req.headers.get('Authorization') ?? '';
  if (!header.startsWith('Bearer ')) {
    throw new HttpError(401, 'not_authenticated', 'Sign-in session missing.');
  }
  const client = userClient(header);
  const { data, error } = await client.auth.getUser(header.slice('Bearer '.length));
  if (error || !data.user) throw new HttpError(401, 'not_authenticated', 'Sign-in session expired.');
  return {
    id: data.user.id,
    email: data.user.email ? data.user.email.toLowerCase() : null,
    isAnonymous: data.user.is_anonymous === true,
    client,
  };
}

/** Gate step 3: a real Google account, not an anonymous device session, or 403. */
export function requireSignedIn(caller: Caller): asserts caller is Caller & { email: string } {
  if (caller.isAnonymous || !caller.email) {
    throw new HttpError(403, 'signed_in_required', 'Sign in with Google to use this.');
  }
}

/** Gate step 3 for staff: a user_roles row, read server-side, or 403. */
export async function requireAdmin(caller: Caller): Promise<'admin' | 'superadmin'> {
  requireSignedIn(caller);
  const { data, error } = await serviceClient()
    .from('user_roles').select('role').eq('user_id', caller.id).maybeSingle();
  if (error) throw new HttpError(502, 'upstream_error', 'Could not check your role.');
  if (!data) throw new HttpError(403, 'forbidden', 'This is for admins.');
  return data.role as 'admin' | 'superadmin';
}
