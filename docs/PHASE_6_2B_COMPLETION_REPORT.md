# HUEGO — Phase 6.2B Completion Report: Deterministic Itinerary Planner

**Date**: 2026-10-16  
**Status**: Completed  
**Target Objective**: Implement the deterministic itinerary planning logic and supporting distance/persistence service layers for HUEGO using real Supabase places without LLM integration or UI redesign.

---

## 1. Summary of Implementation

A dedicated deterministic planning engine and supporting distance service have been built and validated:
- `src/services/maps/distanceService.ts`: Great-circle distance calculations via Haversine formula, realistic transit time estimation tailored for Huế traffic conditions across 5 transport modes, and nearest-neighbor proximity ordering.
- `src/services/trips/itineraryPlanner.ts`: Core planning engine producing structured, multi-day itineraries from real active Supabase places. Generates days, chronologically non-overlapping time slots, estimated travel times, distances, ticket fees, and schedule warnings.
- `persistPlannedItinerary`: Safe persistence routine that satisfies all NOT NULL constraints (`title`, `activity_type`, `days_count`), cleans up stale activities, and writes days and activities matching the live Supabase schema.
- **28 automated tests passed** covering 10 distinct test scenarios (empty data, inactive exclusion, missing coordinates/prices/durations, budget thresholds, duplicate-place prevention, and byte-for-byte reproducibility).
- Verified against the **12 live active Huế destinations** in Supabase.

---

## 2. Files Created or Modified and Why

| File | Status | Rationale |
|---|---|---|
| `src/services/maps/distanceService.ts` | **Created** | Encapsulates Haversine distance (`calculateDistanceKm`), transit duration estimations (`estimateTravelMinutes`), and proximity sequence ordering (`orderPlacesByProximity`). Isolates map/math logic from UI components. |
| `src/services/trips/itineraryPlanner.ts` | **Created** | Implements `planDeterministicItinerary` and `persistPlannedItinerary`. Houses the scoring heuristic, day partitioning, time slot scheduling, opening hour checks, budget verification, and safe persistence to `trips`, `trip_days`, and `trip_activities`. |
| `src/services/supabase/client.ts` | **Modified** | Hardened environment variable extraction (`import.meta.env`) with safe fallback to prevent module-load crashes during Node/TS unit testing or SSR. |
| `docs/PHASE_6_2B_COMPLETION_REPORT.md` | **Created** | Comprehensive technical and compliance documentation for Phase 6.2B. |

---

## 3. Planner Algorithm & Deterministic Ordering Rules

1. **Place Filtering & Scoring**:
   - Only places with `is_active === true` are considered.
   - Places receive a priority score based on:
     - Matching user interests/categories (+15 points for category match, +10 points for slug match).
     - Rating value (defaulting to 4.0 if null).
     - Iconic cultural landmarks boost (Đại Nội +20, Thiên Mụ +12, Thủy Xuân +8, Tự Đức +6) to ensure first-time visitors receive Hue's quintessential attractions.
   - **Deterministic Tie-Breaking**: When two places have equal scores, the algorithm sorts them strictly by `place.id.localeCompare(other.id)`. For identical inputs, the planner produces identical outputs.

2. **Capacity & Partitioning**:
   - Places per day depend on travel style: `relaxed` = 2, `packed` = 4, `balanced` (default) = 3.
   - Total places selected = $\min(\text{availablePlaces}, \text{daysCount} \times \text{placesPerDay})$.
   - Uses a `Set<string> scheduledPlaceIds` to ensure **no place is ever scheduled more than once in the entire trip**.

3. **Intra-Day Geographic Sequencing**:
   - Places assigned to each day are sequenced using `orderPlacesByProximity`, starting from `startLocation` (if provided) or from the first place with valid coordinates.
   - Uses nearest-neighbor Haversine chaining to minimize zigzagging across the Perfume River or between suburban tomb clusters.

4. **Time & Schedule Construction**:
   - Days start at `08:30` (or `opening_time` if the first attraction opens later).
   - Arrival time is computed by adding transit minutes (`travel_minutes`) from the previous stop.
   - If arrival time is earlier than `opening_time`, visit start advances to `opening_time`.
   - Duration is taken from `place.duration_minutes` (or a conservative 60-minute fallback if null).
   - Activity `end_time` = start time + duration.
   - If `end_time` exceeds `closing_time`, a specific warning is added to the itinerary.
   - **Midday Heat / Lunch Break Buffer**: If an activity ends between `11:30` and `13:00`, the next activity starts no earlier than `13:30`.

---

## 4. Handling Preferences, Duration, Coordinates, Opening Hours, & Budget

- **Duration (`daysCount`)**: Must be an integer $\ge 1$. If requested days exceed available places (e.g. 5 days for 2 places), the engine distributes available places, leaves remaining days without activities, and emits an explanatory warning. It never invents places to fill days.
- **Coordinates (`latitude`, `longitude`)**: Evaluated with range checks ($-90 \le \text{lat} \le 90$, $-180 \le \text{lon} \le 180$). If a place has null coordinates, distance and transit minutes are set to `null`, and the place is placed using catalog order. The engine never claims routes are optimal when coordinates are missing.
- **Opening Hours (`opening_time`, `closing_time`)**: Converted to minutes from midnight. Checks for early arrival or late departure past closing time without fabricating missing hours.
- **Budget (`price_min`)**: Sum of known admission fees is computed per day and total trip. If ticket costs exceed user budget, an explicit warning is attached. An explicit disclaimer clarifies that costs only cover verified admission fees from the database, excluding food, lodging, and transport.

---

## 5. Fallbacks and Known Limitations

