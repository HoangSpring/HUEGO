# HUEGO — Phase 7.1 Completion Report: Secure AI Foundation and Grounding Pipeline

**Date**: 2026-10-17  
**Status**: Completed  
**Final Recommendation**: **PASS for Phase 7.1**  
**Target Deliverable**: `docs/PHASE_7_1_COMPLETION_REPORT.md`  

---

## 1. Executive Summary

Phase 7.1 successfully established the secure server-side foundation for future HUEGO LLM itinerary generation using Supabase Edge Functions.

The delivered Edge Function architecture (`supabase/functions/generate-itinerary/`) incorporates:
- **Strict Server-Side Boundary**: Implemented under the Supabase Edge Runtime, isolating future LLM API calls and secret credentials completely from the browser client bundle.
- **Strict Authentication & Tenant Isolation**: Requires verified Supabase Auth JWT tokens (`Authorization: Bearer <token>`). Verifies user identity via Supabase Auth and strictly enforces trip ownership (`trip.user_id === user.id`), preventing unauthorized cross-user trip access.
- **Strict Request Validation**: Payload bounds checking for `durationDays` (1..30), non-negative budget, traveler count, companion enums, transportation enums, and sanitized constraint strings. Enforces a 64 KB payload size limit and rejects non-POST HTTP methods with 405 Method Not Allowed.
- **Trusted Catalog Grounding**: Fetches active place records directly from the trusted Supabase database. Sanitizes descriptions and injects candidate records into a structured prompt, enforcing that the model can only select from active, real destinations.
- **Provider Adapter Boundary**: Separates prompt construction, LLM provider invocation, response parsing, and validation behind an extensible `LLMProvider` interface. Deploys a zero-cost, deterministic `MockLLMProvider` for offline testing, while leaving live provider adapters cleanly isolated.
- **Referential Integrity & Fact Hydration**: Validates model output against the active candidate catalog. Rejects hallucinated, unknown, or inactive place IDs with HTTP 422 (`UNKNOWN_PLACE_ID`). Hydrates factual admission fees and computes Haversine transit distances directly from trusted database coordinates.
- **Zero Regressions & Zero Live Cost**: The existing client-side deterministic planner (`src/services/trips/itineraryPlanner.ts`) and all UI pages remain completely untouched and independent. Exactly zero database writes, zero external LLM API calls, and zero schema changes were performed.

---

## 2. Pre-Implementation Gate & Prerequisite Findings

Before modifying or creating files, the pre-implementation prerequisites were verified against the local environment and repository documentation:

| # | Item | Status | Finding / Evidence |
|---|---|---|---|
| 1 | **Supabase Edge Functions Support** | **Supported** | Edge Functions execute under Deno on Supabase infrastructure. Standard Web Fetch APIs (`Request`, `Response`, `Headers`) are supported across Deno and Node v26. |
| 2 | **Local Supabase CLI Availability & Linkage** | **Available via npx (Unlinked)** | `npx supabase` resolves version `2.121.0`. The project workspace is not locally linked via Docker or remote linkage (`supabase link` has not been run; no `.supabase/` directory exists). |
| 3 | **Provider Selection Status** | **Unresolved / Open** | Neither `docs/AGENT_RULES.md`, `docs/PRD.md`, nor `docs/TECHNICAL_ARCHITECTURE.md` fixes a permanent provider. While Gemini 1.5 Flash was analyzed in Phase 7.0, provider selection remains open. Live provider integration was kept isolated, and `MockLLMProvider` was implemented. |
| 4 | **Existing Required Secrets** | **None in Workspace** | Only `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` exist in `.env`. No provider secret keys (`GEMINI_API_KEY`, `OPENAI_API_KEY`, etc.) and no `SUPABASE_SERVICE_ROLE_KEY` exist in the repository. |
| 5 | **Architectural / Schema Conflicts** | **Identified & Handled** | Live Supabase database contains 12 cultural/heritage places and zero restaurant/dining places. Prompt instructions and validator strictly prevent the generation of fabricated restaurant records. |

