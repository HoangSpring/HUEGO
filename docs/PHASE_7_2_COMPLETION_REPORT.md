# HUEGO — Phase 7.2: Gemini Integration and AI Trip Planning Flow Completion Report

## 1. Executive Summary

Phase 7.2 integrates the official Google Gemini provider adapter into HUEGO's server-side Supabase Edge Function foundation (`generate-itinerary`), connects it seamlessly to the frontend trip-planning workflow (`PlanTrip` → `AIGenerating` → `TripResult`), and establishes the existing deterministic itinerary engine as an automated, transparent fallback.

All architectural boundaries established in Phase 7.0 and Phase 7.1 remain preserved:
- LLM provider integration is isolated exclusively within the server-side Edge Function boundary.
- All model output is validated independently against the active Huế destination catalog in Supabase.
- Credentials remain exclusively on the server, loaded via runtime environment secrets, with active URL and error message sanitization.
- The deterministic itinerary planner is retained as a zero-cost fallback if the AI provider is unavailable, unconfigured, or rate-limited.
- Automated testing covers all 16 verification requirements of Scope F with 55 passing assertions using offline mocks.
- Because a replacement secret is not yet configured in the runtime environment, live paid Gemini API calls are blocked, and live smoke tests are truthfully reported as blocked.

---

## 2. Files Created and Modified

### Created Files
- `src/services/ai/aiPlanService.ts`: Client-side service invoking the `generate-itinerary` Supabase Edge Function with JWT authentication, converting server-validated itineraries to client `PlannedItinerary` records, and enforcing `isAiGenerated: true`.
- `tests/phase_7_2_gemini_integration.test.ts`: Automated test suite verifying all 16 Scope F requirements (offline mocked Gemini adapter, timeouts, rate limits, catalog grounding, fallback, duplicate prevention, and secret leakage prevention).
- `docs/PHASE_7_2_COMPLETION_REPORT.md`: This completion report.

### Modified Files
- `supabase/functions/generate-itinerary/types.ts`: Extended `ErrorCode` union with `PROVIDER_TIMEOUT` (HTTP 504) and `PROVIDER_RATE_LIMIT` (HTTP 429).
- `supabase/functions/generate-itinerary/provider.ts`: Implemented `GeminiProvider`, `ProviderError`, `UnconfiguredGeminiProvider`, `resolveProvider`, and `sanitizeErrorMessage`.
- `supabase/functions/generate-itinerary/index.ts`: Wired `resolveProvider` into the HTTP handler and added structured `ProviderError` mapping with HTTP status codes.
- `src/services/trips/itineraryPlanner.ts`: Updated `persistPlannedItinerary` (line 470) to truthfully persist `is_ai_generated: activity.isAiGenerated ?? false`.
- `src/pages/AIGenerating/AIGeneratingPage.tsx`: Integrated `generateAItinerary` with automatic fallback to `planDeterministicItinerary` upon error/unconfigured provider.
- `src/pages/TripResult/TripResultPage.tsx`: Added subtle UI fallback notice banner and `✨ AI` badge next to activities with `is_ai_generated: true`.
- `tests/phase_7_1_unit.test.ts`: Corrected `prefer-const` lint error.
- `tests/phase_7_1_integration.test.ts`: Updated HTTP status assertions to reflect live Supabase Auth 401/403 behaviors.

---

## 3. Gemini Provider and Model Selection

### Provider Selection
- **Provider**: Google Gemini API via official v1beta REST interface.
- **Endpoint**: `https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={apiKey}`.
- **Model Selected**: `gemini-1.5-flash`.
- **Rationale**:
  - `gemini-1.5-flash` is Google's recommended lightweight, low-latency, multimodal model for high-speed structured generation.
  - Native JSON mode (`generationConfig: { responseMimeType: "application/json" }`) produces clean JSON text without markdown preamble.
  - Generous context window comfortably accommodates grounded candidate catalogs (up to 30 places with descriptions and operating hours) in a single turn.
  - Low latency minimizes user wait times on the `AIGeneratingPage`.
- **References**:
  - Google AI for Developers: *Gemini API Structured Outputs (JSON Mode)*: `https://ai.google.dev/gemini-api/docs/structured-output`
  - Google AI for Developers: *Models and Endpoints*: `https://ai.google.dev/gemini-api/docs/models/gemini`

