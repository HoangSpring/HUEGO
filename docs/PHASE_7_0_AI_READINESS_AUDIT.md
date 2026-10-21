# HUEGO — Phase 7.0: AI Readiness Audit Report

**Date**: 2026-10-17  
**Auditor**: Antigravity AI Pair Programmer  
**Scope**: Read-only codebase and documentation audit for AI/LLM integration readiness  
**Target File**: `docs/PHASE_7_0_AI_READINESS_AUDIT.md`  

---

## 1. Executive Summary

### 1.1 Overall Readiness Verdict
**READY WITH CONDITIONS**

The HUEGO codebase possesses a robust, mature, and verified deterministic trip-planning foundation. Phase 6 (Phases 6.1 through 6.4) successfully established end-to-end trip creation, database persistence across `trips`, `trip_days`, and `trip_activities`, geographical sequencing, transit time estimation, activity editing, and re-planning. 

However, **direct LLM integration cannot proceed in the current client-only architecture without first creating a secure server-side execution layer**. In addition, strict data grounding constraints must be enforced due to the current size and nature of the destination catalog in Supabase.

### 1.2 Top Three Findings
1. **No Secure Server-Side Execution Layer**: HUEGO is currently a 100% client-side Single Page Application (React 19 + TypeScript + Vite) connecting directly to Supabase PostgREST and Auth. There are no Supabase Edge Functions, Node.js backend services, or serverless API routes in the repository. Calling an external LLM API directly from the client would expose provider API keys in browser bundles, directly violating `docs/AGENT_RULES.md`, `docs/TECHNICAL_ARCHITECTURE.md`, and `docs/new/01_BUSINESS_REQUIREMENTS_HUEGO.md`.
2. **Catalog Scope and Grounding Limitations**: The live Supabase database contains exactly 12 active destinations, all of which are cultural, historical, or scenic landmarks (e.g., Đại Nội, Thiên Mụ Pagoda, royal tombs). There are zero food, restaurant, cafe, or accommodation records. Any LLM integration must strictly restrict destination choices to this grounded catalog to prevent generating fake place entities or unresolvable foreign keys.
3. **Deterministic Planner Serves as an Ideal Fallback**: The deterministic planner implemented in `src/services/trips/itineraryPlanner.ts` is fully operational, handles all edge cases gracefully, computes Haversine distances and transit times, validates opening hours, and records `is_ai_generated: false`. This provides a zero-downtime fallback mechanism whenever AI services timeout, rate-limit, or fail schema validation.

### 1.3 Main Blockers
- **Blocker 1 (Architectural / Security)**: Lack of a server-side execution boundary (e.g. Supabase Edge Functions in `supabase/functions/`) to store provider API keys and authenticate AI requests.
- **Blocker 2 (Operational / Decision)**: Unresolved LLM provider and model selection (e.g., Google Gemini 1.5/2.0 Flash vs. other providers) and absence of provider credentials in the server environment.
- **Blocker 3 (Data Catalog)**: Absence of restaurant/dining records in Supabase prevents the AI from generating complete dining recommendations with valid `place_id` foreign keys without hallucinating.

---

## 2. Source Inventory

### 2.1 Documents and Source Files Inspected

#### Product & Architecture Documentation
- `docs/AGENT_RULES.md`: Core MVP development guidelines, architecture rules, UX flow requirements.
- `docs/PRD.md`: Product vision, target persona, MVP feature priorities (P0/P1/P2), AI principles.
- `docs/USER_FLOW.md`: Approved screen mapping, navigation, and detailed user flow (SCR-01 through SCR-10).
- `docs/DATABASE_SCHEMA.md`: Initial MVP schema design (v0.1).
- `docs/TECHNICAL_ARCHITECTURE.md`: High-level system architecture, service layer boundaries, security guidelines.
- `docs/SCREEN_SPEC.md`: Screen specifications and state transitions for SCR-01 to SCR-10.
- `docs/new/01_BUSINESS_REQUIREMENTS_HUEGO.md`: Updated business requirements, AI principles, live schema rules.
- `docs/new/02_AI_UI_IMPLEMENTATION_SPEC.md`: AI UI execution specifications, screen behaviors, UX rules.
- `docs/new/03_TECHNICAL_SPEC_AI_FRONTEND.md`: Frontend AI technical spec, request/response contracts, error mapping.
- `docs/new/04_TECHNICAL_SPEC_AI_ADMIN.md`: Admin MVP specification for destination management.
- `docs/new/05_UI_SPEC_USER_STITCH.md`: UI specifications for user-facing application screens.
- `docs/new/06_UI_SPEC_ADMIN_STITCH.md`: UI specifications for administration screens.