---

## 3. Files Created or Modified

### 3.1 Newly Created Files
1. `supabase/functions/generate-itinerary/types.ts`: Domain models, request/response contracts, candidate summary types, and error codes.
2. `supabase/functions/generate-itinerary/cors.ts`: Restrictive CORS handler allowing only approved origins (`http://localhost:5173`, `http://127.0.0.1:5173`, and env-configured domains).
3. `supabase/functions/generate-itinerary/schema.ts`: Request payload validation rules enforcing integer durations (1..30), companion enums, transportation modes, and string limits.
4. `supabase/functions/generate-itinerary/catalog.ts`: Trusted database catalog fetcher, text sanitizer, and candidate place summary processor.
5. `supabase/functions/generate-itinerary/prompt.ts`: Grounded prompt builder enforcing mandatory grounding rules and catalog injection.
6. `supabase/functions/generate-itinerary/provider.ts`: `LLMProvider` interface, `MockLLMProvider` implementation, and `LiveProviderStub`.
7. `supabase/functions/generate-itinerary/validator.ts`: Server-side output validator, referential integrity checker, and fact hydrator.
8. `supabase/functions/generate-itinerary/index.ts`: HTTP request handler, authentication gateway, pipeline coordinator, and Deno serve entrypoint.
9. `tests/phase_7_1_ai_foundation.test.ts`: Automated test suite covering all 14 required verification scenarios.
10. `docs/PHASE_7_1_COMPLETION_REPORT.md`: This completion report.

### 3.2 Modified Files
- **Zero existing files modified**: No source code in `src/`, no configuration in `vite.config.ts`, `package.json`, or `.env`, and no database migrations or schemas were modified.

---

## 4. Authentication and Authorization Design

### 4.1 Token Verification Gateway
All incoming requests to the Edge Function must supply a valid Supabase Auth JWT in the HTTP `Authorization` header:
```http
POST /functions/v1/generate-itinerary HTTP/1.1
Authorization: Bearer <supabase_jwt_access_token>
```
The handler:
1. Rejects requests lacking an `Authorization` header with `401 Unauthorized` (`code: 'UNAUTHORIZED'`).
2. Rejects tokens that do not start with `Bearer ` with `401 Unauthorized`.
3. Verifies the JWT against Supabase Auth (`/auth/v1/user`).
4. Extracts the authenticated user's ID (`user.id`).
5. **Never trusts a user ID in the request body**: Identity is strictly derived from the validated JWT claims.

### 4.2 Cross-Tenant Isolation
If a `tripId` is included in the request:
1. The server retrieves the trip record from Supabase.
2. If the trip does not exist, returns `404 Not Found` (`code: 'FORBIDDEN'`).
3. If `trip.user_id !== user.id`, immediately returns `403 Forbidden` (`code: 'FORBIDDEN'`).
4. Prevents User B from triggering itinerary generation or viewing parameters of User A's private trip.

---

## 5. Request and Response Contracts

### 5.1 Request Contract
```typescript
interface GenerateItineraryRequest {
  tripId?: string; // Optional: binds generation to an existing trip
  preferences: {
    durationDays: number; // Required: integer, 1 to 30
    budget?: number | null; // Optional: non-negative integer (VND)
    peopleCount?: number | null; // Optional: integer >= 1
    companionType?: 'solo' | 'couple' | 'family' | 'friends' | 'other' | null;
    transportation?: 'walking' | 'motorbike' | 'car' | 'taxi' | 'cyclo' | 'mixed' | null;
    interests?: string[]; // Optional: max 10 strings, each max 50 chars
    travelStyle?: 'relaxed' | 'balanced' | 'packed' | string;
    specialConstraints?: string | null; // Optional: max 500 chars (sanitized)
    startLocation?: {
      latitude: number; // -90 to 90
      longitude: number; // -180 to 180
      label?: string; // max 100 chars
    } | null;
    language?: 'vi' | 'en'; // default: 'vi'
  };
}
```

