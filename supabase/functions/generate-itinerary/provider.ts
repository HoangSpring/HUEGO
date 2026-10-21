/**
 * HUEGO — Edge Function: Provider Adapter Boundary
 * Isolates LLM provider invocation behind a uniform interface.
 * Implements MockLLMProvider for zero-cost, grounded testing and development.
 */

import type {
  CandidatePlaceSummary,
  ErrorCode,
  RawLLMActivity,
  RawLLMDay,
  RawLLMItineraryOutput,
  TripPlanningPreferences,
} from './types.ts';

/**
 * Common interface that all LLM adapters must fulfill.
 */
export interface LLMProvider {
  readonly name: string;
  generateItinerary(
    prompt: string,
    candidates: CandidatePlaceSummary[],
    preferences: TripPlanningPreferences
  ): Promise<RawLLMItineraryOutput>;
}

/**
 * Reads an environment variable in both Deno (Edge Functions) and Node (tests).
 */
function readEnv(name: string): string | undefined {
  if (typeof Deno !== 'undefined') return Deno.env.get(name);
  if (typeof process !== 'undefined') return process.env[name];
  return undefined;
}

/**
 * Mock LLM Provider for local development, automated verification, and testing.
 * Guarantees zero provider costs, determinism, and 100% catalog grounding.
 */
export class MockLLMProvider implements LLMProvider {
  readonly name = 'mock-grounded';

  async generateItinerary(
    _prompt: string,
    candidates: CandidatePlaceSummary[],
    preferences: TripPlanningPreferences
  ): Promise<RawLLMItineraryOutput> {
    const isEn = preferences.language === 'en';
    const durationDays = preferences.durationDays;

    if (candidates.length === 0) {
      return {
        tripTitle: isEn ? 'Empty Itinerary' : 'Lịch trình trống',
        days: [],
      };
    }

    let maxPlacesPerDay = 3;
    if (preferences.travelStyle === 'relaxed') maxPlacesPerDay = 2;
    if (preferences.travelStyle === 'packed') maxPlacesPerDay = 4;

    const placesPerDay = Math.max(1, Math.min(maxPlacesPerDay, Math.floor(candidates.length / durationDays) || 1));

    const days: RawLLMDay[] = [];
    const scheduledPlaceIds = new Set<string>();
    let candidateIndex = 0;

    for (let dayNum = 1; dayNum <= durationDays; dayNum++) {
      const dayActivities: RawLLMActivity[] = [];
      let currentClockMinutes = 8 * 60 + 30; // 08:30 AM

      for (let pIdx = 0; pIdx < placesPerDay; pIdx++) {
        while (candidateIndex < candidates.length && scheduledPlaceIds.has(candidates[candidateIndex].id)) {
          candidateIndex++;
        }

        if (candidateIndex >= candidates.length) {
          break;
        }

        const candidate = candidates[candidateIndex];
        scheduledPlaceIds.add(candidate.id);
        candidateIndex++;

        const startH = String(Math.floor(currentClockMinutes / 60)).padStart(2, '0');
        const startM = String(currentClockMinutes % 60).padStart(2, '0');
        const duration = candidate.durationMinutes || 60;
        const endMinutes = currentClockMinutes + duration;
        const endH = String(Math.floor(endMinutes / 60)).padStart(2, '0');
        const endM = String(endMinutes % 60).padStart(2, '0');

        const placeName = isEn ? candidate.nameEn : candidate.nameVi;

        dayActivities.push({
          placeId: candidate.id,
          title: isEn ? `Explore ${placeName}` : `Khám phá ${placeName}`,
          activityType: 'visit',
          startTime: `${startH}:${startM}`,
          endTime: `${endH}:${endM}`,
          durationMinutes: duration,
          notes: isEn
            ? `Visit ${placeName} (${candidate.categoryName}). Recommended for ${preferences.companionType || 'travelers'}.`
            : `Tham quan ${placeName} (${candidate.categoryName}). Thích hợp cho chuyến đi ${preferences.companionType || 'tự túc'}.`,
          localTip: isEn
            ? 'Arrive early in the morning to enjoy cooler weather.'
            : 'Nên đến sớm vào buổi sáng để tránh nắng nóng.',
        });

        currentClockMinutes = endMinutes + 30;
        if (currentClockMinutes >= 11 * 60 + 30 && currentClockMinutes <= 13 * 60) {
          currentClockMinutes = 13 * 60 + 30;
        }
      }

      const dayTitle = isEn ? `Day ${dayNum}: Huế Highlights` : `Ngày ${dayNum}: Tinh hoa cố đô`;
      days.push({
        dayNumber: dayNum,
        title: dayTitle,
        theme: isEn ? 'Cultural Exploration' : 'Khám phá văn hóa',
        activities: dayActivities,
      });
    }

    return {
      tripTitle: isEn
        ? `${durationDays}-Day Authentic Huế Journey`
        : `Hành trình khám phá Huế ${durationDays} ngày`,
      days,
    };
  }
}

