import { getCatalogEntranceFeeEstimate, summarizeEntranceFeeBudget } from '../src/services/trips/budgetSummary.ts';
import { isDeterministicFallbackEligible } from '../src/services/trips/fallbackPolicy.ts';
import { planDeterministicItinerary, persistPlannedItinerary } from '../src/services/trips/itineraryPlanner.ts';
import { getTripDaysForCurrentUser } from '../src/services/trips/tripDayService.ts';
import { getActivitiesForTripDay } from '../src/services/trips/tripActivityService.ts';
import { validateAndHydrateItinerary } from '../supabase/functions/generate-itinerary/validator.ts';
import { supabase } from '../src/services/supabase/client.ts';
import type { CandidatePlaceSummary, RawLLMItineraryOutput } from '../supabase/functions/generate-itinerary/types.ts';
import type { PlaceRow } from '../src/types/database.ts';

let passed = 0;
let failed = 0;
function assert(condition: boolean, name: string): void {
  if (condition) {
    console.log(`PASS: ${name}`);
    passed++;
  } else {
    console.error(`FAIL: ${name}`);
    failed++;
  }
}

function place(id: string, fee: number | null, rating: number): PlaceRow {
  return {
    id, category_id: 'culture', name_vi: id, name_en: id, slug: id,
    description_vi: null, description_en: null, address: null,
    latitude: 16.46, longitude: 107.58, opening_time: '07:00:00', closing_time: '18:00:00',
    duration_minutes: 60, price_min: fee, price_max: fee, rating, review_count: 0,
    is_verified: true, is_active: true, created_at: null, updated_at: null,
  };
}

function candidate(id: string, fee: number): CandidatePlaceSummary {
  return {
    id, categoryId: 'culture', categoryName: 'Culture', nameVi: id, nameEn: id,
    slug: id, address: null, shortDescription: '', latitude: 16.46, longitude: 107.58,
    openingTime: '07:00:00', closingTime: '18:00:00', durationMinutes: 60,
    priceMin: fee, priceMax: fee, rating: 4, isVerified: true,
  };
}

function rawPlan(...ids: string[]): RawLLMItineraryOutput {
  return {
    tripTitle: 'Mock AI plan',
    days: [{ dayNumber: 1, activities: ids.map((placeId, index) => ({
      placeId,
      startTime: `${String(9 + index).padStart(2, '0')}:00`,
      endTime: `${String(10 + index).padStart(2, '0')}:00`,
    })) }],
  };
}

