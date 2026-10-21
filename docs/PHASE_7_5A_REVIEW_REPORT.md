# HUEGO — Phase 7.5A Review Report

**Verdict: FAIL**

## Executive summary

The reviewed Phase 7.5 provider update is consistent with the current server-side Gemini request path and does not expose the API key in the frontend build. Authentication, trip ownership, trusted catalog validation, response validation, restricted fallback, and persistence-before-navigation remain in place.

The requested Phase 7.1 foundation suite reproduces four failures. Three are stale assertions that conflict with the current prompt/error contracts and the newer Phase 7.1 unit tests. One is a genuine contract regression: raw `specialConstraints` are interpolated into the prompt, although the Phase 7.1 completion report promises that those constraints are sanitized. The untrusted-input boundary is useful but does not meet that documented sanitization guarantee. This finding is sufficient for a FAIL verdict.

## Scope and changed files

Reviewed `docs/AGENT_RULES.md`, the Phase 7.1–7.5 reports, the Gemini provider and Edge Function handler, prompt/schema/catalog/validation code, the itinerary generation frontend and trip persistence path, and the Phase 7.1–7.4 test suites.

This review adds only `docs/PHASE_7_5A_REVIEW_REPORT.md`. The Phase 7.5 completion report identifies its intended implementation changes as `supabase/functions/generate-itinerary/provider.ts`, `tests/phase_7_2_gemini_integration.test.ts`, and `docs/PHASE_7_5_COMPLETION_REPORT.md`. Git metadata is unavailable in this workspace (`git status` reports that the directory is not a Git repository), so the complete working-tree diff and any additional pre-existing local changes could not be independently enumerated. No prior user changes were reset or overwritten.

## Provider configuration and request path

- `supabase/functions/generate-itinerary/provider.ts:164` sets `DEFAULT_GEMINI_MODEL` to `gemini-3.8-flash`.
- The constructor at line 207 selects an explicit model option, then trimmed `GEMINI_MODEL`, then the default. A blank environment override falls back to the default. The current handler does not pass an explicit model option. An explicitly supplied whitespace-only `options.model` would be accepted as-is; there is no such call in the inspected handler.
- The same `this.model` is used for provider metadata and the REST URL, so local provider metadata and the requested model agree. The request uses `generativelanguage.googleapis.com/v1beta/models/{model}:generateContent`, server-side `x-goog-api-key` authentication, JSON MIME configuration, and a response schema. No `gemini-2.5-flash` literal was found in the Edge Function source.
- The Phase 7.5 completion report says public documentation lists Gemini 3.8 Flash as a stable model. This review did not make a Gemini API request and cannot establish that this particular API project/key is entitled to use it. The report also records that live provider verification and current deployed invocation logs were not available.
- The API key remains server-side. A search of the generated `dist` output found no `GEMINI_API_KEY`, `x-goog-api-key`, or Gemini endpoint string. No key, token, prompt, or private trip data was printed by this review.
- The request path is frontend → authenticated `generate-itinerary` handler → Gemini REST provider → JSON parse and output validation/grounding against the trusted candidate catalog → response to frontend → `persistPlannedItinerary` → navigation. The frontend awaits persistence before navigating (`src/pages/AIGenerating/AIGeneratingPage.tsx:214`).
- The provider has a bounded request timeout and an AbortController; timeout errors are categorized as `PROVIDER_TIMEOUT`. It retries at most once for HTTP 500/503 with a bounded backoff; timeout errors are not retried. Logs record elapsed time/category and limited sanitized error metadata, not prompts or full provider responses. The public handler maps provider failures to controlled error responses. No Gemini call was made during this review.

## Security and behavior review

The inspected code retains JWT authentication and trip ownership enforcement in the Edge Function. Successful provider output is parsed, schema-checked, checked against the trusted candidate catalog, and hydrated from trusted catalog facts before returning. Frontend fallback remains restricted to `PROVIDER_NOT_CONFIGURED`, `PROVIDER_TIMEOUT`, `PROVIDER_RATE_LIMIT`, and `PROVIDER_ERROR`; validation, authorization, and grounding failures do not qualify for deterministic fallback. Persistence is awaited before result navigation. No auth, ownership, schema, RLS, UI, deployment, or remote configuration changes were made.

The prompt builder places traveler constraints between `<<<USER_INPUT_START>>>` and `<<<USER_INPUT_END>>>` and labels them untrusted (`supabase/functions/generate-itinerary/prompt.ts:48-54`). However, it takes the trimmed raw constraint value at line 44 and inserts it directly at line 53. This prevents the older tag-removal assertion from passing, and it does not fulfill the Phase 7.1 report's explicit sanitized-input commitment. This is a documented behavior regression, even though the new boundary reduces instruction-confusion risk and the reviewed evidence does not demonstrate script execution.

