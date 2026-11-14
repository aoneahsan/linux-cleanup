/**
 * CORS for every function. The desktop app calls from the Tauri webview origin, so the
 * header is permissive; authorization is the JWT, never the origin.
 */
export const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
};
