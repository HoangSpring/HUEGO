import { getActivitiesForTripDay } from '../trips/tripActivityService';
import { getTripDaysForCurrentUser } from '../trips/tripDayService';
import { getTripByIdForCurrentUser } from '../trips/tripService';

export async function loadTripWithDetails(tripId: string) {
  const trip = await getTripByIdForCurrentUser(tripId);

  if (!trip) {
    return { trip: null, days: [], activities: {} };
  }

  const days = await getTripDaysForCurrentUser(tripId);
  const activities: Record<string, unknown[]> = {};

  for (const day of days) {
    activities[day.id] = await getActivitiesForTripDay(day.id);
  }

  return { trip, days, activities };
}
