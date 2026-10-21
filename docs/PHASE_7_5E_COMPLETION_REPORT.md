# HUEGO — Phase 7.5E Controlled Deployment & Live Smoke Test

**Verdict: BLOCKED**

## Executive summary

Pre-deployment metadata checks independently confirmed the linked Supabase project reference `lshdvvsgwivlnpirxgjy` and the active `generate-itinerary` function at version 17. The server-managed secret inventory reported `GEMINI_API_KEY` present and did not list `GEMINI_MODEL`; secret values are intentionally omitted.

The required safe test trip is not ready or identified in this task: no authenticated test-account session or one-day test-trip identifier was provided or available in the browser inventory. Creating a trip or overwriting a production itinerary is prohibited by the phase instructions. Therefore deployment and the one live Gemini request did not proceed. No database endpoint was queried and no production data was accessed.

Local source review and verification found no local blocker. This does not establish exact source parity with the deployed function, Gemini access for this project, or live persistence/reload behavior. Git metadata is absent, so a complete working-tree diff is unavailable.

## Project and deployment status

- **Project reference:** `lshdvvsgwivlnpirxgjy`, independently confirmed by `supabase projects list --output json`; it was marked linked and healthy. This matches the target previously reported in Phase 7.5D.
- **Deployed function:** `generate-itinerary`, status `ACTIVE`, `verify_jwt=false`, version **17**. Read-only `supabase functions list --project-ref … --output json` returned version 17, updated **2026-10-19 03:42:02 UTC**. No deployment occurred in this phase.
- **Server secret names:** `GEMINI_API_KEY` is present in the server-managed function secret inventory. `GEMINI_MODEL` is absent from that inventory, so the local source default would apply after deployment. Values were not intentionally read into this report or repeated.
- **Model availability:** **NOT VERIFIED.** No Gemini request was made.
- **Deployment result:** **NOT DEPLOYED**, because there is no safe owned one-day test trip ready for the required live validation and exact deployed/local parity is not confirmed.
- **Deployment timestamp/function version for this phase:** none; no deployment occurred.

## Source and security review

- Local provider default is `gemini-3.8-flash` (`supabase/functions/generate-itinerary/provider.ts:163-164`). `GEMINI_MODEL` is trimmed and overrides the default when present (`:207`); provider metadata uses the same model (`:207-208`) as the URL (`:226-228`). This is local source evidence only.
- Structured JSON response configuration is at `provider.ts:230-295`. The request uses server-side `x-goog-api-key` (`:309-317`), a 30-second default abort timeout (`:209,305-335`), and one default retry only for HTTP 500/503 with bounded backoff (`:171-176,338-343`). No timeout retry is attempted. Public provider errors are mapped to generic responses at `supabase/functions/generate-itinerary/index.ts:267-280`.
- Function config sets `verify_jwt = false` (`supabase/functions/generate-itinerary/config.toml:1-2`), while the handler explicitly verifies the bearer token (`index.ts:190-201`). Trip retrieval passes the caller token and enforces `trip.user_id === user.id` (`index.ts:212-229`). Active place filtering is at `catalog.ts:63-76`; model IDs are checked against candidates and factual fields hydrated in `validator.ts:165-190`, before success response (`index.ts:282-290`).
- Constraint sanitization strips paired script/style blocks and remaining tag-shaped markup while preserving the explicit untrusted-input boundary (`prompt.ts:43-61`). This is not complete prompt-injection protection.
- Frontend fallback remains restricted to `PROVIDER_NOT_CONFIGURED`, `PROVIDER_TIMEOUT`, `PROVIDER_RATE_LIMIT`, and `PROVIDER_ERROR` (`src/pages/AIGenerating/AIGeneratingPage.tsx:124-149`). Authorization and validation/grounding failures are not added to the provider fallback path.
- The frontend awaits persistence before navigation (`AIGeneratingPage.tsx:214-218`) and surfaces persistence errors (`:225-231`). AI activities map to `isAiGenerated: true` (`src/services/ai/aiPlanService.ts:116-149`) and are persisted to `is_ai_generated` (`src/services/trips/itineraryPlanner.ts:456-471`). Phase 7.3 reload/persistence checks are simulated (`tests/phase_7_3_hardening_e2e.test.ts:442-491`); real save/reload remains unverified.
- A prior Phase 7.5A review found no Gemini key/header/endpoint strings in the generated frontend bundle. This phase made no frontend changes or secret inspection.

