/**
 * HUEGO — Edge Function: Trusted Catalog Retrieval & Grounding
 * Retrieves active places from the database and structures them for safe LLM ingestion.
 */

import type { CandidatePlaceSummary } from './types.ts';

export interface RawPlaceRecord {
  id: string;
  category_id: string | null;
  name_vi: string | null;
  name_en: string | null;
  slug: string | null;
  description_vi: string | null;
  description_en: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  opening_time: string | null;
  closing_time: string | null;
  duration_minutes: number | null;
  price_min: number | null;
  price_max: number | null;
  rating: number | null;
  review_count: number | null;
  is_verified: boolean | null;
  is_active: boolean | null;
}

export interface RawCategoryRecord {
  id: string;
  name_vi: string | null;
  name_en: string | null;
  slug: string | null;
}

export interface RawTripRecord {
  id: string;
  user_id: string | null;
  title: string | null;
  days_count: number | null;
  budget: number | null;
  status: string | null;
}

/**
 * Sanitizes untrusted text retrieved from the database to prevent prompt injection
 * or formatting breakage when injected into LLM prompt templates.
 */
export function sanitizeCatalogText(text: string | null | undefined, maxLength = 200): string {
  if (!text) return '';
  return text
    .replace(/<[^>]*>/g, '') // strip HTML/XML tags
    .replace(/[\r\n\t]+/g, ' ') // normalize whitespace
    .trim()
    .slice(0, maxLength);
}

/**
 * Transforms raw Supabase place records into clean, bounded CandidatePlaceSummary objects.
 * Strictly adheres to factual values present in the database.
 */
export function processPlaceCandidates(
  places: RawPlaceRecord[],
  categories: RawCategoryRecord[] = [],
  language: 'vi' | 'en' = 'vi',
  maxCandidates = 30
): CandidatePlaceSummary[] {
  const categoryMap = new Map<string, string>();
  for (const cat of categories) {
    const label = (language === 'en' ? cat.name_en : cat.name_vi) || cat.name_vi || cat.slug || 'Attraction';
    categoryMap.set(cat.id, label);
  }

  // Filter only active places
  const activePlaces = places.filter((p) => p.is_active === true);

  const candidates: CandidatePlaceSummary[] = [];

  for (let i = 0; i < Math.min(activePlaces.length, maxCandidates); i++) {
    const p = activePlaces[i];

    const nameVi = p.name_vi || p.name_en || 'Địa điểm Huế';
    const nameEn = p.name_en || p.name_vi || 'Hue Attraction';
    const categoryName = p.category_id ? categoryMap.get(p.category_id) || 'Cultural Heritage' : 'Cultural Heritage';

    const rawDesc = language === 'en' ? (p.description_en || p.description_vi) : (p.description_vi || p.description_en);
    const shortDescription = sanitizeCatalogText(rawDesc, 200);

    let lat = p.latitude;
    let lon = p.longitude;
    if (lat !== null && (isNaN(lat) || lat < -90 || lat > 90)) lat = null;
    if (lon !== null && (isNaN(lon) || lon < -180 || lon > 180)) lon = null;

    candidates.push({
      id: p.id,
      categoryId: p.category_id,
      categoryName,
      nameVi,
      nameEn,
      slug: p.slug,
      address: p.address ? sanitizeCatalogText(p.address, 100) : null,
      shortDescription,
      latitude: lat,
      longitude: lon,
      openingTime: p.opening_time ? p.opening_time.slice(0, 5) : null,
      closingTime: p.closing_time ? p.closing_time.slice(0, 5) : null,
      durationMinutes: p.duration_minutes && p.duration_minutes > 0 ? p.duration_minutes : 60,
      priceMin: p.price_min !== null && p.price_min >= 0 ? p.price_min : null,
      priceMax: p.price_max !== null && p.price_max >= 0 ? p.price_max : null,
      rating: p.rating !== null && p.rating >= 0 && p.rating <= 5 ? p.rating : null,
      isVerified: p.is_verified === true, // Strictly matches DB verified status
    });
  }

  return candidates;
}