#### Previous Phase Completion Reports
- `docs/PHASE_6_2B_COMPLETION_REPORT.md`: Deterministic itinerary planning engine implementation.
- `docs/PHASE_6_2B_REVIEW_REPORT.md`: Persistence safety and transactional rollback review.
- `docs/PHASE_6_2C_COMPLETION_REPORT.md`: UI and service integration for Plan Trip, AI Generating, and Trip Result.
- `docs/PHASE_6_3_COMPLETION_REPORT.md`: Trip Result database loading, editing actions, and re-planning flow.
- `docs/PHASE_6_4_COMPLETION_REPORT.md`: End-to-end hardening, multi-user RLS verification, and regression test results.

#### Application Source Files Inspected
- `src/services/supabase/client.ts`: Supabase client initialization using `import.meta.env`.
- `src/types/database.ts`: TypeScript interfaces for `places`, `place_categories`, `place_images`, `trips`, `trip_days`, `trip_activities`, `favorites`, `user_preferences`.
- `src/types/trip.ts`: UI and domain types for trip state.
- `src/contexts/AuthProvider.tsx` & `src/contexts/authContext.ts`: Supabase authentication context and session tracking.
- `src/services/trips/tripService.ts`: CRUD operations for user trips.
- `src/services/trips/tripDayService.ts`: CRUD operations for trip days.
- `src/services/trips/tripActivityService.ts`: CRUD operations for trip activities.
- `src/services/trips/itineraryPlanner.ts`: Deterministic itinerary planner engine and `persistPlannedItinerary`.
- `src/services/maps/distanceService.ts`: Haversine distance and transit time calculations.
- `src/services/places/placeService.ts`: Destination fetching and filtering from Supabase.
- `src/pages/PlanTrip/PlanTripPage.tsx`: Plan trip form input collection and draft trip persistence.
- `src/pages/AIGenerating/AIGeneratingPage.tsx`: Progress step indicator and itinerary planning coordinator.
- `src/pages/TripResult/TripResultPage.tsx`: Database-driven itinerary result display.
- `src/pages/TripEdit/TripEditPage.tsx`: Trip settings editor, activity reordering, add/remove, and re-plan trigger.
- `src/pages/MyTrips/MyTripsPage.tsx`: User saved trip list.
- `src/routes/AppRouter.tsx`: Application route configuration and route protection.
- `package.json`: Project dependencies and scripts.
- `.env` & `.env.example`: Environment variable definitions.
- `vite.config.ts`: Vite bundling configuration.

### 2.2 Missing Files
- `docs/PHASE_6_1_AUDIT_REPORT.md`: Not present as a standalone file in `docs/` (existed in conversation context history).
- `docs/PHASE_6_2A_COMPLETION_REPORT.md`: Not present as a standalone file in `docs/` (existed in conversation context history).
- `AGENTS.md` (root): Does not exist at repository root; the authoritative rules reside in `docs/AGENT_RULES.md`.
- `docs/migrations/*`: The `docs/migrations` directory exists on disk but is empty.
- `supabase/`: No Supabase local CLI directory, Edge Functions, or migrations exist in the workspace.
- `test/` or automated test files: No test framework (Vitest/Jest) or test files exist within `src/` or the repository root.

### 2.3 Reports Not Verifiable Against Current Source
- Initial statements in `docs/DATABASE_SCHEMA.md` v0.1 referencing table names `categories` and `trip_items` and columns `place_images.image_url`: These reflect initial design drafts that were subsequently superseded by actual Supabase tables `place_categories`, `trip_activities`, and `place_images.storage_path` (as documented and aligned during Phase 6.2A).