// Mock-backed Supabase client for exercising the actual persistence and reload services.
{
  const trip = { id: 'mock-trip', user_id: 'mock-user', title: 'Existing trip', budget: 200_000, days_count: 1 };
  const store = {
    trips: [trip] as Array<Record<string, unknown>>,
    days: [{ id: 'old-day', trip_id: trip.id, day_number: 1, title: 'Old day', estimated_cost: 900_000 }] as Array<Record<string, unknown>>,
    activities: [{ id: 'old-activity', trip_day_id: 'old-day', place_id: 'expensive', estimated_cost: 900_000 }] as Array<Record<string, unknown>>,
  };

  class Query {
    private action = 'select';
    private payload: unknown;
    private filters: Record<string, unknown> = {};
    constructor(private table: string) {}
    select() { return this; }
    eq(column: string, value: unknown) { this.filters[column] = value; return this; }
    order() { return this; }
    insert(payload: unknown) { this.action = 'insert'; this.payload = payload; return this; }
    update(payload: unknown) { this.action = 'update'; this.payload = payload; return this; }
    delete() { this.action = 'delete'; return this; }
    maybeSingle() { return Promise.resolve(this.run(true)); }
    single() { return Promise.resolve(this.run(true)); }
    then(resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) {
      return Promise.resolve(this.run(false)).then(resolve, reject);
    }
    private run(single: boolean): { data: unknown; error: null } {
      const storeKey = this.table === 'trips' ? 'trips' : this.table === 'trip_days' ? 'days' : 'activities';
      const rows = store[storeKey] as Array<Record<string, unknown>>;
      const matches = rows.filter((row) => Object.entries(this.filters).every(([key, value]) => row[key] === value));
      if (this.action === 'delete') {
        const remaining = rows.filter((row) => !matches.includes(row));
        (store as unknown as Record<string, unknown>)[storeKey] = remaining;
        return { data: null, error: null };
      }
      if (this.action === 'update') {
        Object.assign(matches[0] ?? {}, this.payload);
        return { data: single ? matches[0] : matches, error: null };
      }
      if (this.action === 'insert') {
        const inserts = Array.isArray(this.payload) ? this.payload : [this.payload];
        const added = inserts.map((row, index) => ({ id: `${this.table}-${Date.now()}-${index}`, ...(row as object) }));
        rows.push(...added);
        return { data: single ? added[0] : added, error: null };
      }
      return { data: single ? matches[0] ?? null : matches, error: null };
    }
  }

  const client = supabase as unknown as {
    from: (table: string) => Query;
    auth: { getUser: () => Promise<{ data: { user: { id: string } }; error: null }> };
  };
  const oldFrom = client.from;
  const oldGetUser = client.auth.getUser;
  client.from = (table: string) => new Query(table);
  client.auth.getUser = async () => ({ data: { user: { id: 'mock-user' } }, error: null });

  try {
    const replacement = planDeterministicItinerary({ daysCount: 1, budget: 200_000 }, [
      place('budget-fit', 100_000, 5),
      place('still-fits', 100_000, 4),
      place('too-expensive', 900_000, 3),
    ]);
    assert(replacement.success, 'feasible budget recovers to a compliant deterministic itinerary');
    if (replacement.success) {
      const oldIds = store.activities.map((activity) => activity.place_id);
      const newIds = replacement.itinerary.days.flatMap((day) => day.activities.map((activity) => activity.placeId));
      assert(!newIds.some((id) => oldIds.includes(id)), 're-plan generates a new activity selection instead of retaining stale activities');
      await persistPlannedItinerary(trip.id, replacement.itinerary);

      const loadedDays = await getTripDaysForCurrentUser(trip.id);
      const loadedActivities = [];
      for (const day of loadedDays) loadedActivities.push(...await getActivitiesForTripDay(day.id));
      const summary = summarizeEntranceFeeBudget(trip.budget as number, loadedActivities.map((activity) => activity.estimated_cost));
      assert(loadedActivities.length === 2 && summary.knownFeesTotal === 200_000 && !summary.exceedsBudget,
        'persistence and reload retain replacement activities and matching fee total');
      assert(!loadedActivities.some((activity) => activity.place_id === 'expensive'), 'reload excludes stale over-budget activity');
    }
  } finally {
    client.from = oldFrom;
    client.auth.getUser = oldGetUser;
  }
}

// A budget rejection is recoverable, but security, grounding, and other validation errors are not.
{
  const policy = ['PROVIDER_TIMEOUT', 'PROVIDER_NOT_CONFIGURED', 'PROVIDER_RATE_LIMIT', 'PROVIDER_ERROR', 'BUDGET_EXCEEDED'];
  assert(policy.every(isDeterministicFallbackEligible), 'only approved provider failures and budget rejection permit deterministic recovery');
  const prohibited = ['UNAUTHORIZED', 'FORBIDDEN', 'INVALID_REQUEST', 'UNKNOWN_PLACE_ID', 'DAY_COUNT_MISMATCH', 'INVALID_TIME_ORDER', 'INVALID_OUTPUT_FORMAT'];
  assert(prohibited.every((code) => !isDeterministicFallbackEligible(code)), 'auth, ownership, grounding, and other validation failures never fall back');
}

// AI overspend is rejected, while its budget-compliant deterministic recovery succeeds.
{
  const places = [candidate('ai-expensive', 1_100_000), candidate('local-affordable', 100_000)];
  const rejected = validateAndHydrateItinerary(rawPlan('ai-expensive'), places, { durationDays: 1, budget: 200_000 });
  assert(!rejected.success && rejected.code === 'BUDGET_EXCEEDED', 'over-budget AI plan is rejected before it can be presented as final');
  assert(isDeterministicFallbackEligible(rejected.success ? '' : rejected.code), 'rejected AI budget result follows the explicitly allowed recovery path');

  const unknown = getCatalogEntranceFeeEstimate(null, null);
  assert(unknown === null, 'unknown catalog fee remains unknown during shared budget validation');
  const affordable = planDeterministicItinerary({ daysCount: 1, budget: 200_000 }, [
    place('priority-expensive', 1_100_000, 5),
    place('budget-friendly', 100_000, 4),
  ]);
  assert(affordable.success && affordable.itinerary.totalEstimatedCost === 100_000,
    'deterministic recovery selects a feasible lower-cost verified destination');
}

console.log(`PHASE 7.5E.3 REPLANNING TESTS: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
