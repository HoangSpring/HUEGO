# HUEGO — Phase 7.5B Completion Report

**Verdict: PASS for the scoped remediation.**

## Root cause

`buildGroundedPrompt` trimmed `specialConstraints` but inserted that raw text into the Gemini prompt. This contradicted the Phase 7.1 documented sanitization contract. The existing untrusted-input delimiters were retained, but did not themselves remove markup or active-content text.

## Sanitization change and limits

`supabase/functions/generate-itinerary/prompt.ts` now removes paired `<script>` and `<style>` elements and their contents, strips remaining HTML/XML-like tags while preserving ordinary text around them, then places the sanitized value inside the existing `<<<USER_INPUT_START>>>` / `<<<USER_INPUT_END>>>` boundary. Empty or whitespace-only input still yields “None specified.”

This is input cleanup only. It does not guarantee prompt-injection immunity. Constraints remain explicitly untrusted, and post-generation grounding and validation remain the enforcement controls. Trusted catalog serialization and catalog sanitization were not changed. Request and database schemas were not changed.

## Files changed

- `supabase/functions/generate-itinerary/prompt.ts`: sanitize the untrusted constraint text before prompt interpolation.
- `tests/phase_7_1_unit.test.ts`: add focused coverage for ordinary constraints, tag/script handling, boundary and system instruction retention, and missing/null/empty/whitespace input.
- `tests/phase_7_1_ai_foundation.test.ts`: align the three stale prompt/error assertions with current contracts and retain a regression assertion that script markup is stripped.

The legacy assertions now check the current untrusted boundary, `INVALID_OUTPUT_FORMAT` for a missing `days` array, and `UNKNOWN_PLACE_ID` in `error.code`.

## Before and after legacy suite

| Suite | Before remediation | After remediation |
|---|---:|---:|
| Phase 7.1 AI foundation legacy | 35 passed, 4 failed | **39 passed, 0 failed** |

The prior failures were the three assertions aligned above and the `<script>` stripping assertion, now satisfied by implementation.

## Verification

| Check | Result | Notes |
|---|---|---|
| `npx tsx tests/phase_7_1_ai_foundation.test.ts` | **Could not launch** | npm failed with `ENOTCACHED`: `tsx` is absent from the local cache, and network access is restricted. No dependency was installed. |
| Phase 7.1 AI foundation legacy | **39 passed, 0 failed** | Executed a temporary TypeScript-compiled copy outside the workspace using the installed TypeScript compiler and dependencies. Suite is mocked/offline. |
| Phase 7.1 unit | **63 passed, 0 failed** | Same temporary compiler runner; mocked/offline. |
| Phase 7.1 integration | **Skipped: 0 tests executed** | Source inspection confirmed live GET requests to configured Supabase REST/Auth endpoints. Skipped to honor the prohibition on production database access; no test was counted as passed. |
| Phase 7.2 Gemini integration | **Could not execute** | Its imports include the frontend trip persistence service; the temporary Node runner could not resolve an extensionless Windows TypeScript dependency. No live provider request was attempted. |
| Phase 7.3 hardening E2E | **Could not execute** | Same temporary runner resolution limitation. No live provider request was attempted. |
| Phase 7.4 trip ownership | **7 passed, 0 failed** | Temporary compiler runner; local test. |
| `npm run lint` | **Passed** | ESLint exited successfully. |
| `npm run build` | **Passed** | TypeScript and Vite production build succeeded. Vite emitted its existing advisory about the 509 kB JS chunk. A restricted-sandbox attempt first hit `spawn EPERM`; the command succeeded with the approved local build subprocess access. |
| Focused sanitizer check | **Passed** | Verified ordinary text survives, script markup/content is removed, and the untrusted boundary remains. |

The repository-supported `tsx` runner was unavailable offline. The legacy, Phase 7.1 unit, and Phase 7.4 suites were run from temporary compiled copies under `%TEMP%`; no test runner, package, or repository configuration was added. The Phase 7.2 and 7.3 counts remain unverified, and this limitation is not represented as a pass.

## Scope and security confirmation

No Edge Function deployment, live Gemini/provider call, secret inspection/change, production database request or mutation, auth/ownership/RLS/schema change, frontend UI change, model-selection change, JSON-response-schema change, or Phase 7.6 work occurred. The existing provider, authentication, trip ownership, trusted catalog grounding, output validation, persistence behavior, and restricted fallback rules were not modified.

## Remaining risks and next action

Tag stripping is not a complete defense against prompt injection; user constraints can still contain instruction-like plain text. Keep the untrusted boundary and all post-generation checks. Phase 7.2 and 7.3 suite execution remains blocked by the local runner limitation; rerun those with an already-available compatible test runner when available. No further phase is started. Stop here for review.