---

## 3. Product Requirements Matrix

| Requirement | Source Document & Section | Current Implementation Status | Repository Evidence | Remaining Gap |
|---|---|---|---|---|
| **P0: Plan Trip Form Input Collection** | `PRD.md` §4, §5; `USER_FLOW.md` §7; `SCREEN_SPEC.md` SCR-03 | **Fully Implemented** | `src/pages/PlanTrip/PlanTripPage.tsx` collects `durationDays`, `budget`, `travelersCount`, `companionType`, `transportation`, `constraints`. | None for deterministic planning. Future AI can consume `constraints` for contextual personalization. |
| **P0: Multi-Stage Generating Screen** | `PRD.md` §5; `USER_FLOW.md` §8; `SCREEN_SPEC.md` SCR-04; `docs/new/02_AI_UI_...` §4 | **Fully Implemented** | `src/pages/AIGenerating/AIGeneratingPage.tsx` displays sequential stages (Preparing destinations, Creating itinerary, Optimizing route, Calculating cost). | Currently calls client-side deterministic planner instead of remote AI endpoint. |
| **P0: Structured Itinerary Generation** | `PRD.md` §4, §7; `USER_FLOW.md` §8, §9; `docs/new/01_BRD...` §8 | **Partially Implemented (Deterministic Only)** | `src/services/trips/itineraryPlanner.ts` (`planDeterministicItinerary`) generates full multi-day plans using real DB places. | LLM-generated personalization, dynamic reasoning, and contextual activity narratives are not yet active. |
| **P0: Trip Result Display** | `PRD.md` §5; `USER_FLOW.md` §9; `SCREEN_SPEC.md` SCR-05 | **Fully Implemented** | `src/pages/TripResult/TripResultPage.tsx` renders day tabs, activities, times, transit estimates, and admission fees from Supabase. | No field currently highlights AI-generated insights or rationale cards. |
| **P0: Trip Edit & Re-planning** | `PRD.md` §5; `USER_FLOW.md` §10; `SCREEN_SPEC.md` SCR-06 | **Fully Implemented** | `src/pages/TripEdit/TripEditPage.tsx` supports reordering, day changes, destination additions/removals, and triggers re-plan to SCR-04. | Re-plan currently calls the deterministic planner rather than an AI re-planning prompt. |
| **P1: Strict Grounding to Real Places** | `PRD.md` §7; `docs/new/01_BRD...` §6, §8; `docs/new/02_AI_UI_...` §1 | **Fully Enforced (in Planner)** | `itineraryPlanner.ts` lines 182-192 filter `places.filter(p => p.is_active)` and never fabricate fake IDs or external venues. | Must be enforced on the future LLM response parser before database persistence. |
| **P1: Truthful AI Attribution** | `docs/new/01_BRD...` §6; `PHASE_6_4_COMPLETION_REPORT.md` §1 | **Fully Implemented** | `trip_activities.is_ai_generated` column is set to `false` for all deterministic activities (`itineraryPlanner.ts` line 470). | When LLM integration is live, AI-generated activities must set `is_ai_generated: true`. |
| **P1: Route & Transit Estimation** | `PRD.md` §4, §6; `TECHNICAL_ARCHITECTURE.md` §7 | **Fully Implemented** | `src/services/maps/distanceService.ts` computes Haversine distances and transit minutes with buffer. | LLM should not hallucinate travel distances; client/server math should compute or verify them. |
| **P2: Conversational Travel Chat / Assistant** | `docs/new/02_AI_UI_...` §3; `docs/new/05_UI_SPEC...` §Visual direction | **Explicitly Out of Scope** | Product documents explicitly forbid turning the app into a generic chatbot widget. | No chatbot interface should be built. Focus remains on structured itinerary generation. |
| **P2: Food & Dining Recommendations** | `PRD.md` §4 | **Unimplemented (Data Blocker)** | Supabase contains 0 food/restaurant places in `places` table. | Cannot generate grounded dining stops with `place_id` foreign keys until food places are added to DB. |

