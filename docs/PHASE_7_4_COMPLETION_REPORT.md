# HUEGO — Phase 7.4: Live Gemini Verification & AI Production Readiness

## 1. Assessment

**PASS WITH FIXES — offline and mocked verification passed; live-provider verification is BLOCKED / NOT EXECUTED.** The real Gemini API was not contacted, and the deployed Edge Function state and server-managed secret state could not be verified from this workspace. This report does not claim production readiness.

## 2. Preflight Findings

- The current provider implementation was configured for `gemini-2.5-flash` at `https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent`, using `generationConfig.responseMimeType: application/json`. The Phase 7.3 report instead referred to `gemini-1.5-flash`; the checked-in provider was the source of truth.
- Google currently lists `gemini-3.8-flash` as a stable model and recommends the latest models for new projects. It supports structured outputs. The official Generate Content documentation demonstrates the `:generateContent` REST endpoint and JSON response schema for this model. The model supports low, medium, and high thinking levels; the request does not set the unsupported `minimal` level.
- `gemini-3.8-flash` was selected. The existing endpoint and `generationConfig` format are compatible. The request now includes an explicit JSON response schema matching the fields consumed by the existing parser and validator.
- **Deployment:** not verifiable. There is no Supabase CLI, local Supabase project configuration/link metadata, or deployment evidence in this checkout. Phase 7.1’s separate integration suite did successfully read from a configured Supabase project, but that does not prove the Edge Function is deployed.
- **Replacement key:** absent from local `.env` and the current process environment (presence checked only). The Supabase-managed Edge Function secret store is not accessible from this workspace, so remote secret presence is unverified.
- **Git metadata:** no `.git` directory was present in the workspace; the checked-out files were inspected directly.

Official references, checked 2026-10-18:

