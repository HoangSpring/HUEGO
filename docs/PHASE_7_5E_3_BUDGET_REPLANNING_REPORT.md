# HUEGO — Phase 7.5E.3 Budget-Compliant Replanning Report

**Verdict: PASS for local implementation and offline verification.**

## Root cause

The budget-aware deterministic planner was not governing the normal AI success path. `PlanTripPage` creates a trip and routes to `AIGeneratingPage`; `TripEditPage` saves the edited settings and routes to that same generation page. `AIGeneratingPage` calls `generateAItinerary`, which invokes `generate-itinerary` with the persisted trip budget.

The Edge Function hydrated activity prices from trusted catalog candidates in `validator.ts` and calculated the trip fee sum, but when the sum exceeded the budget it added a warning and still returned `{ success: true }`. `aiPlanService.ts` mapped that response as a successful itinerary. `AIGeneratingPage` used deterministic fallback only for its provider error allowlist, so it persisted the over-budget AI result. That explains how a newly created or replanned trip could finish with 1,100,000 VND in known catalog fees against a 200,000 VND budget.

The code path itself is established from local code. No production record or live request was inspected, so I cannot verify that the reported trip's actual stored activity rows came from this exact run.

## Generation paths inspected

1. **New trip:** `PlanTripPage` validates and stores the selected budget in `trips.budget`, then navigates to `/ai-generating?tripId=...`.
2. **Re-plan:** `TripEditPage` saves the edited budget/settings and uses the same generation route. It does not reuse an existing itinerary as generation input.
3. **AI:** `AIGeneratingPage` loads the owned trip and active places, calls the authenticated Edge Function, and previously accepted any successful validated result even if it exceeded budget.
4. **Deterministic recovery:** previously ran only after provider configuration, timeout, rate limit, or provider errors. It now also runs after the specific server-side `BUDGET_EXCEEDED` quality rejection. `BUDGET_TOO_LOW` is shown as a dedicated actionable page error. Auth, ownership, grounding, and other validation failures remain terminal.
5. **Persistence/reload:** `persistPlannedItinerary` verifies trip ownership, removes prior days/activities, inserts the new day/activity fee values, and updates trip status while retaining the saved budget. The result page reloads activity-level estimates and recomputes the known-fee total, so it does not depend on a transient warning from the AI response.
6. **Fee rule:** both the Edge validator and deterministic planner now call the same pure `getCatalogEntranceFeeEstimate` function: use a valid nonnegative `price_max`, otherwise a valid `price_min`, otherwise preserve the fee as unknown. Unknown fees are never converted to zero; an unknown fee keeps the subtotal explicitly incomplete.

The itinerary budget is a total-trip cap on known attraction entrance fees. Transportation, food, and lodging are excluded, as already disclosed in the UI. The existing planning form does not collect a category-interest list or travel-style choice, so the deterministic fallback preserves its current score, trip duration, opening-hour, and route sequencing behavior; it cannot honor preferences the form does not capture.

## Changes made

- Added a server-side `BUDGET_EXCEEDED` validation outcome instead of returning an over-budget AI itinerary as a successful result.
- Added one explicit budget-rejection exception to the client deterministic fallback policy. It does not broaden fallback for security or other validation errors.
- Reused the deterministic planner's existing budget-aware selection for that recovery path. It preserves the stored budget and returns `BUDGET_TOO_LOW` when no known-fee destination fits.
- Shared the catalog fee selection rule between the Edge validator and client planner.
- Made the result-page fallback banner accurate for budget rejection as well as provider errors.
- Added regression tests for controlled recovery, prohibited fallback categories, replanning over stale rows, persistence/reload totals, unknown prices, and unaffordable plans.

## Files changed

- `src/services/trips/budgetSummary.ts`
- `src/services/trips/fallbackPolicy.ts` (new)
- `src/services/trips/itineraryPlanner.ts`
- `src/pages/AIGenerating/AIGeneratingPage.tsx`
- `src/pages/TripResult/TripResultPage.tsx`
- `supabase/functions/generate-itinerary/validator.ts`
- `supabase/functions/generate-itinerary/types.ts`
- `tests/phase_7_5e_2_budget.test.ts`
- `tests/phase_7_5e_3_replanning.test.ts` (new)
- `docs/PHASE_7_5E_3_BUDGET_REPLANNING_REPORT.md` (this report)

The workspace has no `.git` metadata, so this list reflects the files edited for this phase, not a Git-derived diff.

## Regression and verification results

| Check | Result |
|---|---|
| Phase 7.5E.3 replanning suite | **PASS** — 10 assertions, 0 failed. |
| Phase 7.5E.2 budget suite | **PASS** — 17 assertions, 0 failed; updated to expect server rejection for over-budget AI output. |
| Phase 7.1 legacy AI foundation suite | **PASS** — 39 passed, 0 failed. |
| Phase 7.1 mocked unit suite | **PASS** — 63 passed, 0 failed. |
| Phase 7.1 Supabase integration suite | **SKIPPED** — performs real Supabase HTTP requests, outside the allowed scope. |
| Phase 7.2 mocked integration suite | **PASS** — 63 passed, 0 failed. |
| Phase 7.3 hardening suite | **PASS** — 43 passed, 0 failed. The live Gemini branch remained unconfigured and was not executed. |
| Phase 7.4 trip ownership suite | **PASS** — 7 passed, 0 failed. |
| `npm run lint` | **PASS** — exit code 0. |
| `npm run build` | **PASS** — TypeScript and Vite production build succeeded. Existing Vite advisory remains for a minified JS chunk over 500 kB. |

No runner is defined in `package.json`; the already-installed TypeScript compiler transpiled the local suites into `%TEMP%\huego-75e2-runner` and Node executed those compiled offline tests. No packages were installed. Exact suite commands were:

```powershell
node "$env:TEMP\huego-75e2-runner\tests\phase_7_5e_3_replanning.test.js"
node "$env:TEMP\huego-75e2-runner\tests\phase_7_5e_2_budget.test.js"
node "$env:TEMP\huego-75e2-runner\tests\phase_7_1_ai_foundation.test.js"
node "$env:TEMP\huego-75e2-runner\tests\phase_7_1_unit.test.js"
node "$env:TEMP\huego-75e2-runner\tests\phase_7_2_gemini_integration.test.js"
$env:GEMINI_API_KEY = ''
node "$env:TEMP\huego-75e2-runner\tests\phase_7_3_hardening_e2e.test.js"
node "$env:TEMP\huego-75e2-runner\tests\phase_7_4_trip_ownership.test.js"
npm run lint
npm run build
```

The replanning persistence/reload test uses a mocked Supabase client and in-memory rows; it exercises the existing persistence and retrieval services without network access.

## Remaining limitations and safety

- Fee totals cover only verified catalog admission fees. Unknown fees make the subtotal incomplete, and transportation, food, and lodging are not monetized.
- The deterministic recovery honors current planner ranking and itinerary constraints, but the Plan Trip form does not store explicit interests or travel style for the fallback planner.
- Supabase live integration and real Gemini behavior remain unverified in this phase.
- No Edge Function deployment, live Gemini call, production database mutation, or overwrite of the currently displayed trip occurred.

Stop after this report. Deployment or another phase requires a separate review.