---

## 4. Secret Configuration Status

| Environment Location | Status | Action Taken / Security Control |
| :--- | :--- | :--- |
| Client-side bundles / `dist/` | **CLEAN** | No secret tokens or keys exist in frontend code or `VITE_*` environment variables. |
| Supabase Edge Function Secrets | **NOT CONFIGURED** | `GEMINI_API_KEY` is not present in the current local environment. |
| Error Logs & Exception Handlers | **PROTECTED** | `sanitizeErrorMessage` regex redacts all `key=...` patterns and strips any key strings (`[REDACTED_KEY]`). |
| Compromised Key Handling | **ENFORCED** | The previously exposed key in earlier logs is marked invalid; it has not been reused or saved anywhere. |

---

## 5. Request and Response Contracts

### Client-to-Edge Request (`GenerateItineraryRequest`)
```json
{
  "tripId": "b1a2c3d4-...",
  "preferences": {
    "durationDays": 2,
    "budget": 3000000,
    "peopleCount": 2,
    "companionType": "couple",
    "transportation": "car",
    "travelStyle": "balanced",
    "language": "vi"
  }
}
```

### Edge-to-Client Response (`GenerateItineraryResponse`)
```json
{
  "success": true,
  "itinerary": {
    "tripTitle": "Hành trình cố đô Huế 2 ngày",
    "daysCount": 2,
    "totalEstimatedCost": 700000,
    "totalDistanceKm": 8.4,
    "estimatedTravelMinutes": 35,
    "days": [
      {
        "dayNumber": 1,
        "title": "Ngày 1: Tinh hoa di sản",
        "estimatedCost": 400000,
        "totalDistanceKm": 4.2,
        "estimatedTravelMinutes": 20,
        "activities": [
          {
            "placeId": "0e86b0df-...",
            "title": "Khám phá Đại Nội Huế",
            "activityType": "visit",
            "startTime": "08:30",
            "endTime": "11:00",
            "durationMinutes": 150,
            "orderIndex": 1,
            "estimatedCost": 200000,
            "transportation": "car",
            "travelMinutes": 15,
            "distanceKm": 4.2,
            "notes": "Tham quan Ngọ Môn và Điện Thái Hòa",
            "localTip": "Nên đến sớm để có ảnh đẹp không bị chói nắng",
            "isAiGenerated": true
          }
        ]
      }
    ],
    "warnings": []
  },
  "metadata": {
    "provider": "gemini-1.5-flash",
    "groundedPlaceCount": 12,
    "generatedAt": "2026-10-18T02:35:00.000Z"
  }
}
```

### Error Responses (`GenerateItineraryErrorResponse`)
- `401 Unauthorized`: `{ "code": "UNAUTHORIZED", "message": "Missing or invalid Authorization header." }`
- `403 Forbidden`: `{ "code": "FORBIDDEN", "message": "Access to the specified trip is forbidden." }`
- `404 Not Found`: `{ "code": "NO_PLACES", "message": "No active destinations available in Huế to plan this trip." }`
- `422 Unprocessable Entity`: `{ "code": "UNKNOWN_PLACE_ID" | "DAY_COUNT_MISMATCH" | "INVALID_TIME_ORDER", "message": "..." }`
- `429 Too Many Requests`: `{ "code": "PROVIDER_RATE_LIMIT", "message": "Gemini rate limit exceeded." }`
- `502 Bad Gateway`: `{ "code": "PROVIDER_ERROR", "message": "Network error contacting Gemini provider." }`
- `503 Service Unavailable`: `{ "code": "PROVIDER_NOT_CONFIGURED", "message": "Gemini API key is not configured on the server." }`
- `504 Gateway Timeout`: `{ "code": "PROVIDER_TIMEOUT", "message": "Gemini API request timed out." }`

---

## 6. Grounding and Validation Behavior

