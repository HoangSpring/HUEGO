/**
 * Distance and transit estimation service for HUEGO.
 *
 * Implements the standard Haversine formula to compute great-circle distances
 * between coordinates, and provides realistic transit time estimations tailored
 * for Hue city streets and suburban routes.
 *
 * NOTE: All travel times and distances are heuristic estimates. They do not claim
 * live traffic optimization.
 */

import type { Transportation } from '../../types/database';

/**
 * Calculates the great-circle distance between two GPS coordinates in kilometers.
 * Returns null if any coordinate is missing, null, or out of valid latitude/longitude bounds.
 */
export function calculateDistanceKm(
  lat1: number | null | undefined,
  lon1: number | null | undefined,
  lat2: number | null | undefined,
  lon2: number | null | undefined
): number | null {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) {
    return null;
  }

  // Range validation
  if (lat1 < -90 || lat1 > 90 || lat2 < -90 || lat2 > 90) return null;
  if (lon1 < -180 || lon1 > 180 || lon2 < -180 || lon2 > 180) return null;

  // Exact same point
  if (lat1 === lat2 && lon1 === lon2) {
    return 0;
  }

  const R = 6371; // Earth's mean radius in kilometers
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  // Round to 1 decimal place (100-meter precision)
  return Math.round(distance * 10) / 10;
}

/**
 * Estimates travel duration in minutes based on distance and transportation mode.
 * Speeds are conservative estimates for Hue's urban streets and suburban roads,
 * including a 5-minute fixed buffer for parking and traffic (except for walking).
 */
export function estimateTravelMinutes(
  distanceKm: number | null | undefined,
  transportation?: Transportation | string | null
): number | null {
  if (distanceKm == null || distanceKm < 0) {
    return null;
  }

  if (distanceKm === 0) {
    return 0;
  }

  switch (transportation) {
    case 'walking': {
      // 4.5 km/h average walking pace, minimum 5 minutes
      const mins = Math.round((distanceKm / 4.5) * 60);
      return Math.max(5, mins);
    }
    case 'cyclo': {
      // 10 km/h scenic cyclo pace + 5 min buffer
      const mins = Math.round((distanceKm / 10) * 60) + 5;
      return Math.max(10, mins);
    }
    case 'car':
    case 'taxi': {
      // 30 km/h average car pace in Hue + 5 min buffer
      const mins = Math.round((distanceKm / 30) * 60) + 5;
      return Math.max(5, mins);
    }
    case 'motorbike':
    case 'mixed':
    default: {
      // 25 km/h average motorbike pace + 5 min buffer
      const mins = Math.round((distanceKm / 25) * 60) + 5;
      return Math.max(5, mins);
    }
  }
}

/**
 * Orders a list of places sequentially using a nearest-neighbor heuristic based on GPS coordinates.
 *
 * If coordinates are missing on certain places, those places are safely appended in their
 * original order without failing or claiming geographic optimality.
 */
export function orderPlacesByProximity<T extends { latitude: number | null; longitude: number | null }>(
  places: T[],
  startCoord?: { latitude: number; longitude: number } | null
): T[] {
  if (places.length <= 1) {
    return [...places];
  }

  const remaining = [...places];
  const ordered: T[] = [];

  let currentPoint = startCoord ?? null;

  // If no startCoord was provided, start from the first place that has valid coordinates
  if (!currentPoint) {
    const firstValidIdx = remaining.findIndex((p) => p.latitude != null && p.longitude != null);
    if (firstValidIdx === -1) {
      // None of the places have coordinates; keep original order (documented fallback)
      return remaining;
    }
    const [first] = remaining.splice(firstValidIdx, 1);
    ordered.push(first);
    currentPoint = { latitude: first.latitude!, longitude: first.longitude! };
  }

  while (remaining.length > 0) {
    let nearestIdx = -1;
    let minDistance = Infinity;

    for (let i = 0; i < remaining.length; i++) {
      const place = remaining[i];
      if (place.latitude != null && place.longitude != null && currentPoint) {
        const dist = calculateDistanceKm(
          currentPoint.latitude,
          currentPoint.longitude,
          place.latitude,
          place.longitude
        );
        if (dist != null && dist < minDistance) {
          minDistance = dist;
          nearestIdx = i;
        }
      }
    }

    if (nearestIdx !== -1) {
      const [nearest] = remaining.splice(nearestIdx, 1);
      ordered.push(nearest);
      currentPoint = { latitude: nearest.latitude!, longitude: nearest.longitude! };
    } else {
      // Remaining places do not have valid coordinates; append in original order
      ordered.push(...remaining);
      break;
    }
  }

  return ordered;
}
