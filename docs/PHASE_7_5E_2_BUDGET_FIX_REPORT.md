# HUEGO — Phase 7.5E.2 Budget Fix Report

**Verdict: PASS for local implementation and offline verification.**

## Root cause and evidence

The Plan Trip form accepted an unlabeled `Budget (VND)` value, saved it directly to `trips.budget`, and the result page showed that same number. The deterministic planner selected destinations by score without considering cost, then only added a post-hoc warning. The AI validator also computed the full itinerary's entrance-fee total and added a warning when it exceeded the budget, but the result page did not show that warning. Thus a four-day itinerary could contain known admission fees above the displayed budget without an effective budget-aware selection or clear result-page overrun status.

Both planners derive activity fees from trusted catalog data, not model-supplied values. The changed paths now use `price_max` when available, otherwise `price_min`; an absent or invalid fee remains unknown. Previously, ranges were estimated at `price_min`, which could understate known fees.

The transportation path estimates distance and time only. It has no money estimate. The previous cost disclaimers explicitly excluded food and lodging but did not clearly exclude transportation. The itinerary's fee total and the result page therefore represent known attraction admission fees, not all trip spending.

## Budget semantics

The product documents say that users provide a budget and that the itinerary should be optimized around budget; they do not define daily, per-person, or group semantics (`docs/PRD.md` success criteria and `docs/USER_FLOW.md` Plan Trip flow). The existing deterministic calculation sums activity fees across all days and compares that trip-wide sum to `trips.budget`; the AI validator does the same. The smallest consistent interpretation is therefore a **total-trip budget for listed attraction entrance fees**. It is not a strict all-expenses cap: transportation, food, and lodging are excluded, and the docs do not define per-person multiplication. The form and result page now label this as “Total trip budget” and explicitly explain the estimate's exclusions.

## Fix applied

- The deterministic planner now accounts for verified catalog entrance fees against the total-trip budget before selection, using the conservative catalog upper bound. It keeps score order, skips unaffordable known-fee destinations with an actionable warning, and returns `BUDGET_TOO_LOW` when no known-fee destination fits. Unknown-fee destinations are not treated as free and remain visibly marked unknown.
- The Gemini prompt names the trip-wide scope, asks for conservative catalog fee estimates, and instructs that unknown prices are not free. The server validator uses the same fee rule, keeps day/activity/total known-fee sums consistent, and flags over-budget AI plans.
- The result page derives a trip-wide summary from persisted activity fees, displays the known subtotal, identifies incomplete totals, and shows a clear alert when known fees exceed the saved budget. This also works after reload without schema changes or persisting transient warnings.
- The user's budget and existing trip details are preserved. No schema, RLS, authentication, ownership, fallback, or provider architecture changes were made.

## Files changed

- `src/services/trips/itineraryPlanner.ts`
- `src/services/trips/budgetSummary.ts` (new)
- `supabase/functions/generate-itinerary/prompt.ts`
- `supabase/functions/generate-itinerary/validator.ts`
- `src/pages/PlanTrip/PlanTripPage.tsx`
- `src/pages/TripEdit/TripEditPage.tsx`
- `src/pages/TripResult/TripResultPage.tsx`
- `tests/phase_7_5e_2_budget.test.ts` (new)
- `docs/PHASE_7_5E_2_BUDGET_FIX_REPORT.md` (this report)

The workspace has no `.git` metadata, so these are the files edited for this task rather than a Git-derived diff list.

## Tests and verification

| Check | Result |
|---|---|
| Phase 7.5E.2 budget regression suite | **PASS** — 20 assertions, 0 failures across seven requested scenarios. |
| Phase 7.1 legacy AI foundation suite | **PASS** — 39 passed, 0 failed. |
| Phase 7.1 mocked unit suite | **PASS** — 63 passed, 0 failed. |
| Phase 7.1 Supabase integration suite | **SKIPPED** — excluded because it performs real Supabase HTTP requests and this task forbids production data access. |
| Phase 7.2 mocked integration suite | **PASS** — 63 passed, 0 failed. |
| Phase 7.3 hardening suite | **PASS** — 43 passed, 0 failed. Its live Gemini branch was explicitly left unconfigured and reported **BLOCKED / NOT EXECUTED**. |
| Phase 7.4 trip ownership suite | **PASS** — 7 passed, 0 failed. |
| `npm run lint` | **PASS** — exit code 0. |
| `npm run build` | **PASS** — TypeScript and Vite build succeeded. Vite emitted the existing advisory that a minified JS chunk is larger than 500 kB. |

Because this environment has no project test runner configured, the TypeScript test files were transpiled with the already-installed TypeScript compiler into a temporary directory and executed with Node. No package was installed. Exact offline suite commands were `node %TEMP%\huego-75e2-runner\tests\phase_7_5e_2_budget.test.js`, `phase_7_1_ai_foundation.test.js`, `phase_7_1_unit.test.js`, `phase_7_2_gemini_integration.test.js`, `phase_7_3_hardening_e2e.test.js`, and `phase_7_4_trip_ownership.test.js` (with the test filename appended to that base path). The initial sandboxed `npm run build` hit Windows `spawn EPERM`; rerunning the same command with permission to spawn its local Vite helper succeeded.

## Remaining limitations and safety

- Unknown attraction fees make the displayed known-fee subtotal incomplete; the UI says so and does not represent unknowns as zero.
- Transportation, food, and lodging remain outside this estimate because there is no trusted monetary estimate or documented calculation model for them.
- Phase 7.1 live Supabase integration was not run. Tests used local fixtures/mocks only; no conclusion is made about remote data.
- No live Gemini request, Edge Function deployment, production database mutation, or currently displayed trip overwrite occurred.

Stop after this report. Phase 7.5E deployment remains gated on review and the separately required test-trip safety prerequisite.