/**
 * Structured error class for provider adapter failures with HTTP status and ErrorCode.
 */
export class ProviderError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details?: string;

  constructor(code: ErrorCode, message: string, status = 502, details?: string) {
    super(message);
    this.name = 'ProviderError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

/**
 * Sanitizes error messages by stripping any embedded API keys or query params.
 */
export function sanitizeErrorMessage(err: unknown, apiKey?: string): string {
  let msg = err instanceof Error ? err.message : String(err);
  if (apiKey) {
    msg = msg.split(apiKey).join('[REDACTED_KEY]');
  }
  msg = msg.replace(/key=[a-zA-Z0-9_-]+/gi, 'key=[REDACTED]');
  return msg;
}

/** Default to Google's current stable Flash model for new API integrations. */
export const DEFAULT_GEMINI_MODEL = 'gemini-3.8-flash';
export interface GeminiProviderOptions {
  apiKey?: string;
  model?: string;
  timeoutMs?: number;
  /** Maximum number of output tokens. */
  maxOutputTokens?: number;
  /** Number of retries for transient errors (HTTP 500/503). */
  maxRetries?: number;
  fetchFn?: typeof fetch;
}

const RETRYABLE_STATUSES = new Set([500, 503]);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Official Google Gemini provider adapter.
 * Uses Gemini v1beta generateContent REST endpoint with structured JSON mode.
 */
export class GeminiProvider implements LLMProvider {
  readonly name: string;
  private readonly apiKey: string;
  private readonly model: string;
  private readonly timeoutMs: number;
  private readonly maxOutputTokens: number;
  private readonly maxRetries: number;
  private readonly fetchFn: typeof fetch;

  constructor(options?: GeminiProviderOptions) {
    const key = options?.apiKey || readEnv('GEMINI_API_KEY');

    if (!key || key.trim() === '') {
      throw new ProviderError(
        'PROVIDER_NOT_CONFIGURED',
        'Gemini API key is not configured on the server.',
        503
      );
    }

    this.apiKey = key.trim();
    this.model = options?.model || readEnv('GEMINI_MODEL')?.trim() || DEFAULT_GEMINI_MODEL;
    this.name = this.model;
    this.timeoutMs = options?.timeoutMs ?? 30000;
    this.maxOutputTokens = options?.maxOutputTokens ?? 8192;
    this.maxRetries = options?.maxRetries ?? 1;
    this.fetchFn = options?.fetchFn || globalThis.fetch.bind(globalThis);
  }

  async generateItinerary(
    prompt: string,
    candidates: CandidatePlaceSummary[]
  ): Promise<RawLLMItineraryOutput> {
    if (candidates.length === 0) {
      return {
        tripTitle: 'Empty Itinerary',
        days: [],
      };
    }

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      this.model
    )}:generateContent`;

    const generationConfig: Record<string, unknown> = {
      responseFormat: {
        text: {
          mimeType: 'APPLICATION_JSON',
          schema: {
            type: 'object',
            properties: {
              tripTitle: { type: 'string' },
              days: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    dayNumber: { type: 'integer' },
                    title: { type: 'string' },
                    theme: { type: 'string' },
                    activities: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          placeId: { type: 'string' },
                          title: { type: 'string' },
                          activityType: { type: 'string' },
                          startTime: { type: 'string' },
                          endTime: { type: 'string' },
                          durationMinutes: { type: 'integer' },
                          notes: { type: 'string' },
                          localTip: { type: 'string' },
                        },
                        required: ['placeId', 'startTime', 'endTime'],
                      },
                    },
                  },
                  required: ['dayNumber', 'activities'],
                },
              },
            },
            required: ['days'],
          },
        },
      },
      maxOutputTokens: this.maxOutputTokens,
    };

    const requestBody = {
      systemInstruction: {
        parts: [
          {
            text: 'You are an AI itinerary generator. You MUST respond with strict JSON format adhering to the requested structure without markdown formatting or commentary.',
          },
        ],
      },
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }],
        },
      ],
      generationConfig,
    };

    const requestStartedAt = Date.now();
    const logDiagnostic = (category: string, details?: unknown) => {
      console.info('Gemini provider diagnostic', {
        category,
        model: this.model,
        elapsedMs: Date.now() - requestStartedAt,
        details,
      });
    };

    let res: Response | undefined;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);

      try {
        res = await this.fetchFn(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': this.apiKey,
          },
          body: JSON.stringify(requestBody),
          signal: controller.signal,
        });
      } catch (fetchErr: unknown) {
        const isTimeout =
          controller.signal.aborted ||
          (fetchErr instanceof Error && fetchErr.name === 'AbortError');
        if (isTimeout) {
          // Do not retry timeouts: it would exceed the Edge Function time budget.
          logDiagnostic('fetch_timeout');
          throw new ProviderError('PROVIDER_TIMEOUT', 'Gemini API request timed out.', 504);
        }
        logDiagnostic('fetch_error');
        const sanitized = sanitizeErrorMessage(fetchErr, this.apiKey);
        throw new ProviderError(
          'PROVIDER_ERROR',
          `Network error contacting Gemini provider: ${sanitized}`,
          502
        );
      } finally {
        clearTimeout(timer);
      }

      if (RETRYABLE_STATUSES.has(res.status) && attempt < this.maxRetries) {
        logDiagnostic('retrying_transient_error', { status: res.status, attempt: attempt + 1 });
        await sleep(800 * (attempt + 1));
        continue;
      }
      break;
    }

    if (!res) {
      throw new ProviderError('PROVIDER_ERROR', 'Gemini API did not return a response.', 502);
    }

    if (res.status === 429) {
      logDiagnostic('rate_limited');
      throw new ProviderError(
        'PROVIDER_RATE_LIMIT',
        'Gemini rate limit exceeded. Please try again shortly.',
        429
      );
    }

    if (!res.ok) {
      let errorDetail = '';
      try {
        const errJson = (await res.json()) as { error?: { message?: string; code?: number } };
        if (errJson?.error?.message) {
          errorDetail = sanitizeErrorMessage(errJson.error.message, this.apiKey);
        }
      } catch {
        // Ignore response body parsing errors on non-200 responses
      }

      logDiagnostic('http_error_response', { status: res.status, errorDetail });

      throw new ProviderError(
        'PROVIDER_ERROR',
        `Gemini API returned HTTP ${res.status}${errorDetail ? `: ${errorDetail}` : ''}`,
        502
      );
    }

    let jsonResponse: unknown;
    try {
      jsonResponse = await res.json();
    } catch {
      logDiagnostic('response_body_parse_error');
      throw new ProviderError('PROVIDER_ERROR', 'Failed to parse JSON response from Gemini API.', 502);
    }

    const parsedRes = jsonResponse as {
      candidates?: Array<{
        content?: {
          parts?: Array<{ text?: string }>;
        };
        finishReason?: string;
      }>;
    };

    const firstCandidate = parsedRes.candidates?.[0];
    const finishReason = firstCandidate?.finishReason;

    if (finishReason === 'MAX_TOKENS') {
      logDiagnostic('output_truncated_max_tokens', { finishReason });
      throw new ProviderError(
        'INVALID_OUTPUT_FORMAT',
        'Gemini output was truncated (MAX_TOKENS). Increase maxOutputTokens or shorten the prompt.',
        422
      );
    }

    // Join all text parts (thinking models may split output across parts).
    const rawJoined = (firstCandidate?.content?.parts ?? [])
      .map((p) => (typeof p.text === 'string' ? p.text : ''))
      .join('');

    if (rawJoined.trim() === '') {
      logDiagnostic('provider_payload_invalid', { finishReason });
      throw new ProviderError(
        'INVALID_OUTPUT_FORMAT',
        'Gemini response missing valid candidate content.',
        422
      );
    }

    let rawText = rawJoined.trim();
    if (rawText.startsWith('```json')) {
      rawText = rawText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (rawText.startsWith('```')) {
      rawText = rawText.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }

    let itineraryOutput: RawLLMItineraryOutput;
    try {
      itineraryOutput = JSON.parse(rawText) as RawLLMItineraryOutput;
    } catch {
      logDiagnostic('generated_json_parse_error', { finishReason });
      throw new ProviderError(
        'INVALID_OUTPUT_FORMAT',
        'Gemini returned invalid or unparseable JSON text.',
        422
      );
    }

    if (!itineraryOutput || typeof itineraryOutput !== 'object' || !Array.isArray(itineraryOutput.days)) {
      logDiagnostic('generated_json_invalid');
      throw new ProviderError(
        'INVALID_OUTPUT_FORMAT',
        'Gemini output structure does not contain a valid days array.',
        422
      );
    }

    logDiagnostic('response_parsed', { finishReason });

    return itineraryOutput;
  }
}

/**
 * Fallback provider when Gemini is unconfigured and mock fallback is disabled.
 */
export class UnconfiguredGeminiProvider implements LLMProvider {
  readonly name = 'gemini-unconfigured';

  async generateItinerary(): Promise<RawLLMItineraryOutput> {
    throw new ProviderError(
      'PROVIDER_NOT_CONFIGURED',
      'Gemini API key is not configured on the server.',
      503
    );
  }
}

/**
 * Resolves the appropriate LLMProvider based on explicit dependencies, configuration, or environment.
 */
export function resolveProvider(options?: {
  provider?: LLMProvider;
  apiKey?: string;
  model?: string;
  allowMockFallback?: boolean;
}): LLMProvider {
  if (options?.provider) {
    return options.provider;
  }

  const key = options?.apiKey || readEnv('GEMINI_API_KEY');

  if (key && key.trim() !== '') {
    return new GeminiProvider({
      apiKey: key.trim(),
      model: options?.model,
    });
  }

  if (options?.allowMockFallback) {
    return new MockLLMProvider();
  }

  return new UnconfiguredGeminiProvider();
}