---

## 4. Architecture Assessment

### 4.1 Current Execution Architecture
```
[Browser: React 19 + TypeScript + Vite SPA]
   │
   ├── Auth Context (Supabase Auth JWT: session.access_token)
   ├── Routing (React Router 7: /plan, /ai-generating, /trip/:id, /trip/:id/edit)
   ├── UI Pages (PlanTripPage, AIGeneratingPage, TripResultPage, TripEditPage)
   │
   └── Client Services Layer
         ├── placeService.ts ─────────┐
         ├── distanceService.ts       │ Direct PostgREST queries
         ├── itineraryPlanner.ts ─────┼────────────────────────► [Supabase Backend]
         ├── tripService.ts ──────────┤ (VITE_SUPABASE_URL)        ├── PostgreSQL DB
         ├── tripDayService.ts ───────┤ (VITE_SUPABASE_ANON_KEY)   └── Supabase Auth
         └── tripActivityService.ts ──┘
```

The application currently has **no backend application server or serverless function layer**. Everything executes inside the user's browser thread.

### 4.2 Available Server-Side Options

| Option | Feasibility | Security & Key Protection | Architectural Fit | Maintenance Overhead |
|---|---|---|---|---|
| **1. Supabase Edge Functions (Deno)** | **High (Recommended)** | Excellent. Secrets stored in Supabase Vault; callable via `supabase.functions.invoke`. | Native. Supabase is already the core BaaS. Zero new hosting providers required. | Very Low. Deployed directly to the existing Supabase project. |
| **2. Standalone Node.js / Express Server** | Medium | Good, but requires external hosting (Render, Railway, Fly.io, etc.). | Poor. Introduces a second backend environment, separate CORS, separate auth sync. | High. Requires managing server infrastructure, deployments, and monitoring. |
| **3. Vercel Serverless Functions** | Medium | Good. Secrets stored in Vercel Environment Variables. | Moderate, but only if frontend is deployed on Vercel. Couples hosting to Vercel. | Low to Moderate. |

**Recommendation**: **Supabase Edge Functions** is the most architecturally consistent, secure, and low-friction option. The Supabase client library `@supabase/supabase-js` already includes native support for `supabase.functions.invoke()`, automatically attaching the active session's JWT authorization header.

### 4.3 Recommended Integration Boundary
```
[Browser: React SPA]
   │
   │ 1. POST /functions/v1/generate-itinerary
   │    Headers: Authorization: Bearer <user_jwt>
   │    Body: { tripId, preferences, language }
   ▼
[Supabase Edge Function: generate-itinerary]
   │
   ├── 2. Verify JWT & User Authorization (auth.uid())
   ├── 3. Fetch candidate places from Supabase DB (is_active = true)
   ├── 4. Construct grounded prompt with candidate place catalog
   │
   ├── 5. Call LLM API (Google Gemini / chosen provider)
   │      Using private server secret: GEMINI_API_KEY
   │
   ├── 6. Parse structured JSON response
   ├── 7. Validate schema & ensure all place_ids match DB candidate catalog
   ├── 8. Hydrate verified facts (exact coordinates, hours, prices from DB)
   │
   │ 9. Return validated PlannedItinerary JSON
   ▼
[Browser: AIGeneratingPage]
   │
   ├── 10. Persist to Supabase via persistPlannedItinerary (is_ai_generated: true)
   │       (OR have Edge Function persist directly)
   └── 11. Navigate to /trip/:tripId
```

### 4.4 Existing Modules That Can Be Reused
- `src/services/trips/itineraryPlanner.ts`:
  - `persistPlannedItinerary`: Fully handles atomic replacement of days and activities, pre-validation, RLS authorization checks, and compensation rollback.
  - `planDeterministicItinerary`: Retained as the instant, zero-cost fallback when AI is unavailable.
- `src/services/maps/distanceService.ts`:
  - `calculateDistanceKm` & `estimateTravelMinutes`: Can be used to calculate or verify distance and transit times between AI-selected places.
