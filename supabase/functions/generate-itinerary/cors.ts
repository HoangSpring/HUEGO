/**
 * HUEGO — Edge Function: CORS Handler
 * Restricts cross-origin requests to configured application origins.
 * Avoids permissive wildcard '*' on authenticated endpoints.
 */

const DEFAULT_ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:4173',
  'http://127.0.0.1:4173',
];

/**
 * Returns the list of permitted origins by combining defaults with any environment configuration.
 */
export function getAllowedOrigins(): string[] {
  const envOrigins = typeof Deno !== 'undefined'
    ? Deno.env.get('ALLOWED_ORIGINS') || Deno.env.get('APP_ORIGIN')
    : (typeof process !== 'undefined' ? process.env.ALLOWED_ORIGINS || process.env.APP_ORIGIN : undefined);

  if (!envOrigins) {
    return DEFAULT_ALLOWED_ORIGINS;
  }

  const customOrigins = envOrigins.split(',').map((o) => o.trim()).filter(Boolean);
  return Array.from(new Set([...DEFAULT_ALLOWED_ORIGINS, ...customOrigins]));
}

/**
 * Builds appropriate CORS headers for a given request origin.
 */
export function getCorsHeaders(requestOrigin: string | null): Record<string, string> {
  const allowedOrigins = getAllowedOrigins();

  const isAllowed = requestOrigin && allowedOrigins.includes(requestOrigin);

  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };

  if (isAllowed && requestOrigin) {
    headers['Access-Control-Allow-Origin'] = requestOrigin;
    headers['Access-Control-Allow-Credentials'] = 'true';
  }

  return headers;
}

/**
 * Handles CORS OPTIONS preflight request. Returns a Response if preflight, otherwise null.
 */
export function handleCorsPreflight(req: Request): Response | null {
  if (req.method === 'OPTIONS') {
    const origin = req.headers.get('Origin');
    const headers = getCorsHeaders(origin);
    return new Response(null, {
      status: 204,
      headers,
    });
  }
  return null;
}