1. **No Dining Places in Database**: The 12 active destinations are all cultural heritage, spiritual, and tomb sites. No restaurants or cafés currently exist in `places`. In accordance with strict instructions, the planner does not invent fake restaurant records.
2. **Missing Duration Fallback**: If `duration_minutes` is null in the database, the engine falls back to 60 minutes.
3. **Missing Distance Fallback**: If coordinates are null, `distance_km` and `travel_minutes` are stored as `null`.
4. **Estimated Metrics**: All distances (Haversine) and travel times are approximations based on fixed urban speeds + buffer, not live traffic data.

---

## 6. How Generated Activities Match Live Supabase Schema

Every activity generated by the planner maps directly to `trip_activities`:

| `trip_activities` Column | Planned Value | Type & Nullability Compliance |
|---|---|---|
| `id` | Generated by Supabase (uuid) | Primary Key |
| `trip_day_id` | Assigned during persistence | UUID NOT NULL |
| `place_id` | `place.id` | UUID (foreign key to `places`) |
| `title` | Localized name (`name_vi` or `name_en`) | **text NOT NULL** (Satisfied) |
| `activity_type` | `'visit'` | **text NOT NULL** (Satisfied) |
| `start_time` | Format `"HH:MM"` (e.g. `"08:30"`) | text / time nullable |
| `end_time` | Format `"HH:MM"` (e.g. `"11:30"`) | text / time nullable |
| `duration_minutes` | `duration` integer (e.g. 180) | integer nullable |
| `order_index` | 1, 2, 3... | integer |
| `estimated_cost` | `price_min` (e.g. 200000) or `null` | numeric nullable |
| `transportation` | `'motorbike'`, `'car'`, etc. | text nullable |
| `travel_minutes` | Calculated transit minutes | integer nullable |
| `distance_km` | Calculated Haversine km | numeric nullable |
| `notes` | Localized place description | text nullable |
| `is_ai_generated` | **`false`** | boolean (truthfully indicates rule-based engine) |

---

## 7. Tests Executed and Actual Results

### A. Automated Planner Unit Tests (28 / 28 Passed)
Command: `npx tsx scratch/test_deterministic_planner.ts`
- ✓ Test 1.1 & 1.2: Empty places array fails safely with `NO_PLACES`.
- ✓ Test 2: Inactive places (`is_active = false`) are properly filtered out.
- ✓ Test 3.1–3.5: Valid 1-day itinerary generates 3 ordered activities with Imperial City first and total distance computed.
- ✓ Test 4.1–4.4: Safe handling of null coordinates, opening times, durations, and prices (applies 60m fallback, null distance, null cost).
- ✓ Test 5.1 & 5.2: Multi-day duplicate-place prevention (all place IDs in trip are mutually exclusive).
- ✓ Test 6.1–6.4: Fewer places than days (emits warning, does not invent places for remaining days).
- ✓ Test 7.1 & 7.2: Budget evaluation emits warning when ticket fees exceed user budget.
- ✓ Test 8.1–8.4: Verifies required `title`, `activity_type`, `order_index`, and `is_ai_generated: false`.
- ✓ Test 9: 100% Deterministic: Multiple runs with identical inputs produce identical JSON byte-for-byte.
- ✓ Test 10.1–10.3: Haversine distance and transit estimations verified on real Huế coordinates (Citadel to Thiên Mụ Pagoda ~4.0 km, ~15 mins motorbike).

### B. Live Supabase Real Places Test (Passed)
Command: `npx tsx scratch/test_real_supabase_places.ts`
- Queried all 12 active destinations directly from Supabase.
- **1-Day Balanced Plan (VI)**:
  - Day 1: Đại Nội Huế (08:30-11:30, 200k VND) → Lunch Buffer → Chùa Thiên Mụ (13:45-14:30, Free, 4km) → Làng hương Thủy Xuân (14:41-15:41, Free, 2.6km).
  - Total: 6.6 km, 200,000 VND, 26 min travel.
- **3-Day Trip (EN)**:
  - 9 distinct places across 3 days:
    - Day 1: Imperial City, Thien Mu Pagoda, Thuy Xuan Village (6.6 km, 200k VND)
    - Day 2: Thieu Tri Tomb, Nam Giao Esplanade, Minh Mang Tomb (8.2 km, 250k VND)
    - Day 3: An Dinh Palace, Tu Duc Tomb, Gia Long Tomb (12.9 km, 350k VND)
  - Total: 27.7 km, 800,000 VND, 86 min travel. Zero duplicate places.

### C. Build & Lint Verification (Passed)
- `npm run lint`: **0 errors, 0 warnings**
- `npm run build`: **Built client environment in 236ms, 0 errors**

---

## 8. Unresolved Decisions & Blockers

- **None**: The deterministic engine is complete, tested, and fully aligned with the live schema.
- **Next Phase Decision**: Ready for Phase 6.2C (Connecting `PlanTripPage`, `AIGeneratingPage`, and `TripResultPage` UI flow to this planner).

---

## 9. Manual Verification Steps for User

To verify the test suite directly:
```bash
# 1. Run unit test suite
npx tsx scratch/test_deterministic_planner.ts

# 2. Run real database integration test with the 12 Hue places
npx tsx scratch/test_real_supabase_places.ts

# 3. Verify lint and build
npm run lint
npm run build
```

---

## 10. Confirmation of Boundaries

- **Phase 6.2C is NOT implemented**: The UI screens (`PlanTripPage`, `AIGeneratingPage`, `TripResultPage`) have not been redesigned or wired up to the full async generation lifecycle yet.
- **LLM integration is NOT implemented**: No external AI provider (OpenAI, Gemini) or API key was added.
- **Database schema was NOT altered**: Zero migrations were run.