- `src/types/database.ts`:
  - Canonical data models for `TripRow`, `TripDayRow`, `TripActivityRow`, and `PlaceRow`.
- `src/pages/AIGenerating/AIGeneratingPage.tsx`:
  - Step progression UI, cancellation safety (`isMountedRef`), retry handling, and error states.
- `src/pages/TripResult/TripResultPage.tsx` & `TripEditPage.tsx`:
  - UI display, day tabs, re-planning triggers, and manual activity adjustments.

### 4.5 Required Architectural Changes
1. Create a `supabase/functions/` directory containing the Edge Function (e.g. `generate-itinerary`).
2. Add server-side secret management for the LLM provider API key in Supabase Secrets.
3. Implement an AI client service in `src/services/ai/aiPlanService.ts` to call `supabase.functions.invoke('generate-itinerary')`.
4. Update `AIGeneratingPage.tsx` to call `aiPlanService.generateItinerary()`, falling back to `planDeterministicItinerary()` upon failure.

---

## 5. Data Grounding and Planner Assessment

### 5.1 Current Planner Behavior
The deterministic planner (`itineraryPlanner.ts`) executes the following sequential steps:
1. Validates `daysCount` (1..30).
2. Retrieves all places where `is_active === true`.
3. Scores places based on user interest match (categories and slugs), verified ratings, and iconic landmark bonuses.
4. Partitions places across days (2-4 places/day based on travel style: relaxed, balanced, packed).
5. Enforces deduplication using a `Set<string>` so no place is scheduled twice.
6. Orders places within each day using a nearest-neighbor TSP heuristic based on GPS coordinates.
7. Schedules a timeline starting at 08:30, checking opening times, applying 60-minute visit durations (or `duration_minutes` from DB), and inserting a lunch buffer (11:30–13:30).
8. Calculates estimated ticket costs from `price_min`.
9. Flags `is_ai_generated: false` for all activities.

### 5.2 Data Limitations
1. **Catalog Volume**: Exactly 12 active destinations exist in Supabase.
   - For a 1-day or 2-day trip (2–6 places), coverage is good.
   - For a 3-day trip (6–9 places), coverage is sufficient.
   - For trips > 3 days (10–15 places), the catalog is nearly or completely exhausted, leaving some days with few or no activities.
2. **Missing Place Categories**:
   - 0 restaurants, cafes, food stalls, or street food venues.
   - 0 hotels, hostels, or accommodation entities.
3. **Field Completeness**:
   - `is_verified` is currently `false` for all 12 destinations.
   - Several places lack specific opening/closing times or admission pricing.

### 5.3 Hallucination Prevention Strategy
An ungrounded LLM will routinely invent fictional attractions, fabricate opening hours, assume nonexistent restaurants, and hallucinate UUIDs. To achieve 100% grounding:
1. **Candidate Catalog Injection**: The server-side function queries all active places from Supabase and passes only this list to the LLM as the authorized destination set.
2. **Strict Foreign Key Validation**: The LLM response parser must reject any activity where `placeId` does not match an ID in the provided candidate catalog.
3. **Fact Hydration from Database**: The LLM must NOT be trusted to state coordinates, admission prices, or opening hours. The server-side service should hydrate coordinates, prices, and hours directly from the database record associated with each chosen `placeId`.
4. **Role Definition**:
   - **LLM Responsibility**: Destination selection, thematic day grouping, personalized sequencing rationale, and contextual visitor tips.
   - **Database Responsibility**: Factual identity, coordinates, address, opening hours, verified ticket prices, and cover images.
   - **Code/Service Responsibility**: Haversine distance, travel time calculation, and timeline arithmetic.

### 5.4 Validation Requirements
Before any LLM-generated itinerary is displayed or persisted, it must pass a 4-tier validation pipeline:
1. **Structural Validation (Zod)**: Ensures JSON response conforms to expected schema (`title`, `days` array, `activities` array with valid types).
2. **Referential Integrity Validation**: Every `placeId` in every activity must exist in the active `places` table.
3. **Constraint Validation**:
   - `days.length === trip.days_count`.
   - Activities per day within bounds (1 to 5).
   - No duplicate `placeId` across the entire trip.
