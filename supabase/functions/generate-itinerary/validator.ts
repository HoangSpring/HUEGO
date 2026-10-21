/**
 * HUEGO — Edge Function: Output Validation & Fact Hydration
 * Validates raw model output against trusted database records, enforces chronological
 * time ordering and day boundaries, and hydrates verified facts directly from the database.
 */

import type {
  CandidatePlaceSummary,
  ErrorCode,
  RawLLMActivity,
  RawLLMDay,
  RawLLMItineraryOutput,
  TripPlanningPreferences,
  ValidatedPlannedActivity,
  ValidatedPlannedDay,
  ValidatedPlannedItinerary,
} from './types.ts';
import { getCatalogEntranceFeeEstimate } from '../../../src/services/trips/budgetSummary.ts';

const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

/**
 * Converts HH:MM string to total minutes from midnight (0..1439).
 * Returns null if format is invalid.
 */
export function parseTimeToMinutes(timeStr: string | null | undefined): number | null {
  if (!timeStr) return null;
  const match = timeStr.trim().match(TIME_REGEX);
  if (!match) return null;
  const hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return hours * 60 + minutes;
}

/**
 * Calculates Haversine distance in kilometers between two GPS coordinates.
 */
function calculateDistanceKm(
  lat1: number | null,
  lon1: number | null,
  lat2: number | null,
  lon2: number | null
): number | null {
  if (lat1 === null || lon1 === null || lat2 === null || lon2 === null) return null;
  if (lat1 === lat2 && lon1 === lon2) return 0;

  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

/**
 * Estimates travel duration in minutes based on distance and transportation mode.
 */
function estimateTravelMinutes(
  distanceKm: number | null,
  transportation?: string | null
): number | null {
  if (distanceKm === null || distanceKm < 0) return null;
  if (distanceKm === 0) return 0;

  switch (transportation) {
    case 'walking':
      return Math.max(5, Math.round((distanceKm / 4.5) * 60));
    case 'cyclo':
      return Math.max(10, Math.round((distanceKm / 10) * 60) + 5);
    case 'car':
    case 'taxi':
      return Math.max(5, Math.round((distanceKm / 30) * 60) + 5);
    case 'motorbike':
    case 'mixed':
    default:
      return Math.max(5, Math.round((distanceKm / 25) * 60) + 5);
  }
}

export type ValidationOutcome =
  | { success: true; data: ValidatedPlannedItinerary }
  | { success: false; error: string; code: ErrorCode };

/**
 * Validates raw model output, enforces referential integrity against candidate places,
 * verifies chronological activity times without overlaps, and hydrates factual data from the database.
 */
export function validateAndHydrateItinerary(
  raw: RawLLMItineraryOutput,
  candidates: CandidatePlaceSummary[],
  preferences: TripPlanningPreferences
): ValidationOutcome {
  if (!raw || typeof raw !== 'object') {
    return { success: false, error: 'Model output must be a valid JSON object.', code: 'INVALID_OUTPUT_FORMAT' };
  }

  if (!Array.isArray(raw.days)) {
    return { success: false, error: 'Model output must contain a "days" array.', code: 'INVALID_OUTPUT_FORMAT' };
  }

  const expectedDaysCount = preferences.durationDays;
  if (raw.days.length !== expectedDaysCount) {
    return {
      success: false,
      error: `Model returned ${raw.days.length} days, expected exactly ${expectedDaysCount} days.`,
      code: 'DAY_COUNT_MISMATCH',
    };
  }

  // Build quick candidate lookup map by place ID
  const candidateMap = new Map<string, CandidatePlaceSummary>();
  for (const c of candidates) {
    candidateMap.set(c.id, c);
  }

  const isEn = preferences.language === 'en';
  const warnings: string[] = [];
  const scheduledPlaceIds = new Set<string>();

  const validatedDays: ValidatedPlannedDay[] = [];
  let tripTotalCost = 0;
  let tripTotalDistance = 0;
  let tripTotalTravelMinutes = 0;
  let hasAnyCost = false;
  let hasUnknownCost = false;

  let lastCoords: { lat: number; lon: number } | null = preferences.startLocation
    ? { lat: preferences.startLocation.latitude, lon: preferences.startLocation.longitude }
    : null;

  for (let dIdx = 0; dIdx < raw.days.length; dIdx++) {
    const rawDay = raw.days[dIdx] as RawLLMDay;
    const dayNumber = dIdx + 1;

    if (!rawDay || typeof rawDay !== 'object') {
      return { success: false, error: `Day at index ${dIdx} is invalid.`, code: 'INVALID_OUTPUT_FORMAT' };
    }

    if (!Array.isArray(rawDay.activities)) {
      return { success: false, error: `Day ${dayNumber} is missing "activities" array.`, code: 'INVALID_OUTPUT_FORMAT' };
    }

    if (rawDay.activities.length === 0) {
      return { success: false, error: `Day ${dayNumber} must contain at least one scheduled activity.`, code: 'MISSING_ACTIVITIES' };
    }

    if (rawDay.activities.length > 8) {
      return { success: false, error: `Day ${dayNumber} cannot exceed 8 activities.`, code: 'INVALID_ACTIVITY_ORDER' };
    }

    const validatedActivities: ValidatedPlannedActivity[] = [];
    let dayCost = 0;
    let dayHasKnownCost = false;
    let dayDistance = 0;
    let dayTravelMinutes = 0;

    let prevActivityEndMins: number | null = null;
    let prevEndTimeStr = '';

    for (let aIdx = 0; aIdx < rawDay.activities.length; aIdx++) {
      const rawAct = rawDay.activities[aIdx] as RawLLMActivity;
      const orderIndex = aIdx + 1;

      if (!rawAct || typeof rawAct !== 'object') {
        return { success: false, error: `Activity ${orderIndex} on Day ${dayNumber} is invalid.`, code: 'INVALID_OUTPUT_FORMAT' };
      }

      // 1. Referential Integrity (Catalog Grounding)
      if (!rawAct.placeId || typeof rawAct.placeId !== 'string') {
        return {
          success: false,
          error: `Activity ${orderIndex} on Day ${dayNumber} is missing a placeId string.`,
          code: 'UNKNOWN_PLACE_ID',
        };
      }

      const candidate = candidateMap.get(rawAct.placeId);
      if (!candidate) {
        return {
          success: false,
          error: `Model proposed placeId "${rawAct.placeId}" which does not exist in the active candidate catalog.`,
          code: 'UNKNOWN_PLACE_ID',
        };
      }

      // Deduplication check
      if (scheduledPlaceIds.has(candidate.id)) {
        warnings.push(
          isEn
            ? `Destination "${candidate.nameEn}" was scheduled multiple times across the trip.`
            : `Địa điểm "${candidate.nameVi}" được lên lịch nhiều lần trong chuyến đi.`
        );
      }
      scheduledPlaceIds.add(candidate.id);

      // 2. Strict Time Validation & Logical Ordering
      const startTime = rawAct.startTime?.trim() || '';
      const endTime = rawAct.endTime?.trim() || '';

      const startMins = parseTimeToMinutes(startTime);
      const endMins = parseTimeToMinutes(endTime);

      if (startMins === null || endMins === null) {
        return {
          success: false,
          error: `Activity ${orderIndex} on Day ${dayNumber} must have valid startTime and endTime in HH:MM format (received "${startTime}" - "${endTime}").`,
          code: 'INVALID_TIME_ORDER',
        };
      }

      if (startMins >= endMins) {
        return {
          success: false,
          error: `Activity ${orderIndex} on Day ${dayNumber} has invalid time order: startTime (${startTime}) must be strictly before endTime (${endTime}).`,
          code: 'INVALID_TIME_ORDER',
        };
      }

      // Day boundary check: activities should be scheduled within sensible visiting hours (06:00 - 23:00)
      if (startMins < 6 * 60 || endMins > 23 * 60) {
        return {
          success: false,
          error: `Activity ${orderIndex} on Day ${dayNumber} (${startTime} - ${endTime}) falls outside reasonable visiting hours (06:00 to 23:00).`,
          code: 'INVALID_TIME_ORDER',
        };
      }

      // Chronological non-overlapping sequence within the day
      if (prevActivityEndMins !== null && startMins < prevActivityEndMins) {
        return {
          success: false,
          error: `Activities on Day ${dayNumber} overlap in time: Activity ${orderIndex} starts at ${startTime}, before previous activity ends at ${prevEndTimeStr}.`,
          code: 'INVALID_TIME_ORDER',
        };
      }

      prevActivityEndMins = endMins;
      prevEndTimeStr = endTime;

      const durationMinutes = endMins - startMins;

      // 3. Distance and transit calculation
      let distKm: number | null = null;
      let travelMins: number | null = null;

      if (lastCoords && candidate.latitude !== null && candidate.longitude !== null) {
        distKm = calculateDistanceKm(lastCoords.lat, lastCoords.lon, candidate.latitude, candidate.longitude);
        travelMins = estimateTravelMinutes(distKm, preferences.transportation);
        if (distKm !== null) {
          dayDistance += distKm;
        }
        if (travelMins !== null) {
          dayTravelMinutes += travelMins;
        }
      }

      // 4. Fact hydration: use trusted admission fee directly from candidate record
      let activityCost: number | null = null;
      const catalogFee = getCatalogEntranceFeeEstimate(candidate.priceMin, candidate.priceMax);
      if (catalogFee !== null) {
        activityCost = catalogFee;
        dayCost += activityCost;
        hasAnyCost = true;
        dayHasKnownCost = true;
      } else {
        hasUnknownCost = true;
      }

      const placeName = isEn ? candidate.nameEn : candidate.nameVi;
      const title = rawAct.title?.trim() || (isEn ? `Visit ${placeName}` : `Tham quan ${placeName}`);

      validatedActivities.push({
        placeId: candidate.id,
        title,
        activityType: rawAct.activityType?.trim() || 'visit',
        startTime,
        endTime,
        durationMinutes,
        orderIndex,
        estimatedCost: activityCost,
        transportation: preferences.transportation || 'motorbike',
        travelMinutes: travelMins,
        distanceKm: distKm,
        notes: rawAct.notes ? rawAct.notes.trim().slice(0, 500) : null,
        localTip: rawAct.localTip ? rawAct.localTip.trim().slice(0, 300) : null,
        isAiGenerated: true,
      });

      // Update position for next stop
      if (candidate.latitude !== null && candidate.longitude !== null) {
        lastCoords = { lat: candidate.latitude, lon: candidate.longitude };
      }
    }

    tripTotalCost += dayCost;
    tripTotalDistance += dayDistance;
    tripTotalTravelMinutes += dayTravelMinutes;

    validatedDays.push({
      dayNumber,
      title: rawDay.title?.trim() || (isEn ? `Day ${dayNumber}` : `Ngày ${dayNumber}`),
      theme: rawDay.theme?.trim(),
      estimatedCost: dayHasKnownCost ? dayCost : null,
      totalDistanceKm: dayDistance > 0 ? Math.round(dayDistance * 10) / 10 : null,
      estimatedTravelMinutes: dayTravelMinutes > 0 ? dayTravelMinutes : null,
      activities: validatedActivities,
    });
  }

  // An over-budget AI plan is not a valid success. The client may recover only
  // this specific quality failure through the budget-aware deterministic planner.
  if (
    preferences.budget != null && Number.isFinite(preferences.budget) && preferences.budget >= 0 &&
    hasAnyCost && tripTotalCost > preferences.budget
  ) {
    return {
      success: false,
      code: 'BUDGET_EXCEEDED',
      error: isEn
        ? `The AI itinerary's known entrance fees (${tripTotalCost.toLocaleString()} VND) exceed your total trip budget (${preferences.budget.toLocaleString()} VND). A budget-aware alternative will be attempted.`
        : `Phí tham quan đã biết trong lịch trình AI (${tripTotalCost.toLocaleString()} VND) vượt ngân sách toàn chuyến đi (${preferences.budget.toLocaleString()} VND). Hệ thống sẽ thử phương án phù hợp ngân sách.`,
    };
  }

  if (hasUnknownCost) {
    warnings.push(
      isEn
        ? 'One or more scheduled destinations have no verified catalog fee. The displayed entrance-fee subtotal is incomplete.'
        : 'Một hoặc nhiều địa điểm chưa có giá vé xác thực trong danh mục. Tổng phí tham quan đang hiển thị chưa đầy đủ.'
    );
  }

  warnings.push(
    isEn
      ? 'The budget applies to the total trip. Entrance-fee estimates use catalog price limits; transportation, food, and lodging are not included.'
      : 'Ngân sách áp dụng cho toàn chuyến đi. Phí tham quan ước tính theo mức giá trong danh mục; chưa bao gồm di chuyển, ăn uống và lưu trú.'
  );

  const finalTitle = raw.tripTitle?.trim() || (
    isEn ? `${expectedDaysCount}-Day Huế Journey` : `Lịch trình khám phá Huế ${expectedDaysCount} ngày`
  );

  return {
    success: true,
    data: {
      tripTitle: finalTitle,
      daysCount: expectedDaysCount,
      totalEstimatedCost: hasAnyCost && !hasUnknownCost ? tripTotalCost : null,
      totalDistanceKm: tripTotalDistance > 0 ? Math.round(tripTotalDistance * 10) / 10 : null,
      estimatedTravelMinutes: tripTotalTravelMinutes > 0 ? tripTotalTravelMinutes : null,
      days: validatedDays,
      warnings,
    },
  };
}
