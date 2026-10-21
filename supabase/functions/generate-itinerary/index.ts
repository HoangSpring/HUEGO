/**
 * HUEGO — Edge Function: generate-itinerary
 * Main entrypoint for server-side itinerary planning and grounding pipeline.
 */

import { getCorsHeaders, handleCorsPreflight } from './cors.ts';
import { validateGenerateItineraryRequest } from './schema.ts';
import { processPlaceCandidates, type RawCategoryRecord, type RawPlaceRecord, type RawTripRecord } from './catalog.ts';
import { buildGroundedPrompt } from './prompt.ts';
import { type LLMProvider, ProviderError, resolveProvider } from './provider.ts';
import { validateAndHydrateItinerary } from './validator.ts';
import type { AuthenticatedUser, ErrorCode, GenerateItineraryErrorResponse, GenerateItineraryResponse } from './types.ts';

const MAX_PAYLOAD_BYTES = 64 * 1024; // 64 KB limit

export interface HandlerDependencies {
  authVerifier?: (token: string) => Promise<AuthenticatedUser | null>;
  catalogFetcher?: () => Promise<{ places: RawPlaceRecord[]; categories: RawCategoryRecord[] }>;
  tripFetcher?: (tripId: string, accessToken: string) => Promise<RawTripRecord | null>;
  provider?: LLMProvider;
}

/**
 * Helper to build standard JSON response with appropriate CORS and security headers.
 */
function jsonResponse(body: GenerateItineraryResponse | GenerateItineraryErrorResponse, status: number, reqOrigin: string | null): Response {
  const cors = getCorsHeaders(reqOrigin);
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
      ...cors,
    },
  });
}

function errorResponse(code: ErrorCode, message: string, status: number, reqOrigin: string | null, details?: string): Response {
  return jsonResponse(
    {
      success: false,
      error: { code, message, details },
    },
    status,
    reqOrigin
  );
}

/**
 * Default live Supabase Auth token verifier.
 * Calls Supabase Auth to verify JWT and retrieve the authenticated user.
 */
async function defaultAuthVerifier(token: string): Promise<AuthenticatedUser | null> {
  const supabaseUrl = typeof Deno !== 'undefined'
    ? Deno.env.get('SUPABASE_URL')
    : (typeof process !== 'undefined' ? process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL : undefined);
  const supabaseAnonKey = typeof Deno !== 'undefined'
    ? Deno.env.get('SUPABASE_ANON_KEY')
    : (typeof process !== 'undefined' ? process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY : undefined);

  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  try {
    const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: supabaseAnonKey,
      },
    });

    if (!res.ok) {
      return null;
    }

    const data = await res.json() as { id?: string; email?: string };
    if (!data.id) return null;

    return { id: data.id, email: data.email };
  } catch {
    return null;
  }
}

/**
 * Default live Supabase catalog fetcher.
 * Retrieves active places and categories from PostgREST using anonymous key.
 */
async function defaultCatalogFetcher(): Promise<{ places: RawPlaceRecord[]; categories: RawCategoryRecord[] }> {
  const supabaseUrl = typeof Deno !== 'undefined'
    ? Deno.env.get('SUPABASE_URL')
    : (typeof process !== 'undefined' ? process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL : undefined);
  const supabaseAnonKey = typeof Deno !== 'undefined'
    ? Deno.env.get('SUPABASE_ANON_KEY')
    : (typeof process !== 'undefined' ? process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY : undefined);

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase environment variables are missing.');
  }

  const [placesRes, categoriesRes] = await Promise.all([
    fetch(`${supabaseUrl}/rest/v1/places?is_active=eq.true&select=*`, {
      headers: { apikey: supabaseAnonKey, Authorization: `Bearer ${supabaseAnonKey}` },
    }),
    fetch(`${supabaseUrl}/rest/v1/place_categories?select=*`, {
      headers: { apikey: supabaseAnonKey, Authorization: `Bearer ${supabaseAnonKey}` },
    }),
  ]);

  if (!placesRes.ok) {
    throw new Error(`Failed to query places from Supabase: ${placesRes.status}`);
  }

  const places = (await placesRes.json()) as RawPlaceRecord[];
  const categories = categoriesRes.ok ? ((await categoriesRes.json()) as RawCategoryRecord[]) : [];

  return { places, categories };
}

/**
 * Default live trip fetcher.
 */
