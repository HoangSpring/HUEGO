import { handleGenerateItineraryRequest } from '../supabase/functions/generate-itinerary/index.ts';
import type { RawCategoryRecord, RawPlaceRecord, RawTripRecord } from '../supabase/functions/generate-itinerary/catalog.ts';
import type { LLMProvider } from '../supabase/functions/generate-itinerary/provider.ts';

const ownerId = 'user-owner-1';
const accessToken = 'test-user-access-token';
const anonKey = 'test-project-anon-key';
const tripId = 'trip-owned-1';
const categories: RawCategoryRecord[] = [
  { id: 'category-1', name_vi: 'Di tích', name_en: 'Heritage', slug: 'heritage' },
];
const places: RawPlaceRecord[] = [
  {
    id: 'place-1', category_id: 'category-1', name_vi: 'Đại Nội Huế', name_en: 'Hue Citadel',
    slug: 'hue-citadel', description_vi: 'Di tích lịch sử.', description_en: 'Historic site.',
    address: 'Huế', latitude: 16.46, longitude: 107.58, opening_time: '08:00:00',
    closing_time: '17:00:00', duration_minutes: 60, price_min: 0, price_max: 0,
    rating: 4.8, review_count: 0, is_verified: true, is_active: true,
  },
];
const ownedTrip: RawTripRecord = {
  id: tripId, user_id: ownerId, title: 'Test trip', days_count: 1, budget: 100000, status: 'draft',
};
const provider: LLMProvider = {
  name: 'test-provider',
  async generateItinerary() {
    return {
      tripTitle: 'Test itinerary',
      days: [{ dayNumber: 1, title: 'Day 1', activities: [{ placeId: 'place-1', startTime: '09:00', endTime: '10:00' }] }],
    };
  },
};

let passed = 0;
let failed = 0;
function assert(condition: boolean, name: string) {
  if (condition) {
    console.log(`PASS: ${name}`);
    passed++;
  } else {
    console.error(`FAIL: ${name}`);
    failed++;
  }
}

async function main() {
  const previousUrl = process.env.SUPABASE_URL;
  const previousAnonKey = process.env.SUPABASE_ANON_KEY;
  const previousFetch = globalThis.fetch;
  process.env.SUPABASE_URL = 'https://test-project.supabase.co';
  process.env.SUPABASE_ANON_KEY = anonKey;

  let tripMode: 'owned' | 'missing' | 'query-error' | 'other-owner' = 'owned';
  let capturedTripAuthorization = '';
  let providerCalls = 0;
  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes('/rest/v1/trips?')) {
      const headers = new Headers(init?.headers);
      capturedTripAuthorization = headers.get('Authorization') || '';
      if (tripMode === 'query-error') return new Response('', { status: 500 });
      if (tripMode === 'missing') return Response.json([]);
      return Response.json([{ ...ownedTrip, user_id: tripMode === 'other-owner' ? 'another-user' : ownerId }]);
    }
    if (url.includes('/rest/v1/places?')) return Response.json(places);
    if (url.includes('/rest/v1/place_categories?')) return Response.json(categories);
    return new Response('', { status: 404 });
  };

  const request = () => new Request('https://test-project.supabase.co/functions/v1/generate-itinerary', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ tripId, preferences: { durationDays: 1 } }),
  });
  const dependencies = {
    authVerifier: async () => ({ id: ownerId }),
    provider: {
      ...provider,
      async generateItinerary(...args: Parameters<LLMProvider['generateItinerary']>) {
        providerCalls++;
        return provider.generateItinerary(...args);
      },
    },
  };

  try {
    const success = await handleGenerateItineraryRequest(request(), dependencies);
    assert(success.status === 200, 'RLS-protected trip lookup succeeds for the authenticated owner');
    assert(capturedTripAuthorization === `Bearer ${accessToken}`, 'Trip query forwards the verified caller JWT, not the anon key');
    assert(providerCalls === 1, 'Owned trip proceeds to itinerary generation');

    tripMode = 'query-error';
    providerCalls = 0;
    const failedLookup = await handleGenerateItineraryRequest(request(), dependencies);
    const failedLookupBody = await failedLookup.json();
    assert(failedLookup.status === 500 && failedLookupBody.error.code === 'INTERNAL_ERROR', 'PostgREST query failure is not misreported as a missing/forbidden trip');
    assert(providerCalls === 0, 'Trip lookup failure cannot proceed to generation or fallback');

    tripMode = 'missing';
    const missing = await handleGenerateItineraryRequest(request(), dependencies);
    const missingBody = await missing.json();
    assert(missing.status === 404 && missingBody.error.code === 'FORBIDDEN', 'A genuinely absent or RLS-hidden trip retains the non-disclosing 404');

    tripMode = 'other-owner';
    const otherOwner = await handleGenerateItineraryRequest(request(), dependencies);
    const otherOwnerBody = await otherOwner.json();
    assert(otherOwner.status === 403 && otherOwnerBody.error.code === 'FORBIDDEN', 'A visible trip owned by another user remains forbidden');
  } finally {
    globalThis.fetch = previousFetch;
    if (previousUrl === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = previousUrl;
    if (previousAnonKey === undefined) delete process.env.SUPABASE_ANON_KEY;
    else process.env.SUPABASE_ANON_KEY = previousAnonKey;
  }

  console.log(`PHASE 7.4 TRIP OWNERSHIP: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exitCode = 1;
}

void main();
