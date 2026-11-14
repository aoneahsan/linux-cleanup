import { corsHeaders } from './cors.ts';
import { fail, HttpError } from './envelope.ts';
import { log } from './log.ts';

/**
 * Serve one function: the CORS preflight, a method allow-list, and one catch that turns
 * every refusal into the envelope. The handler itself runs the ordered gate:
 * shape (422) -> authentication (401) -> authorization (403) -> business (409/422) -> DB.
 */
export function serve(name: string, methods: string[], handler: (req: Request) => Promise<Response>): void {
  Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
    if (!methods.includes(req.method)) {
      return fail(405, 'method_not_allowed', `Use ${methods.join(' or ')}.`);
    }
    try {
      return await handler(req);
    } catch (error) {
      if (error instanceof HttpError) return fail(error.status, error.code, error.message);
      log('error', `${name}.unhandled`, { message: error instanceof Error ? error.message : String(error) });
      return fail(500, 'internal_error', 'Something went wrong on our side. Please try again.');
    }
  });
}