## Legacy suite failures

The exact legacy suite result was **35 passed, 4 failed** (`tests/phase_7_1_ai_foundation.test.ts`). The four failing assertions are:

| Test and location | Legacy expectation | Current behavior and evidence | Finding |
|---|---|---|---|
| Test 7.5, `tests/phase_7_1_ai_foundation.test.ts:358` | Prompt includes `<user_constraints>` | Prompt now uses the explicit untrusted-input delimiters at `prompt.ts:48-54`; current `tests/phase_7_1_unit.test.ts:434` asserts the new boundary. | Stale assertion; update the legacy test in a later test-maintenance change. |
| Test 7.6, `tests/phase_7_1_ai_foundation.test.ts:359` | `<script>` markup is removed from constraints | Raw trimmed constraints are inserted by `prompt.ts:44,53`. Phase 7.1 report promises sanitized constraints (`docs/PHASE_7_1_COMPLETION_REPORT.md:17,96`) and says user constraints strip tags (`:232,250`). | **Genuine regression against documented contract.** Smallest safe implementation fix: sanitize markup in user constraint text while retaining the current untrusted boundary, and add a focused regression test. |
| Test 8.2, `tests/phase_7_1_ai_foundation.test.ts:390` | Missing `days` returns `VALIDATION_FAILED` | Validator returns `INVALID_OUTPUT_FORMAT` (`validator.ts:99-103`); the current unit test expects that contract at `tests/phase_7_1_unit.test.ts:465`. | Stale assertion; current contract is documented in the Phase 7.2 report. |
| Test 9.3, `tests/phase_7_1_ai_foundation.test.ts:437` | `UNKNOWN_PLACE_ID` appears in `error.details` | Handler places the error code in `error.code`; the current unit test checks that field at `tests/phase_7_1_unit.test.ts:511`. | Stale assertion; update the legacy test to the current response contract. |

No implementation or test change was made in response to these failures, as requested.

## Verification results

| Check | Result | Scope/notes |
|---|---|---|
| `tests/phase_7_1_ai_foundation.test.ts` | **35 passed, 4 failed** | Reproduced the four failures analyzed above. |
| Phase 7.1 unit suite | **49 passed, 0 failed** | Local tests. |
| Phase 7.1 integration suite | **19 passed, 0 failed** | Read-only Supabase catalog/Auth checks and local handler with mock provider; no database writes. |
| Phase 7.2 Gemini integration suite | **63 passed, 0 failed** | Mocked provider/REST behavior; not a live Gemini verification. |
| Phase 7.3 hardening suite | **43 passed, 0 failed** | Live smoke branch reported blocked/not executed because no replacement `GEMINI_API_KEY` was available in the process environment. |
| Phase 7.4 ownership suite | **7 passed, 0 failed** | Local ownership checks. |
| `npm run lint` | **Passed** | Exit code 0. |
| `npm run build` | **Passed** | Exit code 0; Vite reported its advisory for chunks over 500 kB. |
| Live Gemini request / deployed log inspection | **Not performed** | No live provider call or deployment was authorized for this review; project-specific model availability and current deployed version remain unverified. |

The repository's `npx tsx tests/phase_7_1_ai_foundation.test.ts` command could not launch because `tsx` was not available in the local npm cache (`ENOTCACHED`), and no dependency was installed. The test sources were run with Node 22's native TypeScript stripping through a temporary, out-of-workspace loader that resolved the existing `npm:zod` import to the installed package and handled extensionless local imports. The temporary loader was removed after the runs. Results above are from those executed suites, not an inferred pass.

## Remaining blockers and recommendation

1. Resolve the documented special-constraint sanitization regression with a focused implementation and regression test. Preserve the existing untrusted-input delimiters and all current authorization/validation/fallback behavior.
2. Treat the other three legacy failures as test maintenance: align those assertions with the current prompt and error contracts; do not revert the current contracts merely to satisfy stale assertions.
3. A real Gemini success, project-specific model access, deployed model/version, trusted grounding in a live response, and authenticated persistence/reload are not established by local/mock tests. They require an authorized live smoke test and safe access to current Supabase invocation logs.
4. The exact complete local diff remains unknown because `.git` metadata is unavailable. Preserve this limitation when reviewing or packaging the changes.

No deployment, Gemini request, production setting change, database/schema/RLS change, or Phase 7.6 work was performed.
