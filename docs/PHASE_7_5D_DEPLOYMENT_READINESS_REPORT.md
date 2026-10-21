# HUEGO — Phase 7.5D Deployment Readiness Report

**Verdict: READY FOR AUTHORIZATION** — local review found no blocking source issue. This is a pre-deployment readiness assessment only; it does not establish production readiness, deployed parity, or live model access.

## Executive summary

The local `generate-itinerary` source retains server-side Gemini configuration, structured JSON generation, bounded timeout/retry handling, authentication and ownership checks, active-catalog grounding, output validation, and the restricted frontend fallback allowlist. The Phase 7.5B constraint sanitizer and Phase 7.5C local verification are present. Local offline suites, lint, and build passed during this review.

Deployment identity, current deployed function version and source parity, server-managed secret availability, project-specific model access, and an authenticated save/reload lifecycle remain **NOT VERIFIED** because this phase prohibits remote Supabase access, live provider calls, and secret inspection. Authorization should be requested only for a clearly named project and the manual deployment/smoke procedure below. Do not infer a successful Gemini result from deterministic fallback or mocked tests.

## Files and source paths reviewed

- Rules and reports: `docs/AGENT_RULES.md`; Phase 7.1, 7.2, 7.3, and 7.4 completion reports; `docs/PHASE_7_5_COMPLETION_REPORT.md`; `docs/PHASE_7_5A_REVIEW_REPORT.md`; `docs/PHASE_7_5B_COMPLETION_REPORT.md`; `docs/PHASE_7_5C_COMPLETION_REPORT.md`.
- Edge Function: `supabase/functions/generate-itinerary/provider.ts`, `index.ts`, `schema.ts`, `prompt.ts`, `catalog.ts`, `validator.ts`, `types.ts`, and `config.toml`.
- Frontend and persistence: `src/pages/AIGenerating/AIGeneratingPage.tsx`, `src/services/ai/aiPlanService.ts`, `src/services/trips/itineraryPlanner.ts`, and Supabase client configuration.
- Tests: Phase 7.1 legacy, unit, and integration suites; Phase 7.2 Gemini integration; Phase 7.3 hardening E2E; Phase 7.4 ownership.
- Environment/config names were inspected without reading values. Local `.env` declares `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`; `.env.example` also declares `VITE_SUPABASE_PUBLISHABLE_KEY`. The function reads server-side `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `GEMINI_API_KEY`, and optional `GEMINI_MODEL`. No values are reproduced here.

## Provider, model, and request review

- Default model is `gemini-3.8-flash` at `supabase/functions/generate-itinerary/provider.ts:163-164`.
- Selection is explicit constructor option, then trimmed `GEMINI_MODEL`, then the default (`provider.ts:195-212`). Blank environment override therefore falls back to default. The current `resolveProvider` path does not pass a model option.
- Provider metadata uses `this.model` (`provider.ts:207-208`), and the endpoint is built from that same value (`provider.ts:226-228`): `https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent`.
- The request config uses structured JSON mode (`provider.ts:230-295`), and the request is sent with the server-side `x-goog-api-key` header (`provider.ts:309-317`), not a URL query parameter. The request body does not contain the key.
- Timeout defaults to 30 seconds and uses `AbortController`; timeout is not retried (`provider.ts:209`, `305-335`, especially `323-325`). At most one retry is configured by default for HTTP 500/503, with 800 ms backoff (`provider.ts:171-176`, `338-343`). These are bounded locally. This report does not independently verify Supabase platform execution limits.
- Provider diagnostics log category/status, elapsed timing, model metadata, and sanitized upstream error message where present. They do not log full response bodies. Provider failures are converted by `index.ts:267-280` into generic public messages; HTTP response error bodies from Google are not returned to the browser. The source-level sanitizer is not proof about deployed logs or third-party logging configuration.
- Local `dist` output was searched during the previous Phase 7.5A review for Gemini API key/header/endpoint strings and none were found. This review did not print environment values or inspect secret contents. The model's availability to the target Gemini API project remains **NOT VERIFIED**.

## Security, grounding, fallback, and persistence review

- The per-function config has `verify_jwt = false` (`supabase/functions/generate-itinerary/config.toml:1-2`); the handler implements explicit bearer verification (`index.ts:190-201`). Do not remove either behavior as part of deployment. For a provided `tripId`, lookup forwards the caller JWT and checks `trip.user_id === user.id` (`index.ts:212-229`; ownership regression tests in `tests/phase_7_4_trip_ownership.test.ts:53-103`).
- Candidate processing filters to `is_active === true` (`catalog.ts:63-...`, line 76), and server-side output validation rejects IDs outside the candidate map and hydrates facts from trusted candidate records (`validator.ts:93-...`, referential checks around lines 165-190). Handler validates before success response (`index.ts:282-290`).
- Constraint markup cleanup removes paired script/style blocks and remaining tag-shaped markup, then retains the existing explicit untrusted-input delimiters and instruction (`prompt.ts:43-61`). This reduces markup exposure but is not a complete prompt-injection defense.
- Auth/ownership failures occur before provider invocation (`index.ts:190-229`). Grounding/validation errors return 422 after generation and are not converted to provider-recovery errors (`index.ts:282-285`). The UI fallback allowlist is exactly `PROVIDER_NOT_CONFIGURED`, `PROVIDER_TIMEOUT`, `PROVIDER_RATE_LIMIT`, and `PROVIDER_ERROR` (`src/pages/AIGenerating/AIGeneratingPage.tsx:124-149`). No authorization or output-validation codes are added to it.
- The client maps validated AI activities to `isAiGenerated: true` (`src/services/ai/aiPlanService.ts:116-149`); persistence writes `is_ai_generated` (`src/services/trips/itineraryPlanner.ts:456-471`). The generating page awaits persistence before navigation and surfaces persistence failures (`AIGeneratingPage.tsx:214-231`).
- Phase 7.3 tests mock the lifecycle, persistence row, and reload representation, including `is_ai_generated: true` (`tests/phase_7_3_hardening_e2e.test.ts:442-491`). These are mocked/simulated checks, not proof of a real database reload. A real authenticated test trip and deployed function are required to verify it live.

## Deployment-precondition checklist

| Precondition | Evidence status | Evidence / required action |
|---|---|---|
| Intended Supabase project identity | **Reported, not independently verified** | Phase 7.5 report names project `lshdvvsgwivlnpirxgjy` based on earlier preflight. This review did not contact Supabase or read `.env` values. Before any deployment, operator must confirm the project ref in the authorized Supabase CLI/link context and match it to the approved target. |
| Current deployed `generate-itinerary` version | **Reported, not current verification** | Phase 7.5 report records version 17 as of 2026-10-19 03:42 UTC. No remote metadata was queried in this phase; obtain current version from Supabase dashboard/CLI immediately before deployment. |
| Local source parity with intended deployment package | **NOT VERIFIED** | Git metadata is absent (`.git` does not exist here), so a complete diff cannot be produced. Prior report states that version 17 matched several earlier files before Phase 7.5 edits and that local model/schema differed. Review the exact package/source diff against the chosen remote version before deployment. |
| `GEMINI_API_KEY` in server-managed function secrets | **NOT VERIFIED** | Source requires it but cannot prove secret presence or validity. Operator may check presence/status in the Supabase secret inventory without printing the value. Never use shell output that displays secret contents. |
| `GEMINI_MODEL` setting | **NOT VERIFIED remotely** | Earlier Phase 7.5 report said it was absent at that time. Current value was not queried. If absent, local source default is `gemini-3.8-flash`; if set, confirm its intended value without disclosing unrelated secrets. |
| Model available to target API project | **NOT VERIFIED** | Public/model name in source does not prove project entitlement. Verify with one authorized smoke request after deployment; do not probe repeatedly. |
| Authentication and trip ownership enforcement | **Verified locally; remote parity NOT VERIFIED** | Handler validates bearer token and trip ownership; current ownership tests pass. Confirm deployed version contains these checks before use. |
| One-day test trip for authorized account | **NOT VERIFIED** | No test account/trip was accessed or created. Operator must prepare an owned one-day non-production or explicitly approved test trip. |
| Successful AI response behavior | **Mocked locally; live NOT VERIFIED** | Validate structured response, active catalog IDs, trusted hydrated fields, persistence, reload, and `is_ai_generated=true` in the authorized smoke run. |
| Recoverable provider failure behavior | **Verified locally by mocks; live NOT VERIFIED** | The existing allowlist falls back for four provider codes. Verify UI/log classification with a controlled, safe condition only if it does not require exposing secrets or weakening policy. |
| Validation/grounding failure behavior | **Verified locally by mocks; live NOT VERIFIED** | Invalid IDs and malformed output are rejected, not fallback eligible. Preserve and check this behavior in deployed parity. |
| Persistence failure behavior | **Verified locally by mocks; live NOT VERIFIED** | Navigation waits for persistence and error state remains visible; verify with a safe test scenario without corrupting a production trip. |
| Safe deployed log inspection | **NOT VERIFIED** | After authorized invocation, inspect only timestamp, function version, model identifier, duration/category/status. Avoid prompts, tokens, secret values, private trip data, and full upstream response content. |

## Safe manual deployment and smoke-test plan (not executed)

1. Obtain explicit authorization naming the exact Supabase project and permitting deployment of only `generate-itinerary` plus one live test request. Stop if the named project does not match the intended project reference.
2. In the authorized operator environment, confirm the linked project identity and current deployed function version. Do not print secret values.
3. Review the exact source/diff and packaging scope. Confirm provider model/schema, constraint sanitizer, JWT/ownership checks, active-catalog grounding, output validation, public error sanitization, and restricted fallback are present. Resolve unexplained changes before proceeding.
4. Check that server-managed `GEMINI_API_KEY` is available using a presence-only secret inventory/status view. Confirm whether `GEMINI_MODEL` is configured; if absent, expect the source default. Never echo either secret or unrelated environment values.
5. Confirm intended model access for the target Gemini API project during the single approved smoke request. Stop on any unexpected project/model 4xx/5xx response; do not add retries or change production settings as an ad hoc reaction.
6. Deploy only the `generate-itinerary` Edge Function through the repository's approved Supabase workflow. Do not deploy other functions or migrations. Confirm the new function version and inspect source/version metadata after deployment.
7. Use an authenticated account that owns a one-day non-production or explicitly approved test trip. Make one minimum live Gemini generation request. Verify response metadata corresponds to the expected model, every place ID belongs to an active catalog record, trusted facts were hydrated, and no validation/auth error was treated as fallback.
8. Verify the saved itinerary after reload and `is_ai_generated: true` for AI-generated activities. Confirm the result page appears only after persistence. If persistence fails, confirm a visible error and no misleading success navigation.
9. Verify the approved recoverable provider path only with a safe controlled condition; verify auth/ownership/grounding failures do not use deterministic fallback. Do not manufacture a bad production credential or mutate a real user's itinerary for this check.
10. Inspect logs using only safe metadata (model name, function version, elapsed time, sanitized category/status). Stop if project, function version, secret status, response, grounding, or persistence differs from expectation. Do not begin any later phase until this review is accepted.

## Local verification results

| Check | Result | Classification |
|---|---|---|
| Phase 7.1 legacy foundation | **PASS — 39 passed, 0 failed** | Local mock suite through temporary TypeScript compile runner. |
| Phase 7.1 unit | **PASS — 63 passed, 0 failed** | Local/offline mocks. |
| Phase 7.1 Supabase integration | **SKIPPED — 0 tests run** | Makes real Supabase GET requests; prohibited in this phase. |
| Phase 7.2 Gemini integration | **PASS — 63 passed, 0 failed** | Mocked/local provider adapters; not a live Gemini check. |
| Phase 7.3 hardening E2E | **PASS — 43 passed, 0 failed** | Live branch was blocked/not executed via empty child-process setting; no provider call. |
| Phase 7.4 ownership | **PASS — 7 passed, 0 failed** | Local request/fetch mocks. |
| `npm run lint` | **PASS** | ESLint exited successfully. |
| `npm run build` | **PASS** | TypeScript and Vite build passed; Vite retained its >500 kB chunk advisory. |

These results verify local/mock behavior only. They do not establish deployed parity, Google API project access, authenticated live generation, or production persistence.

## Scope and repository state

Known changes from the recent phases, as recorded by prior reports:

- Phase 7.5A: added `docs/PHASE_7_5A_REVIEW_REPORT.md`.
- Phase 7.5B: changed `supabase/functions/generate-itinerary/prompt.ts`, `tests/phase_7_1_unit.test.ts`, and `tests/phase_7_1_ai_foundation.test.ts`; added `docs/PHASE_7_5B_COMPLETION_REPORT.md`.
- Phase 7.5C: added `docs/PHASE_7_5C_COMPLETION_REPORT.md`.

Git metadata is unavailable: `.git` is absent and Git status/diff cannot enumerate current modified or untracked files. The file list above is report-derived, not an independently verified complete worktree diff. This phase adds only this readiness report. No unexplained-file inventory is claimed.

## Limitations, risks, and next action

The main unresolved deployment risks are project identity, deployed version/source parity, server secret/model configuration, project-specific model access, and real authenticated persistence/reload. A static review cannot close those gaps. The manual plan requires explicit deployment/live-smoke authorization and an approved test account/trip. Do not describe this assessment as production readiness.

**Recommended next action:** review this report and, if you want to proceed, explicitly authorize deployment of only `generate-itinerary` to the named project and one live smoke test using an owned non-production or approved test trip. The deployment and smoke test have not been performed.