### 5.2 Success Response Contract (`200 OK`)
```typescript
interface GenerateItineraryResponse {
  success: true;
  itinerary: {
    tripTitle: string;
    daysCount: number;
    totalEstimatedCost: number | null;
    totalDistanceKm: number | null;
    estimatedTravelMinutes: number | null;
    days: Array<{
      dayNumber: number;
      title: string;
      theme?: string;
      estimatedCost: number | null;
      totalDistanceKm: number | null;
      estimatedTravelMinutes: number | null;
      activities: Array<{
        placeId: string; // Validated database foreign key
        title: string;
        activityType: string;
        startTime: string; // HH:MM
        endTime: string; // HH:MM
        durationMinutes: number;
        orderIndex: number; // 1..N
        estimatedCost: number | null; // Hydrated from DB price_min
        transportation: string | null;
        travelMinutes: number | null;
        distanceKm: number | null;
        notes: string | null;
        localTip: string | null;
        isAiGenerated: true; // Verified AI generation flag
      }>;
    }>;
    warnings: string[];
  };
  metadata: {
    provider: string; // e.g. "mock-grounded"
    groundedPlaceCount: number;
    generatedAt: string; // ISO 8601 timestamp
  };
}
```

### 5.3 Error Response Contract
```typescript
interface GenerateItineraryErrorResponse {
  success: false;
  error: {
    code:
      | 'METHOD_NOT_ALLOWED'
      | 'PAYLOAD_TOO_LARGE'
      | 'INVALID_JSON'
      | 'INVALID_REQUEST'
      | 'UNAUTHORIZED'
      | 'FORBIDDEN'
      | 'NO_PLACES'
      | 'INSUFFICIENT_PLACES'
      | 'PROVIDER_ERROR'
      | 'PROVIDER_NOT_CONFIGURED'
      | 'VALIDATION_FAILED'
      | 'INTERNAL_ERROR';
    message: string;
    details?: string;
  };
}
```

---

## 6. Trusted Catalog Retrieval and Grounding Rules

1. **Active Filter**: Queries only destinations where `is_active === true`. Inactive destinations are strictly excluded from the prompt candidate catalog.
2. **Text Sanitization**: Strips HTML/XML tags (`<...>` characters) and normalizes whitespace in stored descriptions to prevent indirect prompt injection.
3. **No Dining Fabrication**: Because the database currently contains 0 food/restaurant places, the prompt builder explicitly instructs:
   > *"If the candidate catalog contains only heritage/cultural sites, plan sightseeing visits and schedule appropriate time slots for meals, but DO NOT invent fake restaurant entities or fake place IDs."*
4. **Verification Truthfulness**: `CandidatePlaceSummary.isVerified` strictly matches `place.is_verified === true`. Unverified places are never mislabeled as verified.
5. **Fact Hydration**: Model-generated prices or coordinates are ignored during response processing. Admission fees are hydrated from `candidate.priceMin`, and transit distances are computed using Haversine formulas.

---

## 7. Provider Adapter Status and Unresolved Provider Decision

### 7.1 Current Status
- An extensible `LLMProvider` interface has been defined in `supabase/functions/generate-itinerary/provider.ts`.
- `MockLLMProvider` is implemented and active by default. It partitions candidate places across days deterministically, assigns sequential time slots, generates personalized contextual notes, and flags `metadata.provider: "mock-grounded"`.
- `LiveProviderStub` is implemented to catch unauthorized attempts to invoke unconfigured live models.

### 7.2 Unresolved Decisions Required Before Live Provider Calls
Before live provider calls can be made in Phase 7.2:
1. **Provider Selection**: Formally choose between Google Gemini (recommended: Gemini 1.5/2.0 Flash) or an alternative provider.
2. **Credential Provisioning**: Obtain a provider API key and store it securely in Supabase Secrets (`supabase secrets set GEMINI_API_KEY=...`).
3. **Model Parameters**: Define temperature (recommended: 0.2–0.4 for deterministic grounding) and maximum token response bounds.

