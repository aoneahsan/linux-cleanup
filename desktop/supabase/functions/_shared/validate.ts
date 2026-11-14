import { z } from 'npm:zod@4.6.7';
import { HttpError } from './envelope.ts';

export { z };

/** Turn Zod issues into one short, field-named message (no values echoed back). */
function describe(error: z.ZodError): string {
  return error.issues
    .slice(0, 5)
    .map((issue) => `${issue.path.join('.') || 'body'}: ${issue.message}`)
    .join('; ');
}

/** Gate step 1 for a JSON body: parse and validate, or refuse with 422. */
export async function readBody<S extends z.ZodType>(req: Request, schema: S): Promise<z.infer<S>> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new HttpError(422, 'invalid_request', 'The request body is not valid JSON.');
  }
  const result = schema.safeParse(raw);
  if (!result.success) throw new HttpError(422, 'invalid_request', describe(result.error));
  return result.data;
}

/** Gate step 1 for query parameters. */
export function readQuery<S extends z.ZodType>(req: Request, schema: S): z.infer<S> {
  const params = Object.fromEntries(new URL(req.url).searchParams.entries());
  const result = schema.safeParse(params);
  if (!result.success) throw new HttpError(422, 'invalid_request', describe(result.error));
  return result.data;
}