Every itinerary generated by the AI provider passes through server-side validation (`validator.ts`):
1. **Catalog Verification**: Every `placeId` in model output must match an active destination in the trusted Supabase catalog. Hallucinated IDs trigger `UNKNOWN_PLACE_ID` (HTTP 422).
2. **Fact Hydration**: Operating hours, admission fees, and coordinates are hydrated directly from database records. The model cannot fabricate prices or GPS coordinates.
3. **Temporal Bounds**:
   - `startTime < endTime` must hold for all activities.
   - Activities must stay within daytime operating bounds (06:00 to 23:00).
   - Overlapping activities on the same day are rejected with `INVALID_TIME_ORDER`.
4. **Day Count Consistency**: The generated days array length must exactly match `preferences.durationDays`. Any mismatch triggers `DAY_COUNT_MISMATCH`.
5. **Truthful Attribution**: AI generated activities have `isAiGenerated: true`.

---

## 7. Fallback Behavior

When AI generation is unavailable (e.g. unconfigured key, rate limit, timeout, or network disconnect):
1. `generateAItinerary` returns `{ success: false, code: 'PROVIDER_NOT_CONFIGURED', error: '...' }`.
2. `AIGeneratingPage` logs the event, sets `fallbackUsed: true`, and invokes `planDeterministicItinerary` using the same trip preferences and verified Supabase place records.
3. The deterministic itinerary has `isAiGenerated: false` for all activities.
4. The itinerary is persisted via `persistPlannedItinerary(trip.id, plannedItinerary)`.
5. The user is navigated to `/trip/:id` with location state `{ fallbackUsed: true, fallbackReason }`.
6. `TripResultPage` displays a non-blocking informational notice:
   *"Standard Route: AI planning was unavailable or unconfigured. Your itinerary was planned using verified destination optimization."*

---

## 8. Persistence and Authorization Findings

1. **Authorization & Tenant Isolation**:
   - Authentication is strictly required before trip planning or generation. Unauthenticated callers are blocked at `PlanTripPage` and receive `401 Unauthorized` on the Edge Function.
   - If a `tripId` is supplied, the Edge Function queries `trips` to verify `trip.user_id === authUser.id`. Cross-user access is blocked with `403 Forbidden`.
2. **Persistence Integrity**:
   - Itinerary persistence relies on existing authorized services (`tripDayService.ts` and `tripActivityService.ts`).
   - If persistence fails midway, compensation cleanup removes orphan days and the user remains on the generating screen with an actionable retry button; misleading navigation to `/trip/:id` is blocked.
   - Re-planning in `TripEditPage` preserves existing days and activities until a new plan is persisted.

---

## 9. Tests Executed and Actual Results

### A. Phase 7.2 Gemini Integration Test Suite (`tests/phase_7_2_gemini_integration.test.ts`)
Command: `npx tsx tests/phase_7_2_gemini_integration.test.ts`
Result: **55 PASSED, 0 FAILED**

| Scope F Requirement | Tests | Status | Verification Summary |
| :--- | :---: | :---: | :--- |
| 1. Valid Gemini provider response | 6 | **PASS** | Valid raw 2-day output, correct IDs, 200 OK, provider metadata, isAiGenerated === true |
| 2. Missing provider configuration | 5 | **PASS** | Missing key throws ProviderError, code PROVIDER_NOT_CONFIGURED, HTTP 503 response |
| 3. Provider timeout | 3 | **PASS** | AbortError caught, code PROVIDER_TIMEOUT, HTTP 504 Gateway Timeout |
| 4. Provider rate limit / failure | 6 | **PASS** | HTTP 429 -> PROVIDER_RATE_LIMIT; HTTP 500 -> 502 PROVIDER_ERROR |
| 5. Malformed JSON / structure | 3 | **PASS** | Broken JSON caught as INVALID_OUTPUT_FORMAT; markdown fences stripped cleanly |
| 6. Unknown / inactive place IDs | 2 | **PASS** | Hallucinated place ID rejected with 422 UNKNOWN_PLACE_ID |
| 7. Day-count mismatch | 2 | **PASS** | 1-day response for 3-day request rejected with 422 DAY_COUNT_MISMATCH |
| 8. Invalid times / ordering | 4 | **PASS** | Backwards time and overlapping activities rejected with 422 INVALID_TIME_ORDER |
| 9. Empty catalog | 2 | **PASS** | 0 places returns 404 NO_PLACES |
| 10. Deterministic fallback | 3 | **PASS** | planDeterministicItinerary succeeds with isAiGenerated === false |
| 11. No silent mock masquerade | 3 | **PASS** | Mock provider name is 'mock-grounded'; unconfigured Gemini refuses silent mock |
| 12. Duplicate submission prevention | 3 | **PASS** | Concurrent generation requests blocked by inProgressRef guard |
| 13. Failed generation preservation | 1 | **PASS** | Generation failure never calls database persistence |
| 14. Persistence failure navigation | 2 | **PASS** | Navigation blocked on persistence error; error message displayed to user |
| 15. Authentication & ownership | 3 | **PASS** | Missing token -> 401; cross-user trip access -> 403 FORBIDDEN |
| 16. Credential & stack leakage | 5 | **PASS** | API keys redacted to [REDACTED_KEY], URLs sanitized, zero stack trace in JSON response |
| Bonus: Client Mapper | 2 | **PASS** | Sets isAiGenerated === true, appends localTip to notes |