- [Gemini models](https://ai.google.dev/gemini-api/docs/models)
- [Gemini 3.8 Flash model details](https://ai.google.dev/gemini-api/docs/models/gemini-3.8-flash)
- [Structured outputs](https://ai.google.dev/gemini-api/docs/structured-output)
- [Generate Content API and structured output examples](https://ai.google.dev/gemini-api/docs/generate-content/structured-output)
- [Gemini API changelog](https://ai.google.dev/gemini-api/docs/changelog)

## 3. Changes

- `supabase/functions/generate-itinerary/provider.ts`: changed the default to stable `gemini-3.8-flash`; added an explicit JSON response schema; moved the API key from the URL query string to the `x-goog-api-key` header.
- `supabase/functions/generate-itinerary/index.ts`: provider failures now return safe, generic public messages instead of upstream error text or details.
- `src/pages/AIGenerating/AIGeneratingPage.tsx`: an unexpected thrown service error now stops with an error state; it no longer triggers fallback. The existing allowlist remains the only source of fallback eligibility.
- `tests/phase_7_2_gemini_integration.test.ts`: asserts default model, JSON/schema request construction, and header-based key transport using mocked fetch; updates metadata expectation.
- `tests/phase_7_3_hardening_e2e.test.ts`: updates the model expectation to the selected stable model.
- `docs/PHASE_7_4_COMPLETION_REPORT.md`: records evidence, scope, limitations, and the repeatable smoke procedure below.

No schema, RLS, authentication, ownership, or deployment settings were changed.

## 4. Test Outcomes and Classification

All four suites below passed in the final run. Counts are the suites’ reported assertions; no additional counts are inferred.

| Command | Outcome | Classification |
|---|---:|---|
| `npx tsx tests/phase_7_1_unit.test.ts` | 49 passed, 0 failed | Mocked/offline unit tests |
| `npx tsx tests/phase_7_1_integration.test.ts` | 19 passed, 0 failed | Read-only live Supabase catalog/Auth checks, plus local handler with mock provider; no live Gemini call or database write |
| `npx tsx tests/phase_7_2_gemini_integration.test.ts` | 60 passed, 0 failed | Mocked Gemini HTTP responses and local handler; no live Gemini call |
| `npx tsx tests/phase_7_3_hardening_e2e.test.ts` | 43 passed, 0 failed | Mocked/local integration checks; live Gemini status correctly reports blocked |
| `npm run lint` | Passed | Static lint |
| `npm run build` | Passed | TypeScript and Vite production build; Vite emitted a large-chunk advisory |

An earlier rerun found a stale Phase 7.3 assertion for the old model. The assertion was updated and the suite passed on the final run.

### Behavior covered by existing and updated tests

- Missing/invalid authentication and cross-user trip access are rejected.
- Invalid requests, unknown place IDs, day-count mismatch, and invalid scheduling are rejected without eligible fallback codes.
- The active candidate catalog is the source for place identity, coordinates, and pricing used by validation/hydration. The validator computes route estimates from trusted candidate coordinates and admission costs from candidate records.
- Provider timeout, rate limit, server error, malformed JSON, and secret-redaction behavior are covered with mocked responses.
- Persistence failure blocks success navigation in the existing mocked/local lifecycle tests. AI metadata mapping and reload metadata are simulated by tests; no live trip was generated, persisted, or reloaded in this phase.
- The Phase 7.1 integration suite queried the configured Supabase project read-only; its local itinerary handler used a mock provider.

Opening hours are present in trusted candidate data but are not returned as model-authored facts. This phase did not perform a deployed-function check that compares proposed visit times to live opening-hour records.

## 5. Repeatable Live Smoke Procedure

This procedure is **not yet executed**. Never paste a Gemini key into chat, source code, a frontend variable, or this report.

1. In the Supabase Dashboard, add a newly rotated replacement key as the Edge Function secret `GEMINI_API_KEY`. Treat the previously exposed key as compromised; do not reuse it.
2. Confirm the intended Supabase project and deploy `generate-itinerary` through the project’s normal authorized deployment process. Deployment was not performed as part of Phase 7.4.
3. Sign into the deployed HUEGO app with a test account that owns a draft trip, and create a one-day itinerary through the normal Plan Trip flow.
4. In the browser Network panel, verify the request goes to the deployed `generate-itinerary` function and carries the signed-in user’s normal Supabase authorization. Do not copy or share the bearer token. Verify the returned metadata provider is `gemini-3.8-flash`, the response is successful, and returned place IDs are present in the active trusted catalog.
5. Open the result. Confirm activities are marked `is_ai_generated: true` after loading the saved trip again, the AI label is shown, and no deterministic-fallback notice is shown. Check that factual place details are sourced from the place records, not model text.
6. Repeat with a deliberately unavailable/invalid provider setup only in a non-production test environment. Confirm an approved recoverable provider code produces the existing clearly labeled fallback; confirm auth, request, grounding, or validation errors do not fall back; confirm a save failure stays an error and does not navigate to a success result.
7. Inspect function logs and responses for secrets, prompts, stack traces, or private trip details. This implementation sends the Gemini key in a server-side header and returns generic provider failure text.

This UI-based procedure verifies the deployed authentication-to-generation-to-persistence lifecycle. The automated local tests are not a substitute for those live checks.

## 6. Live Verification and Deployment Status

- **Live Gemini API:** BLOCKED / NOT EXECUTED; no replacement key was available in the local/process environment. The remote Supabase-managed secret state is unverified.
- **Deployed `generate-itinerary` function:** unverified; no deployment evidence or linked Supabase CLI context was available.
- **Live authenticated request, live place grounding through the deployed function, and persisted/reloaded `is_ai_generated: true`:** not performed.
- **Mocked provider/request construction:** passed in Phase 7.2 tests. It does not demonstrate real-provider compatibility at runtime.
- **Manual action needed:** rotate/create a replacement key, add it only through Supabase-managed Edge Function Secrets, verify/deploy the function in the intended project, and execute the procedure above with an authenticated test trip. Review those live results before treating the system as production-ready.

## 7. Final Gate

**PASS WITH FIXES for the completed offline readiness work; live production verification remains BLOCKED / NOT EXECUTED.** No Phase 7.5 work was started, and no remote deployment or production configuration was changed.

## 8. Ownership 404 Debug Addendum

The follow-up investigation traced the reported `404 FORBIDDEN` response to the local trip lookup authorization context:

- `defaultAuthVerifier` validated the incoming caller JWT, but `defaultTripFetcher` queried `trips` with the anon key as its bearer token. Since the trips table is RLS-protected, that request could not read the authenticated caller's row.
- The lookup also returned `null` for every non-2xx response and network/JSON error. The handler mapped `null` to the same 404 as a genuinely missing or RLS-hidden trip.
- Frontend trip creation stores `user_id` from `auth.getUser()` and passes the inserted `trip.id` directly in the URL and request state. The owner column and created ID flow were consistent in local code.
- The frontend project host was `lshdvvsgwivlnpirxgjy.supabase.co`; `functions.invoke` routes through that same configured Supabase client. The deployed function's runtime project settings and code version could not be inspected here, so deployment parity remains unverified.

Fix: the trip query now uses the verified caller JWT in its `Authorization` header while retaining the anon key as `apikey`. A real no-visible-row response remains a non-disclosing 404; query/configuration failures now return a generic 500. A regression suite verifies the forwarded JWT, successful owner lookup, query-error distinction, missing-row behavior, and continued 403 protection for a visible trip owned by another user.

Files changed for this addendum: `supabase/functions/generate-itinerary/index.ts`, `supabase/functions/generate-itinerary/schema.ts` (use the existing `zod` import-map name so Node/tsx can run the Edge Function tests), and `tests/phase_7_4_trip_ownership.test.ts`.

Verification: new ownership regression **7 passed, 0 failed**; Phase 7.1 unit **49 passed, 0 failed**; Phase 7.1 integration **19 passed, 0 failed**; Phase 7.2 **60 passed, 0 failed**; Phase 7.3 **43 passed, 0 failed**; `npm run lint` and `npm run build` passed. The integration suite includes read-only live Supabase checks but does not verify this user's trip, the deployed function version, or live Gemini behavior. No remote deployment was performed.
