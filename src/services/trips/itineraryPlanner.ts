/**
 * Deterministic Itinerary Planner for HUEGO.
 *
 * Generates structured, reproducible multi-day Huế travel itineraries using real, active
 * place records from Supabase. Adheres strictly to the following principles:
 *
 * 1. REAL PLACES ONLY: Only schedules places that exist in the database; never fabricates
 *    unverified attractions, restaurants, or placeholder UUIDs.
 * 2. DETERMINISTIC & REPRODUCIBLE: Given the same inputs and place records, produces the exact same schedule.
 * 3. NO DUPLICATES: Never schedules the same destination more than once across a trip.
 * 4. OPENING HOURS & DURATIONS: Respects opening_time and closing_time when available; uses duration_minutes
 *    with a conservative 60-minute fallback when duration is missing.
 * 5. GEOGRAPHIC SEQUENCING: Orders places within each day by geographic proximity using Haversine distance.
 * 6. TRUTHFUL ATTRIBUTION: Sets `is_ai_generated: false` for all activities since this engine is deterministic.
 */

import type { CompanionType, PlaceRow, Transportation } from '../../types/database';
import { getCatalogEntranceFeeEstimate } from './budgetSummary';
import { calculateDistanceKm, estimateTravelMinutes, orderPlacesByProximity } from '../maps/distanceService';
import { createTripActivity, deleteTripActivity, getActivitiesForTripDay } from './tripActivityService';
import { createTripDay, deleteTripDay, getTripDaysForCurrentUser } from './tripDayService';
import { getTripByIdForCurrentUser, updateTrip } from './tripService';

export interface ItineraryPlanningInput {
  daysCount: number;
  budget?: number | null;
  budgetLevel?: string | null;
  peopleCount?: number | null;
  companionType?: CompanionType | null;
  transportation?: Transportation | null;
  interests?: string[];
  travelStyle?: 'relaxed' | 'balanced' | 'packed' | string;
  startLocation?: { latitude: number; longitude: number; label?: string } | null;
  language?: 'vi' | 'en';
}

export interface PlannedActivity {
  placeId: string | null;
  title: string;
  activityType: string;
  startTime: string | null;
  endTime: string | null;
  durationMinutes: number | null;
  orderIndex: number;
  estimatedCost: number | null;
  transportation: string | null;
  travelMinutes: number | null;
  distanceKm: number | null;
  notes: string | null;
  isAiGenerated: boolean;
}

export interface PlannedDay {
  dayNumber: number;
  title: string;
  estimatedCost: number | null;
  totalDistanceKm: number | null;
  estimatedTravelMinutes: number | null;
  activities: PlannedActivity[];
}

export interface PlannedItinerary {
  tripTitle: string;
  daysCount: number;
  totalEstimatedCost: number | null;
  totalDistanceKm: number | null;
  days: PlannedDay[];
  warnings: string[];
}

export type PlanningResult =
  | { success: true; itinerary: PlannedItinerary }
  | { success: false; error: string; code: 'NO_PLACES' | 'INVALID_DURATION' | 'INSUFFICIENT_DATA' | 'BUDGET_TOO_LOW' };

/**
 * Converts a time string (e.g. "07:30:00" or "07:30") to total minutes from midnight.
 * Returns null if the format is invalid or undefined.
 */
export function parseTimeToMinutes(timeStr: string | null | undefined): number | null {
  if (!timeStr) return null;
  const parts = timeStr.trim().split(':');
  if (parts.length < 2) return null;

  const hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);

  if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return null;
  }

  return hours * 60 + minutes;
}

/**
 * Formats total minutes from midnight to a 24-hour HH:MM string.
 */