## Pre-deployment gate

| Gate | Result | Evidence or blocker |
|---|---|---|
| Intended project reference | **PASS** | Linked CLI project reference is `lshdvvsgwivlnpirxgjy`, matching the previously reported target. |
| Current deployed function version | **PASS** | Read-only CLI metadata reports active version 17, updated 2026-10-19 03:42:02 UTC. |
| Exact local source/package review | **PARTIAL / NOT VERIFIED** | The function source has been inspected and has no unexplained change identified in this task, but Git metadata is absent and full diff/source parity against version 17 was not established. Version 17 predates the current local model/sanitizer changes per earlier reports. |
| `GEMINI_API_KEY` presence | **PASS — presence only** | Server-managed inventory listed the name. This does not prove key validity or model entitlement. |
| `GEMINI_MODEL` status | **PASS — absent from inventory** | Local source default applies if absent. |
| Project-specific Gemini model access | **NOT VERIFIED** | Requires one authorized live request; none was made. |
| Auth, ownership, grounding, validation, fallback checks | **PASS LOCALLY / remote parity NOT VERIFIED** | Current source and local mock suites reviewed; deployed parity is unknown. |
| Authorized account and owned one-day test trip | **BLOCKED** | No signed-in test session or explicitly identified safe test trip was available. No trip was created or modified. |
| Live generation, persistence, reload, AI marker | **BLOCKED / NOT RUN** | These steps depend on the missing safe test trip and deployment. |
| Safe post-request log review | **NOT RUN** | No invocation occurred. |

The test-trip prerequisite is a material gate failure. Under the phase instructions, stop here rather than deploy or create/overwrite production data.

## Local verification

| Check | Result | Classification |
|---|---|---|
| Phase 7.1 legacy foundation | **PASS — 39 passed, 0 failed** | Local mock suite using the Phase 7.5C TypeScript transpile runner in `%TEMP%`. |
| Phase 7.1 unit | **PASS — 63 passed, 0 failed** | Offline/local mocks. |
| Phase 7.1 Supabase integration | **SKIPPED — 0 tests run** | Makes real Supabase REST/Auth requests; prohibited here. |
| Phase 7.2 Gemini integration | **PASS — 63 passed, 0 failed** | Mocked provider/fetch behavior; no live Gemini call. |
| Phase 7.3 hardening E2E | **PASS — 43 passed, 0 failed** | The live branch was blocked/not executed using an empty child-process setting; no live request. |
| Phase 7.4 trip ownership | **PASS — 7 passed, 0 failed** | Local fetch/auth mocks. |
| `npm run lint` | **PASS** | ESLint exited successfully. |
| `npm run build` | **PASS** | TypeScript and Vite build succeeded; existing advisory notes the 509 kB minified JS chunk. |

Local/mock results are not evidence of deployed behavior. The Supabase CLI project/function/secret-name metadata checks were read-only; no production REST data endpoint was queried.

## Files changed during this phase

Only `docs/PHASE_7_5E_COMPLETION_REPORT.md` was added. No application source, tests, package files, environment configuration, database data, or production settings were changed. `.git` is absent in this workspace, so a complete Git diff or independent untracked-file inventory cannot be produced. Test runner artifacts remain outside the workspace under `%TEMP%`.

## Required next action

Provide/prepare an authorized test account session and a one-day test trip that is safe to overwrite, preferably in a non-production project. Then review and approve the exact deployment package/source parity. Once that prerequisite is available, the authorized workflow can continue with deployment of only `generate-itinerary` and at most one live Gemini request, followed by actual persistence/reload verification. No live request, deployment, or Phase 7.5F work was performed here.