---

## 8. Output Validation Rules

The validator (`validator.ts`) enforces the following 6 checks before any result is returned:
1. **Output Shape**: Validates that the payload contains a valid `days` array.
2. **Day Count**: Rejects outputs where `days.length !== preferences.durationDays` with code `DAY_COUNT_MISMATCH`.
3. **Referential Integrity**: For every activity, verifies that `rawAct.placeId` exists in the current candidate catalog map. If an unknown ID is returned, rejects the entire output with code `UNKNOWN_PLACE_ID`.
4. **Time Formatting**: Ensures `startTime` and `endTime` adhere to `HH:MM` format.
5. **Deduplication Check**: Tracks visited place IDs across all days and appends warnings if duplicate places are scheduled.
6. **Fact Hydration**: Overwrites model-proposed costs with verified `price_min` from the database. Calculates distances and transit times from GPS coordinates.

---

## 9. Tests Executed and Actual Results

The automated test suite `tests/phase_7_1_ai_foundation.test.ts` was executed locally via `npx tsx`:
```powershell
npx tsx tests/phase_7_1_ai_foundation.test.ts
```

### Test Results Matrix

| # | Test Scenario | Expected Outcome | Actual Result | Status |
|---|---|---|---|---|
| 1 | **Valid request schema** | HTTP 200, valid 2-day itinerary, provider metadata, CORS headers | HTTP 200, 2 days generated, provider: "mock-grounded", CORS matched | **PASS** |
| 2 | **Invalid or oversized request** | Rejects duration = 0 with 400; rejects > 64KB with 413 | 400 INVALID_REQUEST for duration 0; 413 PAYLOAD_TOO_LARGE for 70KB | **PASS** |
| 3 | **Missing or invalid authentication** | Rejects missing header and invalid token with 401 | 401 UNAUTHORIZED for missing auth; 401 for invalid token | **PASS** |
| 4 | **Unauthorized cross-tenant trip access** | User 123 blocked from accessing User 456's trip | HTTP 403 Forbidden with code FORBIDDEN | **PASS** |
| 5 | **Catalog retrieval failure** | Database connection error handled cleanly | HTTP 500 with sanitized INTERNAL_ERROR message | **PASS** |
| 6 | **Empty candidate catalog** | Empty places table returns 404 NO_PLACES | HTTP 404 with code NO_PLACES | **PASS** |
| 7 | **Prompt construction with grounding** | Includes grounding rules, candidate IDs, stripped XML tags | Mandatory rules present, inactive places excluded, `<script>` stripped | **PASS** |
| 8 | **Malformed provider response** | Missing `days` array rejected | HTTP 422 Unprocessable Entity with code VALIDATION_FAILED | **PASS** |
| 9 | **Unknown or inactive place ID** | Hallucinated UUID detected and rejected | HTTP 422 with code UNKNOWN_PLACE_ID | **PASS** |
| 10 | **Invalid day count structure** | Model returning 1 day for 2-day request rejected | Validator catches DAY_COUNT_MISMATCH | **PASS** |
| 11 | **Missing optional place fields** | Null price handled without converting to 0 | Preserved as null, isAiGenerated: true | **PASS** |
| 12 | **Timeout or provider failure** | Simulated 15-second timeout returns 502 | HTTP 502 Bad Gateway with code PROVIDER_ERROR | **PASS** |
| 13 | **Safe error responses (No leakage)** | API keys and stack traces stripped from error output | Zero API key strings or stack traces in response body | **PASS** |
| 14 | **No database writes** | Zero write operations triggered | 0 database write operations executed | **PASS** |

**Summary**: **39 assertions across 14 test scenarios: 39 PASSED, 0 FAILED**.

---

