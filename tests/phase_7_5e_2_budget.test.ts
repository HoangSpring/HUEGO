import { planDeterministicItinerary } from '../src/services/trips/itineraryPlanner.ts';
import { summarizeEntranceFeeBudget } from '../src/services/trips/budgetSummary.ts';
import { validateAndHydrateItinerary } from '../supabase/functions/generate-itinerary/validator.ts';
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

function place(id: string, fee: number | null, rating: number, maxFee: number | null = fee): PlaceRow {
  return {
    id,
    category_id: 'culture',
    name_vi: id,
    name_en: id,
    slug: `test-${id}`,
    description_vi: null,
    description_en: null,
    address: null,
    latitude: 16.46,
    longitude: 107.58,
    opening_time: '07:00:00',
    closing_time: '18:00:00',
    duration_minutes: 60,
    price_min: fee,
    price_max: maxFee,
    rating,
    review_count: 0,
    is_verified: true,
    is_active: true,
    created_at: null,
    updated_at: null,
  };
}

function candidate(id: string, min: number | null, max: number | null): CandidatePlaceSummary {
  return {
    id,
    categoryId: 'culture',
    categoryName: 'Culture',
    nameVi: id,
    nameEn: id,
    slug: id,
    address: null,
    shortDescription: '',
    latitude: 16.46,
    longitude: 107.58,
    openingTime: '07:00:00',
    closingTime: '18:00:00',
    durationMinutes: 60,
    priceMin: min,
    priceMax: max,
    rating: 4,
    isVerified: true,
  };
}

function oneDayActivities(...placeIds: string[]): RawLLMItineraryOutput {
  return {
    tripTitle: 'Budget check',
    days: [{
      dayNumber: 1,
      activities: placeIds.map((placeId, index) => ({
        placeId,
        startTime: `${String(9 + index).padStart(2, '0')}:00`,
        endTime: `${String(10 + index).padStart(2, '0')}:00`,
      })),
    }],
  };
}

// 1. Budget covers the fees selected by the deterministic planner.
{
  const places = [place('first', 150_000, 5), place('second', 100_000, 4)];
  const result = planDeterministicItinerary({ daysCount: 1, budget: 250_000, travelStyle: 'packed' }, places);
  assert(result.success, 'budget covering selected attraction fees succeeds');
  if (result.success) {
    const activityFees = result.itinerary.days[0].activities.map((activity) => activity.estimatedCost);
    const total = activityFees.reduce<number>((sum, fee) => sum + (fee ?? 0), 0);
    assert(total === 250_000 && result.itinerary.totalEstimatedCost === total, 'activity and trip totals match catalog fees');
  }
}

// 2. A budget below a single known required attraction fee is an actionable failure.
{
  const result = planDeterministicItinerary({ daysCount: 1, budget: 99_000 }, [place('required', 100_000, 5)]);
  assert(!result.success && result.code === 'BUDGET_TOO_LOW', 'budget below a single known attraction fee returns actionable error');
}

// 3. Cumulative known fees are capped at the trip budget while higher-cost places are disclosed as omitted.
{
  const result = planDeterministicItinerary({ daysCount: 1, budget: 250_000, travelStyle: 'packed' }, [
    place('highest-priority', 150_000, 5),
    place('next-priority', 100_000, 4),
    place('over-limit', 75_000, 3),
  ]);
  assert(result.success, 'cumulative budget case returns a plan');
  if (result.success) {
    assert(result.itinerary.totalEstimatedCost === 250_000, 'cumulative entrance fees do not exceed total trip budget');
    assert(result.itinerary.warnings.some((warning) => warning.includes('left out') || warning.includes('bỏ qua')), 'omitted destinations are disclosed with an actionable warning');
  }
}

// 4. Transport time/distance is estimated, but transport money is explicitly excluded from this budget model.
{
  const result = planDeterministicItinerary({
    daysCount: 1,
    budget: 100_000,
    transportation: 'car',
    startLocation: { latitude: 16.45, longitude: 107.55 },
  }, [place('with-route', 80_000, 5)]);
  assert(result.success, 'transport estimate case succeeds');
  if (result.success) {
    const activity = result.itinerary.days[0].activities[0];
    assert(activity.distanceKm !== null && activity.travelMinutes !== null, 'distance and transit time remain estimated');
    assert(activity.estimatedCost === 80_000 && result.itinerary.totalEstimatedCost === 80_000, 'no unpriced transport amount is added to entrance-fee totals');
    assert(result.itinerary.warnings.some((warning) => warning.toLowerCase().includes('transportation') || warning.includes('di chuyển')), 'transport cost exclusion is disclosed');
  }
}

// 5. Unknown catalog prices are not treated as free or represented as a complete total.
{
  const result = planDeterministicItinerary({ daysCount: 1, budget: 100_000 }, [place('unknown-fee', null, 5, null)]);
  assert(result.success, 'unknown-price destination remains usable');
  if (result.success) {
    assert(result.itinerary.days[0].activities[0].estimatedCost === null, 'missing entrance fee remains null');
    assert(result.itinerary.totalEstimatedCost === null, 'unknown material fee prevents claiming a complete total');
    assert(result.itinerary.warnings.some((warning) => warning.toLowerCase().includes('incomplete') || warning.includes('chưa đầy đủ')), 'incomplete entrance-fee estimate is disclosed');
  }
  const summary = summarizeEntranceFeeBudget(100_000, [80_000, null]);
  assert(summary.knownFeesTotal === 80_000 && summary.unknownFeeCount === 1, 'display summary keeps known subtotal and unknown fee separate');
}

// 6. Catalog price ranges use the trusted upper value as a conservative budget estimate.
{
  const ranged = place('ranged', 50_000, 5, 150_000);
  const result = planDeterministicItinerary({ daysCount: 1, budget: 149_999 }, [ranged]);
  assert(!result.success && result.code === 'BUDGET_TOO_LOW', 'catalog fee range upper bound is used for budget selection');
}

// 7. AI output above budget is rejected rather than returned as a successful plan.
{
  const candidates = [candidate('ai-a', 150_000, 150_000), candidate('ai-b', 100_000, 100_000)];
  const validated = validateAndHydrateItinerary(oneDayActivities('ai-a', 'ai-b'), candidates, { durationDays: 1, budget: 200_000 });
  assert(!validated.success && validated.code === 'BUDGET_EXCEEDED', 'over-budget grounded AI output is rejected before persistence');
}

console.log(`PHASE 7.5E.2 BUDGET TESTS: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