export function formatMinutesToTime(totalMinutes: number): string {
  const normalized = Math.max(0, Math.min(24 * 60 - 1, Math.floor(totalMinutes)));
  const hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

/**
 * Calculates a deterministic priority score for a place based on user preferences.
 */
function scorePlace(place: PlaceRow, input: ItineraryPlanningInput): number {
  let score = 0;

  // 1. Category / Interest match
  if (input.interests && input.interests.length > 0) {
    if (place.category_id && input.interests.includes(place.category_id)) {
      score += 15;
    }
    if (place.slug && input.interests.includes(place.slug)) {
      score += 10;
    }
  }

  // 2. Verified rating or neutral fallback
  if (place.rating != null && place.rating > 0) {
    score += place.rating;
  } else {
    score += 4.0;
  }

  // 3. Iconic Hue landmarks prioritization (Đại Nội, Thiên Mụ, Thủy Xuân)
  // Ensures short trips always include quintessential cultural highlights
  if (place.slug === 'dai-noi-hue') score += 20;
  if (place.slug === 'thien-mu-pagoda' || place.slug === 'chua-thien-mu') score += 12;
  if (place.slug === 'thuy-xuan-incense-village' || place.slug === 'lang-huong-thuy-xuan') score += 8;
  if (place.slug === 'tu-duc-tomb' || place.slug === 'lang-vua-tu-duc') score += 6;

  return score;
}

/**
 * Generates a title for a day section based on the scheduled places and language.
 */
function generateDayTitle(dayNumber: number, placesInDay: PlaceRow[], isEn: boolean): string {
  if (placesInDay.length === 0) {
    return isEn ? `Day ${dayNumber}: Free Day` : `Ngày ${dayNumber}: Ngày tự do`;
  }

  const primaryName = isEn
    ? placesInDay[0].name_en || placesInDay[0].name_vi
    : placesInDay[0].name_vi || placesInDay[0].name_en;

  if (placesInDay.length === 1) {
    return isEn ? `Day ${dayNumber}: ${primaryName}` : `Ngày ${dayNumber}: ${primaryName}`;
  }

  const secondaryName = isEn
    ? placesInDay[1].name_en || placesInDay[1].name_vi
    : placesInDay[1].name_vi || placesInDay[1].name_en;

  return isEn
    ? `Day ${dayNumber}: ${primaryName} & ${secondaryName}`
    : `Ngày ${dayNumber}: ${primaryName} & ${secondaryName}`;
}

/**
 * Core deterministic planning function.
 */
export function planDeterministicItinerary(
  input: ItineraryPlanningInput,
  places: PlaceRow[]
): PlanningResult {
  const isEn = input.language === 'en';

  // 1. Duration validation
  const safeDaysCount = Math.floor(input.daysCount);
  if (isNaN(safeDaysCount) || safeDaysCount < 1) {
    return {
      success: false,
      error: isEn
        ? 'Trip duration must be at least 1 day.'
        : 'Số ngày của chuyến đi phải từ 1 ngày trở lên.',
      code: 'INVALID_DURATION',
    };
  }

  // 2. Active places filter
  const activePlaces = places.filter((p) => p.is_active === true);
  if (activePlaces.length === 0) {
    return {
      success: false,
      error: isEn
        ? 'No active destinations found in the database.'
        : 'Không tìm thấy địa điểm nào đang hoạt động trong cơ sở dữ liệu.',
      code: 'NO_PLACES',
    };
  }

  const warnings: string[] = [];

  // 3. Scoring & Deterministic Sorting
  // Sorter uses score descending with place ID as a strict tie-breaker
  const sortedPlaces = [...activePlaces].sort((a, b) => {
    const scoreDiff = scorePlace(b, input) - scorePlace(a, input);
    if (scoreDiff !== 0) return scoreDiff;
    return a.id.localeCompare(b.id);
  });

  // 4. Determine capacity per day
  let placesPerDay = 3;
  if (input.travelStyle === 'relaxed') placesPerDay = 2;
  if (input.travelStyle === 'packed') placesPerDay = 4;

  const targetTotalPlaces = Math.min(sortedPlaces.length, safeDaysCount * placesPerDay);
  const hasBudget = input.budget != null && Number.isFinite(input.budget) && input.budget >= 0;
  const budgetLimit = input.budget ?? 0;
  let remainingBudget = hasBudget ? input.budget! : Number.POSITIVE_INFINITY;
  let skippedOverBudgetPlaces = 0;
  const selectedPlaces: PlaceRow[] = [];

  for (const place of sortedPlaces) {
    if (selectedPlaces.length >= targetTotalPlaces) break;

    if (hasBudget) {
      const fee = getCatalogEntranceFeeEstimate(place.price_min, place.price_max);
      if (fee !== null) {
        if (fee > remainingBudget) {
          skippedOverBudgetPlaces++;
          continue;
        }
        remainingBudget -= fee;
      }
    }

    // Unknown catalog fees remain visible as unknown; they are never counted as zero.
    selectedPlaces.push(place);
  }

  if (hasBudget && skippedOverBudgetPlaces > 0) {
    warnings.push(
      isEn
        ? `${skippedOverBudgetPlaces} destination(s) were left out because their catalog entrance fees would exceed your total trip budget. Increase the budget or adjust the itinerary preferences to include them.`
        : `Đã bỏ qua ${skippedOverBudgetPlaces} địa điểm vì phí tham quan theo dữ liệu hiện có sẽ vượt ngân sách toàn chuyến đi. Hãy tăng ngân sách hoặc điều chỉnh sở thích để thêm các địa điểm này.`
    );
  }

  if (hasBudget && selectedPlaces.length === 0 && skippedOverBudgetPlaces > 0) {
    return {
      success: false,
      error: isEn
        ? `Your total trip budget (${input.budget!.toLocaleString()} VND) is below the lowest known entrance fee. Increase the budget or choose a different itinerary.`
        : `Ngân sách toàn chuyến đi (${input.budget!.toLocaleString()} VND) thấp hơn giá vé thấp nhất đã biết. Hãy tăng ngân sách hoặc chọn lịch trình khác.`,
      code: 'BUDGET_TOO_LOW',
    };
  }

  if (selectedPlaces.length < safeDaysCount) {
    warnings.push(
      hasBudget && skippedOverBudgetPlaces > 0
        ? isEn
          ? `The total trip budget allows ${selectedPlaces.length} scheduled destination(s) across ${safeDaysCount} days. Increase it to add more destinations.`
          : `Ngân sách toàn chuyến đi hiện chỉ đủ cho ${selectedPlaces.length} địa điểm trong ${safeDaysCount} ngày. Hãy tăng ngân sách để thêm địa điểm.`
        : isEn
          ? `Database currently contains ${selectedPlaces.length} suitable places for a ${safeDaysCount}-day trip. Some days will have no scheduled activities.`
          : `Cơ sở dữ liệu chỉ có ${selectedPlaces.length} địa điểm phù hợp cho chuyến đi ${safeDaysCount} ngày. Một số ngày sẽ không có hoạt động được lên lịch.`
    );
  }

  // 5. Partition places across days (clustering)
  // Ensures every place is scheduled at most once (Set tracking)
  const dayBuckets: PlaceRow[][] = Array.from({ length: safeDaysCount }, () => []);
  const scheduledPlaceIds = new Set<string>();

  let currentDayIndex = 0;
  for (const place of selectedPlaces) {
    if (scheduledPlaceIds.has(place.id)) {
      continue;
    }

    // Find the best bucket: either current bucket if not full, or next bucket
    while (dayBuckets[currentDayIndex].length >= placesPerDay && currentDayIndex < safeDaysCount - 1) {
      currentDayIndex++;
    }

    dayBuckets[currentDayIndex].push(place);
    scheduledPlaceIds.add(place.id);
  }

  // 6. Schedule each day's timeline
  const plannedDays: PlannedDay[] = [];
  let tripEstimatedCost = 0;
  let hasAnyKnownCost = false;
  let hasUnknownCost = false;
  let tripTotalDistance = 0;

  for (let dayIndex = 0; dayIndex < safeDaysCount; dayIndex++) {
    const rawPlaces = dayBuckets[dayIndex];
    const dayNumber = dayIndex + 1;

    // Order destinations within the day by geographic proximity
    const startCoord = dayIndex === 0 ? input.startLocation ?? null : null;
    const orderedPlaces = orderPlacesByProximity(rawPlaces, startCoord);

    const plannedActivities: PlannedActivity[] = [];
    let dayCost = 0;
    let dayHasKnownCost = false;
    let dayDistance = 0;
    let dayTravelMinutes = 0;

    // Timeline starts at 08:30 in the morning
    let currentClockMinutes = 8 * 60 + 30;
    let lastPlaceCoords = startCoord ? { lat: startCoord.latitude, lon: startCoord.longitude } : null;

    for (let i = 0; i < orderedPlaces.length; i++) {
      const place = orderedPlaces[i];
      const placeName = (isEn ? place.name_en : place.name_vi) || place.name_vi || place.name_en || 'Huế Destination';

      // A. Calculate travel distance & transit time from last position
      let distKm: number | null = null;
      let travelMins: number | null = null;

      if (lastPlaceCoords && place.latitude != null && place.longitude != null) {
        distKm = calculateDistanceKm(lastPlaceCoords.lat, lastPlaceCoords.lon, place.latitude, place.longitude);
        travelMins = estimateTravelMinutes(distKm, input.transportation);

        if (distKm != null) dayDistance += distKm;
        if (travelMins != null) dayTravelMinutes += travelMins;
      }

      // Add travel time to clock
      if (travelMins != null && travelMins > 0) {
        currentClockMinutes += travelMins;
      }

      // B. Opening time check
      const openMins = parseTimeToMinutes(place.opening_time);
      const closeMins = parseTimeToMinutes(place.closing_time);

      if (openMins != null && currentClockMinutes < openMins) {
        // Destination has not opened yet; wait until opening
        currentClockMinutes = openMins;
      }

      const startTimeStr = formatMinutesToTime(currentClockMinutes);

      // C. Visit duration
      const duration = place.duration_minutes != null && place.duration_minutes > 0 ? place.duration_minutes : 60;
      const endClockMinutes = currentClockMinutes + duration;
      const endTimeStr = formatMinutesToTime(endClockMinutes);

      // D. Closing time warning check
      if (closeMins != null && endClockMinutes > closeMins) {
        warnings.push(
          isEn
            ? `${placeName} closes at ${place.closing_time?.slice(0, 5) ?? 'closing'}. Your scheduled visit may extend past closing time.`
            : `${placeName} đóng cửa lúc ${place.closing_time?.slice(0, 5) ?? 'giờ đóng cửa'}. Lịch trình có thể vượt quá giờ mở cửa.`
        );
      }

      // E. Cost calculation
      let activityCost: number | null = null;
      const catalogFee = getCatalogEntranceFeeEstimate(place.price_min, place.price_max);
      if (catalogFee !== null) {
        activityCost = catalogFee;
        dayCost += activityCost;
        hasAnyKnownCost = true;
        dayHasKnownCost = true;
      } else {
        hasUnknownCost = true;
      }

      plannedActivities.push({
        placeId: place.id,
        title: placeName,
        activityType: 'visit',
        startTime: startTimeStr,
        endTime: endTimeStr,
        durationMinutes: duration,
        orderIndex: i + 1,
        estimatedCost: activityCost,
        transportation: input.transportation || 'motorbike',
        travelMinutes: travelMins,
        distanceKm: distKm,
        notes: (isEn ? place.description_en : place.description_vi) || null,
        isAiGenerated: false,
      });

      // Update position for next step
      if (place.latitude != null && place.longitude != null) {
        lastPlaceCoords = { lat: place.latitude, lon: place.longitude };
      }

      // Advance clock
      currentClockMinutes = endClockMinutes;

      // F. Lunch break buffer: if an activity finishes between 11:30 and 13:00,
      // allow time for lunch and advance next afternoon visit to at least 13:30
      if (currentClockMinutes >= 11 * 60 + 30 && currentClockMinutes <= 13 * 60) {
        currentClockMinutes = 13 * 60 + 30;
      }
    }

    tripEstimatedCost += dayCost;
    tripTotalDistance += dayDistance;

    plannedDays.push({
      dayNumber,
      title: generateDayTitle(dayNumber, orderedPlaces, isEn),
      estimatedCost: dayHasKnownCost ? dayCost : null,
      totalDistanceKm: dayDistance > 0 ? Math.round(dayDistance * 10) / 10 : null,
      estimatedTravelMinutes: dayTravelMinutes > 0 ? dayTravelMinutes : null,
      activities: plannedActivities,
    });
  }

  // 7. Budget analysis & disclaimer
  if (hasBudget && hasAnyKnownCost) {
    if (tripEstimatedCost > budgetLimit) {
      warnings.push(
        isEn
          ? `Estimated admission fees (${tripEstimatedCost.toLocaleString()} VND) exceed your stated budget (${budgetLimit.toLocaleString()} VND).`
          : `Tổng chi phí vé tham quan ước tính (${tripEstimatedCost.toLocaleString()} VND) vượt quá ngân sách bạn đã đặt (${budgetLimit.toLocaleString()} VND).`
      );
    }
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

  const itinerary: PlannedItinerary = {
    tripTitle: isEn ? `${safeDaysCount}-Day Huế Itinerary` : `Lịch trình khám phá Huế ${safeDaysCount} ngày`,
    daysCount: safeDaysCount,
    totalEstimatedCost: hasAnyKnownCost && !hasUnknownCost ? tripEstimatedCost : null,
    totalDistanceKm: tripTotalDistance > 0 ? Math.round(tripTotalDistance * 10) / 10 : null,
    days: plannedDays,
    warnings,
  };

  return { success: true, itinerary };
}

/**
 * Persists a generated PlannedItinerary to Supabase using existing service calls.
 *
 * Safe transactional behavior:
 * - Pre-validates tripId and itinerary structure before performing any mutations.
 * - Verifies current user owns the trip via RLS.
 * - Cleans up previous activities and days for this trip to prevent duplicate day_number keys.
 * - Tracks newly created day IDs and performs compensation cleanup if any insertion fails midway.
 * - Updates trip header and status to 'planned'.
 */
export async function persistPlannedItinerary(
  tripId: string,
  itinerary: PlannedItinerary
): Promise<void> {
  // 1. Pre-validation: ensure input is valid before touching the database
  if (!tripId || typeof tripId !== 'string') {
    throw new Error('Invalid trip ID provided for persistence.');
  }

  if (!itinerary || !Array.isArray(itinerary.days) || itinerary.days.length === 0) {
    throw new Error('Cannot persist an empty or malformed itinerary.');
  }

  for (const day of itinerary.days) {
    if (!day.dayNumber || day.dayNumber < 1) {
      throw new Error(`Invalid day number in planned itinerary: ${day.dayNumber}`);
    }
  }

  // 2. Authorization check: ensure current user owns the trip
  const existingTrip = await getTripByIdForCurrentUser(tripId);
  if (!existingTrip) {
    throw new Error('Trip not found or access is restricted.');
  }

  // 3. Remove previous days and activities for this trip
  // Note: trip_days deletion cascades to trip_activities in PostgreSQL.
  // Explicitly deleting activities first ensures compatibility regardless of foreign key configuration.
  const existingDays = await getTripDaysForCurrentUser(tripId);
  for (const day of existingDays) {
    try {
      const existingActs = await getActivitiesForTripDay(day.id);
      for (const act of existingActs) {
        await deleteTripActivity(act.id);
      }
    } catch {
      // Continue to delete the day if activities are already removed
    }
    await deleteTripDay(day.id);
  }

  // 4. Persist new days and activities with compensation cleanup on failure
  const createdDayIds: string[] = [];

  try {
    for (const day of itinerary.days) {
      const createdDay = await createTripDay(tripId, {
        day_number: day.dayNumber,
        title: day.title,
        estimated_cost: day.estimatedCost,
        total_distance_km: day.totalDistanceKm,
        estimated_travel_minutes: day.estimatedTravelMinutes,
      });

      createdDayIds.push(createdDay.id);

      for (const activity of day.activities) {
        await createTripActivity(createdDay.id, {
          place_id: activity.placeId,
          title: activity.title || 'Activity',
          activity_type: activity.activityType || 'visit',
          start_time: activity.startTime,
          end_time: activity.endTime,
          duration_minutes: activity.durationMinutes,
          order_index: activity.orderIndex,
          estimated_cost: activity.estimatedCost,
          transportation: activity.transportation,
          travel_minutes: activity.travelMinutes,
          distance_km: activity.distanceKm,
          notes: activity.notes,
          is_ai_generated: activity.isAiGenerated ?? false,
        });
      }
    }

    // 5. Update parent trip header - preserve existing user custom title and budget if present
    await updateTrip(tripId, {
      title: existingTrip.title?.trim() || itinerary.tripTitle,
      days_count: itinerary.daysCount,
      budget: existingTrip.budget ?? itinerary.totalEstimatedCost,
      status: 'planned',
    });
  } catch (error) {
    // Compensation cleanup: attempt to delete any newly created days if insertion failed midway
    for (const dayId of createdDayIds) {
      try {
        await deleteTripDay(dayId);
      } catch {
        // Ignore secondary error during emergency cleanup
      }
    }
    throw error;
  }
}