### B. Phase 7.1 Regression Test Suites
- `tests/phase_7_1_unit.test.ts`: **49 PASSED, 0 FAILED** (Offline mocked unit suite)
- `tests/phase_7_1_integration.test.ts`: **19 PASSED, 0 FAILED** (Live Supabase PostgREST & Auth integration suite)

---

## 10. Build, Lint, and Type-Check Results

| Check | Command | Result |
| :--- | :--- | :--- |
| ESLint | `npm run lint` | **PASSED** (0 errors, 0 warnings) |
| TypeScript Compiler & Vite | `npm run build` | **PASSED** (Built in 232ms, 0 type errors) |

---

## 11. Live Smoke-Test Status

- **Status**: **BLOCKED / NOT EXECUTED**
- **Explanation**: A live paid Google Gemini request was not executed because no replacement `GEMINI_API_KEY` secret is configured in the environment. Per instructions, the previously exposed key is compromised and cannot be reused.
- All integration and adapter pathways have been verified using deterministic mock fetch adapters. Live smoke testing can be executed once a valid secret is added via Supabase Edge Function Secrets (`supabase secrets set GEMINI_API_KEY=...`).

---

## 12. Known Limitations and Unresolved Issues

1. **Catalog Density**: The current active catalog has 12 verified places in Huế. For trips longer than 3–4 days with a `packed` style, available unique places may be exhausted, returning safe warnings or requiring repeat place categories.
2. **Transaction Atomicity**: Supabase PostgREST does not support multi-table client transactions across `trips`, `trip_days`, and `trip_activities`. Persistence uses sequential insertion with compensating cleanup deletion upon error.

---

## 13. Acceptance Criteria Assessment

| Acceptance Criterion | Classification | Evidence |
| :--- | :---: | :--- |
| 1. Real Gemini provider adapter follows existing provider boundary | **PASS** | `GeminiProvider implements LLMProvider` under `provider.ts` |
| 2. Secrets remain exclusively server-side | **PASS** | Client bundles contain 0 secrets; keys read from runtime server env |
| 3. Model output validated against trusted catalog | **PASS** | Hallucinated places rejected with `UNKNOWN_PLACE_ID` (Req 6 tests) |
| 4. Deterministic planner remains usable as fallback | **PASS** | Automatic fallback verified in `AIGeneratingPage` and Req 10 tests |
| 5. Plan Trip → AI Generating → Trip Result flow works truthfully | **PASS** | Truthful loading steps, AI badge, fallback banner verified |
| 6. Itinerary persistence respects schema and RLS | **PASS** | Uses existing trip services, sets `is_ai_generated: true` on activities |
| 7. Automated tests pass with results reported honestly | **PASS** | 55 Phase 7.2 tests + 68 Phase 7.1 tests passed; live smoke test reported blocked |
| 8. No unrelated features or unapproved changes | **PASS** | No chatbot, no food scanner, no unapproved migrations or deployments |

---

## 14. Deviations from Existing Architecture

**None.** The implementation adheres strictly to the existing React 19 + TypeScript frontend, Supabase Edge Functions backend, and Supabase PostgREST/RLS persistence architecture.