async function defaultTripFetcher(tripId: string, accessToken: string): Promise<RawTripRecord | null> {
  const supabaseUrl = typeof Deno !== 'undefined'
    ? Deno.env.get('SUPABASE_URL')
    : (typeof process !== 'undefined' ? process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL : undefined);
  const supabaseAnonKey = typeof Deno !== 'undefined'
    ? Deno.env.get('SUPABASE_ANON_KEY')
    : (typeof process !== 'undefined' ? process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY : undefined);

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase trip lookup is not configured.');
  }

  const res = await fetch(`${supabaseUrl}/rest/v1/trips?id=eq.${encodeURIComponent(tripId)}&select=id,user_id,title,days_count,budget,status`, {
    headers: { apikey: supabaseAnonKey, Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    throw new Error('Supabase trip lookup failed.');
  }

  const trips = (await res.json()) as RawTripRecord[];
  return trips[0] || null;
}

/**
 * Primary HTTP Request Handler for generate-itinerary.
 */
export async function handleGenerateItineraryRequest(
  req: Request,
  deps: HandlerDependencies = {}
): Promise<Response> {
  const origin = req.headers.get('Origin');

  // 1. CORS Preflight
  const preflight = handleCorsPreflight(req);
  if (preflight) {
    return preflight;
  }

  // 2. Enforce HTTP POST
  if (req.method !== 'POST') {
    return errorResponse('METHOD_NOT_ALLOWED', 'Only HTTP POST requests are supported.', 405, origin);
  }

  // 3. Payload size enforcement
  const contentLength = req.headers.get('content-length');
  if (contentLength && parseInt(contentLength, 10) > MAX_PAYLOAD_BYTES) {
    return errorResponse('PAYLOAD_TOO_LARGE', `Request body exceeds maximum size of ${MAX_PAYLOAD_BYTES / 1024} KB.`, 413, origin);
  }

  try {
    // 4. Parse request body
    let rawBody: unknown;
    try {
      const text = await req.text();
      if (text.length > MAX_PAYLOAD_BYTES) {
        return errorResponse('PAYLOAD_TOO_LARGE', `Request body exceeds maximum size limit.`, 413, origin);
      }
      rawBody = JSON.parse(text);
    } catch {
      return errorResponse('INVALID_JSON', 'Malformed JSON in request body.', 400, origin);
    }

    // 5. Authentication Verification
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return errorResponse('UNAUTHORIZED', 'Missing or invalid Authorization header.', 401, origin);
    }

    const token = authHeader.slice(7).trim();
    if (!token) {
      return errorResponse('UNAUTHORIZED', 'Bearer token is required.', 401, origin);
    }

    const verifyAuth = deps.authVerifier || defaultAuthVerifier;
    const user = await verifyAuth(token);
    if (!user) {
      return errorResponse('UNAUTHORIZED', 'Invalid or expired authentication credentials.', 401, origin);
    }

    // 6. Request Schema Validation
    const validation = validateGenerateItineraryRequest(rawBody);
    if (!validation.success) {
      return errorResponse('INVALID_REQUEST', validation.error, 400, origin, validation.field);
    }

    const { tripId, preferences } = validation.data;

    // 7. Authorization & Trip Ownership Check (if tripId is provided)
    if (tripId) {
      const fetchTrip = deps.tripFetcher || defaultTripFetcher;
      let trip: RawTripRecord | null;
      try {
        trip = await fetchTrip(tripId, token);
      } catch {
        return errorResponse('INTERNAL_ERROR', 'Unable to verify trip ownership.', 500, origin);
      }

      if (!trip) {
        return errorResponse('FORBIDDEN', 'The specified trip does not exist or access is restricted.', 404, origin);
      }

      if (trip.user_id !== user.id) {
        return errorResponse('FORBIDDEN', 'Access to the specified trip is forbidden.', 403, origin);
      }
    }

    // 8. Catalog Retrieval & Grounding
    const fetchCatalog = deps.catalogFetcher || defaultCatalogFetcher;
    let catalogData: { places: RawPlaceRecord[]; categories: RawCategoryRecord[] };
    try {
      catalogData = await fetchCatalog();
    } catch (catalogErr) {
      console.error('Catalog fetch error:', catalogErr);
      return errorResponse('INTERNAL_ERROR', 'Unable to retrieve destination catalog.', 500, origin);
    }

    const candidates = processPlaceCandidates(
      catalogData.places,
      catalogData.categories,
      preferences.language,
      30
    );

    if (candidates.length === 0) {
      return errorResponse('NO_PLACES', 'No active destinations available in Huế to plan this trip.', 404, origin);
    }

    // 9. Prompt Assembly
    const prompt = buildGroundedPrompt(preferences, candidates);

    // 10. Provider Adapter Invocation
    const allowMock =
      typeof Deno !== 'undefined'
        ? Deno.env.get('ALLOW_MOCK_PROVIDER') === 'true'
        : typeof process !== 'undefined'
        ? process.env.ALLOW_MOCK_PROVIDER === 'true'
        : false;

    const provider = deps.provider || resolveProvider({ allowMockFallback: allowMock });
    let rawOutput;
    try {
      rawOutput = await provider.generateItinerary(prompt, candidates, preferences);
    } catch (provErr) {
      if (provErr instanceof ProviderError) {
        const publicMessage =
          provErr.code === 'PROVIDER_NOT_CONFIGURED'
            ? 'AI itinerary generation is not configured on the server.'
            : provErr.code === 'PROVIDER_TIMEOUT'
              ? 'The AI provider timed out. Please try again.'
              : provErr.code === 'PROVIDER_RATE_LIMIT'
                ? 'The AI provider is temporarily busy. Please try again shortly.'
                : 'The AI itinerary provider could not complete the request.';
        return errorResponse(provErr.code, publicMessage, provErr.status, origin);
      }
      return errorResponse('PROVIDER_ERROR', 'The itinerary generation service encountered a provider error.', 502, origin);
    }

    // 11. Server-Side Output Validation & Fact Hydration
    const outcome = validateAndHydrateItinerary(rawOutput, candidates, preferences);
    if (!outcome.success) {
      return errorResponse(outcome.code, outcome.error, 422, origin);
    }

    // 12. Return Validated Response
    const responseData: GenerateItineraryResponse = {
      success: true,
      itinerary: outcome.data,
      metadata: {
        provider: provider.name,
        groundedPlaceCount: candidates.length,
        generatedAt: new Date().toISOString(),
      },
    };

    return jsonResponse(responseData, 200, origin);
  } catch (err) {
    console.error('Unhandled generate-itinerary error:', err);
    return errorResponse('INTERNAL_ERROR', 'An unexpected server error occurred.', 500, origin);
  }
}

// Start Deno server if running under Supabase Edge Runtime
const globalDeno = (globalThis as unknown as { Deno?: { serve: (handler: unknown) => void } }).Deno;
if (globalDeno && typeof globalDeno.serve === 'function') {
  globalDeno.serve(handleGenerateItineraryRequest);
}
