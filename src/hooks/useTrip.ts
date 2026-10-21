import { useEffect, useState } from 'react';
import { getTripByIdForCurrentUser } from '../services/trips/tripService';
import { getTripDaysForCurrentUser } from '../services/trips/tripDayService';
import { getActivitiesForTripDay } from '../services/trips/tripActivityService';
import { getPlaceImages, getPlacesByIds } from '../services/places/placeService';
import type { PlaceImageRow, PlaceRow, TripActivityRow, TripDayRow, TripRow } from '../types/database';

export function useTrip(tripId: string | undefined) {
  const [trip, setTrip] = useState<TripRow | null>(null);
  const [days, setDays] = useState<TripDayRow[]>([]);
  const [activities, setActivities] = useState<Record<string, TripActivityRow[]>>({});
  const [places, setPlaces] = useState<PlaceRow[]>([]);
  const [images, setImages] = useState<Record<string, PlaceImageRow[]>>({});
  const [loading, setLoading] = useState(Boolean(tripId));
  const [error, setError] = useState<string | null>(null);
  const [reloadIndex, setReloadIndex] = useState(0);

  useEffect(() => {
    if (!tripId) {
      return;
    }

    const loadTrip = async () => {
      setLoading(true);
      setError(null);

      try {
        const nextTrip = await getTripByIdForCurrentUser(tripId);
        setTrip(nextTrip);

        if (!nextTrip) {
          setDays([]);
          setActivities({});
          setPlaces([]);
          setImages({});
          return;
        }

        const nextDays = await getTripDaysForCurrentUser(tripId);
        setDays(nextDays);

        const nextActivitiesMap: Record<string, TripActivityRow[]> = {};
        const allPlaceIds = new Set<string>();

        for (const day of nextDays) {
          const nextActivities = await getActivitiesForTripDay(day.id);
          nextActivitiesMap[day.id] = nextActivities;
          nextActivities.forEach((activity) => {
            if (activity.place_id) {
              allPlaceIds.add(activity.place_id);
            }
          });
        }

        setActivities(nextActivitiesMap);

        const nextPlaces = await getPlacesByIds(Array.from(allPlaceIds));
        setPlaces(nextPlaces);

        const imageEntries = await Promise.all(
          nextPlaces.map(async (place) => [place.id, await getPlaceImages(place.id)] as const)
        );
        setImages(Object.fromEntries(imageEntries));
      } catch (loadError) {
        console.error('Failed to load trip:', loadError);
        setError('Unable to load this trip. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    void loadTrip();
  }, [tripId, reloadIndex]);

  const reload = () => {
    setReloadIndex((prev) => prev + 1);
  };

  return {
    trip: tripId ? trip : null,
    days: tripId ? days : [],
    activities: tripId ? activities : {},
    places: tripId ? places : [],
    images: tripId ? images : {},
    loading: tripId ? loading : false,
    error,
    reload,
  };
}