## 10. Security Considerations and Known Limitations

### 10.1 Security Considerations
- **No Client Secrets**: The Edge Function architecture ensures that future LLM provider API keys will never be included in Vite environment variables or compiled client bundles.
- **Strict Origin CORS**: Restricts access to configured origins, preventing unauthorized third-party sites from issuing authenticated requests to the Edge Function.
- **Prompt Sanitization**: Stored place descriptions and user constraints are stripped of XML/HTML brackets, mitigating indirect prompt injection.
- **Tenant Enforcement**: Trip ownership is strictly verified against the JWT caller ID.

### 10.2 Known Limitations
- **Catalog Size**: Supabase currently contains only 12 active cultural places. Long trips (e.g., 5+ days) will exhaust available unique places.
- **Dining Absence**: No food or cafe places exist in the database. Contextual dining recommendations cannot have valid `place_id` foreign keys until food records are added.
- **Mock Provider Active**: Live LLM calls are intentionally not executed in Phase 7.1 pending user provider approval and credential provisioning.

---

## 11. Local Verification Instructions

To execute the Phase 7.1 automated test suite locally:
```powershell
npx tsx tests/phase_7_1_ai_foundation.test.ts
```

To verify code quality and build integrity:
```powershell
npm run lint
npm run build
```

---

## 12. Manual Supabase Setup Required for Deployment

When ready to deploy this function to remote Supabase infrastructure in a future phase:
1. Link project via Supabase CLI:
   ```bash
   npx supabase link --project-ref <your-project-ref>
   ```
2. Set provider secret (once provider is selected):
   ```bash
   npx supabase secrets set GEMINI_API_KEY=<your-api-key>
   ```
3. Deploy the Edge Function:
   ```bash
   npx supabase functions deploy generate-itinerary
   ```

*(Note: In accordance with Phase 7.1 instructions, no deployment was executed during this phase.)*

---

## 13. Explicit Compliance Confirmations

- [x] **No Live LLM Call Performed**: Zero external API calls were made to any AI provider.
- [x] **No Database Writes**: Exactly zero insert, update, or delete operations were performed on any database table.
- [x] **No Schema Changes**: No database tables, columns, or RLS policies were modified or created.
- [x] **No Automatic Deployment**: The function was not deployed to remote infrastructure.
- [x] **No UI Integration**: The existing Plan Trip UI, AI Generating page, Trip Result page, and deterministic planner remain 100% untouched.

---

## 14. Acceptance Criteria Assessment

| Criterion | Result | Evidence |
|---|---|---|
| Edge Function Structure Created | **PASS** | `supabase/functions/generate-itinerary/` containing `index.ts`, `types.ts`, `schema.ts`, `catalog.ts`, `prompt.ts`, `provider.ts`, `validator.ts`, `cors.ts`. |
| Authentication & Authorization | **PASS** | Validates Supabase JWT, derives identity from token, enforces `trip.user_id === user.id`. |
| Strict Request & Response Schemas | **PASS** | Bounds-checked duration (1..30), companion enums, size limit (64 KB), 405 Method Not Allowed. |
| Trusted Catalog Grounding | **PASS** | Active places fetched from database, text sanitized, prompt injected with candidate catalog. |
| Provider Adapter Boundary | **PASS** | `LLMProvider` interface with zero-cost `MockLLMProvider` and isolated `LiveProviderStub`. |
| Output Validation & Referential Integrity | **PASS** | Validates candidate `placeId`, rejects hallucinated IDs with 422, hydrates verified facts. |
| Mocked Automated Tests | **PASS** | 14 test scenarios and 39 assertions passing 100% via `tests/phase_7_1_ai_foundation.test.ts`. |
| Zero Regressions | **PASS** | `npm run lint` (0 errors, 0 warnings), `npm run build` (built in 240ms). |

---

*Phase 7.1 is complete. Antigravity has stopped and is awaiting your review before proceeding to Phase 7.2.*