4. **Time & Sequence Validation**:
   - `startTime < endTime`.
   - Sequential gapless `order_index` (1..N).

### 5.5 Fallback Recommendation
Maintain a **Graceful Degradation Fallback**:
If the AI service encounters:
- Network error or timeout (> 15 seconds)
- Provider HTTP 429 (rate limit) or HTTP 5xx (outage)
- Malformed JSON that cannot be parsed
- Validation failure (hallucinated place IDs or schema mismatch)

Then:
1. Log the failure reason securely.
2. Execute `planDeterministicItinerary(tripConfig, places)`.
3. Display a subtle informative banner to the user: *"Generated using HUEGO's verified local itinerary engine."*
4. Ensure the user journey is NEVER blocked.

---

## 6. Security, Privacy, and Cost Risk Register

| # | Risk Area | Risk Level | Evidence in Current Codebase | Potential Impact | Recommended Mitigation |
|---|---|---|---|---|---|
| **1** | **Provider API Key Exposure** | **HIGH** | HUEGO is a pure client SPA. Putting LLM keys in `.env` (`VITE_*`) exposes them in client JavaScript bundles. | Key theft, unauthorized API usage, financial liability, account suspension. | Never store provider keys in client code or Vite env. Store exclusively in server-side secret store (Supabase Vault / Secrets). |
| **2** | **Unauthenticated / Unauthorized AI Invocation** | **HIGH** | If the AI endpoint is exposed without auth checks, anonymous actors can trigger arbitrary LLM completions. | Exhaustion of API quota, massive billing spikes, Denial of Service. | Require Supabase Auth JWT (`Authorization: Bearer <token>`). Verify caller session before invoking provider. |
| **3** | **Cross-Tenant Data Exposure** | **MEDIUM** | If AI endpoint accepts `tripId` without checking ownership, User B could read or modify User A's trip. | Privacy breach, unauthorized itinerary overwrites. | Edge Function must enforce `trip.user_id === auth.uid()` before retrieving or updating trip data. |
| **4** | **Prompt Injection via User Constraints** | **MEDIUM** | `PlanTripPage.tsx` accepts arbitrary free-text in `constraints` (up to input bounds), passed to the prompt. | System prompt jailbreaking, malformed outputs, inappropriate content generation. | Treat user text as untrusted data enclosed in XML delimiters (`<user_constraints>...</user_constraints>`). Explicitly instruct model to ignore instructions inside user tags. Validate final JSON with Zod. |
| **5** | **Rate Limiting & Abuse** | **HIGH** | No rate limiting exists on client or Supabase client calls. Rapid clicks on "Re-plan" could trigger dozens of LLM requests. | Cost runaway, provider 429 throttling for all users. | Enforce rate limits at the server boundary (e.g. max 5 AI generation requests per user per hour). Disable UI buttons during generation (`inProgressRef`). |
| **6** | **Request Timeouts & Hanging Requests** | **MEDIUM** | LLM completions can take 5–20 seconds depending on provider traffic. | Frustrated users, aborted requests, duplicate submissions. | Set strict 15-second timeout on fetch calls. Maintain calm progress indicators on `AIGeneratingPage`. Implement automatic deterministic fallback on timeout. |
| **7** | **Token Usage & Cost Inflation** | **MEDIUM** | Passing complete descriptions of all 12 places on every request inflates prompt token counts. | Higher per-request costs, slower generation times. | Serialize only minimal candidate fields (ID, name, category, short excerpt, coordinates, hours, price). Limit `max_tokens` (e.g., 1500 tokens). |
| **8** | **Sensitive Data in Logs** | **LOW** | Client currently logs `console.error(plannerError)`. Server logs might inadvertently record auth tokens or prompt text. | Exposure of user preferences or session tokens in log aggregators. | Sanitize server-side logs: never log `Authorization` headers, provider API keys, or raw user constraint text. |
| **9** | **Provider Outages & Malformed Output** | **MEDIUM** | LLMs occasionally return broken JSON, markdown code fence wrappers, or fail during provider downtime. | Frontend crash, blank generating screen, persistence failure. | Use provider structured JSON mode (`response_mime_type: "application/json"`). Implement regex JSON extraction fallback. Implement automatic deterministic fallback. |
| **10** | **Tight Coupling Preventing Deterministic Usage** | **LOW** | The deterministic planner is currently isolated in `src/services/trips/itineraryPlanner.ts` with 0 external dependencies. | If tightly coupled, an AI failure would break all trip planning across the application. | Keep `planDeterministicItinerary` completely independent of the AI service layer. |

---

## 7. Provider and Deployment Readiness

### 7.1 What Is Already Configured
- **Frontend Environment**: Vite + React 19 + TypeScript 5.8+ build pipeline is healthy, lint-clean, and passing production builds.
- **Supabase Integration**: Supabase client configured with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
- **Database Schema**: Tables `places`, `place_categories`, `place_images`, `trips`, `trip_days`, and `trip_activities` are live and aligned with TypeScript definitions.
- **Authentication**: Email/password authentication, session persistence, and RLS policies are active and verified.

### 7.2 What Remains Undecided
- **LLM Provider Choice**: Google Gemini API vs. OpenAI vs. Anthropic.
  - *Note*: Google Gemini (e.g., `gemini-1.5-flash` or `gemini-2.0-flash`) is highly advantageous due to fast inference speeds (< 3 seconds), low token pricing, native structured JSON output mode, and high token context limits.
- **Serverless Hosting Environment**: Supabase Edge Functions (recommended) vs. Vercel Serverless Functions.
- **Prompt Language Strategy**: Whether the LLM prompt should be constructed in Vietnamese, English, or bilingually depending on `trip.language`.

### 7.3 Decisions Required Before Implementation
1. **Decision on Server Layer**: Formally approve Supabase Edge Functions as the server-side integration boundary.
2. **Decision on Provider & Model**: Select the primary LLM provider (e.g., Google Gemini 1.5 Flash) and obtain a project API key.
3. **Decision on Key Management**: Store the provider API key in Supabase Secrets (`supabase secrets set GEMINI_API_KEY=...`).
4. **Decision on Dining Places**: Decide whether to add seed restaurant records to `places` or explicitly instruct the LLM to only recommend cultural/sightseeing stops for MVP.

---

## 8. Testing Strategy

### 8.1 Existing Test Capabilities
- **Current State**: No automated test runner (Vitest/Jest) is installed in `package.json`.
- **Current Verification Method**: Standalone verification scripts executed via `npx tsx` (e.g., Phase 6.4 hardening script) against live Supabase database instances.
- **Code Quality**: `npm run lint` (`eslint .`) and `npm run build` (`tsc -b && vite build`) execute cleanly.

### 8.2 Proposed Tests for Future AI Integration

#### 1. Unit Tests (Pure logic, zero API costs)
- **Prompt Construction**: Verify that user inputs (`durationDays`, `companionType`, `transportation`, `constraints`) and candidate places are serialized into the expected prompt structure.
- **Response Parsing**: Test JSON parsing with:
  - Standard JSON output.
  - JSON wrapped in Markdown code fences (````json ... ````).
  - Truncated or malformed JSON (verify parse errors are caught).
- **Schema & Grounding Validator**:
  - Test validation with valid activities matching candidate IDs.
  - Test rejection of hallucinated place IDs not present in the candidate catalog.
  - Test rejection of duplicate place IDs across multiple days.
  - Test rejection of mismatched `day_number` or activity count bounds.

#### 2. Mocked Integration Tests (No live provider calls)
- **Mocked Provider Adapter**:
  - Test simulated 200 OK with valid itinerary response.
  - Test simulated 429 Rate Limit error.
  - Test simulated 504 Gateway Timeout error.
  - Test simulated network disconnect.
- **Deterministic Fallback Integration**:
  - Simulate an AI service failure on `AIGeneratingPage` and verify that `planDeterministicItinerary` is triggered automatically, persisting a valid trip without user-facing disruption.

#### 3. End-to-End Regression Tests
- Verify that standard trip creation, trip result loading, activity editing, and re-planning continue to function without regression.

---

## 9. Recommended Next Phase

### Phase 7.1: Server-Side AI Architecture & Prototype Foundation

#### Objective
Establish the secure server-side execution environment (Supabase Edge Function), provider secret management, and grounded validation pipeline for HUEGO, without altering the existing client-side deterministic planner.

#### In-Scope Tasks
1. Initialize Supabase Edge Function infrastructure (`supabase/functions/generate-itinerary/`).
2. Implement JWT session verification in the Edge Function to authenticate callers and verify trip ownership.
3. Define strict TypeScript/Zod schemas for the AI request payload, candidate place summary, and structured itinerary output.
4. Implement candidate catalog injection: fetch active places from Supabase and construct a grounded prompt.
5. Implement the provider adapter for the chosen LLM (e.g. Gemini 1.5 Flash) with structured JSON output mode.
6. Implement server-side response validation ensuring 100% of generated `place_id` entries match active database records.
7. Create unit test scripts using mocked provider responses to verify prompt construction, JSON parsing, validation, and error handling with zero API costs.

#### Explicitly Out-of-Scope Tasks
- Modifying the existing client-side deterministic planner (`itineraryPlanner.ts`).
- Altering the live database schema or adding new database migrations.
- Adding chatbot UI components or conversational widgets.
- Placing any provider secret key in client-side Vite environment variables.
- Modifying Explore, Place Detail, HUEGO NOW, or My Trips pages.

#### Dependencies & Prerequisites
- User approval of Supabase Edge Functions as the server-side environment.
- User selection of the LLM provider (e.g. Google Gemini API) and provisioning of the server API key in Supabase Secrets.

#### Acceptance Criteria
- Edge Function successfully verifies user JWT and rejects unauthenticated requests with HTTP 401.
- Edge Function passes candidate places into prompt and strictly rejects hallucinated place IDs with validation errors.
- Mocked test suite passes 100% without live paid API calls.
- Zero secrets or keys are present in the frontend bundle.

#### Suggested Files to Create/Modify (Proposals Only)
- `supabase/functions/generate-itinerary/index.ts` *(new)*
- `supabase/functions/generate-itinerary/schema.ts` *(new)*
- `supabase/functions/generate-itinerary/prompt.ts` *(new)*
- `src/services/ai/aiPlanService.ts` *(new - client wrapper)*
- `src/services/ai/aiTypes.ts` *(new)*

---

## 10. Final Verdict

### Verdict
**READY WITH CONDITIONS**

### Justification
1. **Technical Foundation is Solid**: The HUEGO frontend, routing, Supabase data layer, and deterministic itinerary planning engine have achieved 100% verification in Phase 6.4. All database operations across `trips`, `trip_days`, and `trip_activities` are strictly typed, secure under Row Level Security (RLS), and resilient against refresh and editing errors.
2. **Security Condition Must Be Met**: Integrating an LLM directly into the current client-only Vite SPA would necessitate placing provider secret keys in client-side code, which is an unacceptable security violation. A secure server-side layer (Supabase Edge Functions) must be established in Phase 7.1 to hold provider credentials and enforce rate limits and authorization.
3. **Data Grounding Condition Must Be Met**: Because Supabase currently contains only 12 cultural/heritage places and no dining venues, the AI prompt and response validator must strictly ground all generated activities to this candidate list to prevent hallucinations and broken foreign keys.

---

## 11. Final Verification & Compliance

1. **Created Files**: The only file created during Phase 7.0 is `docs/PHASE_7_0_AI_READINESS_AUDIT.md`.
2. **Modifications**: No existing application code, configuration files (`vite.config.ts`, `package.json`, `.env`), documentation files, or database schemas were modified.
3. **External Calls**: No external LLM API calls, provider account creations, or live key usages were performed.
4. **Inspections Run**: Inspected all 16 documentation files, 21 TypeScript service and type files, 6 page components, router configuration, package dependencies, environment configurations, and past test execution records.
5. **No Unexpected Mutations**: The repository workspace remains in its exact pre-audit state.
