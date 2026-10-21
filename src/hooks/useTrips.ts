import { useEffect, useState } from 'react';
import { getTripsForCurrentUser } from '../services/trips/tripService';
import type { TripRow } from '../types/database';

export function useTrips() {
  const [trips, setTrips] = useState<TripRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadTrips = async () => {
    setLoading(true);
    setError(null);

    try {
      const nextTrips = await getTripsForCurrentUser();
      setTrips(nextTrips);
    } catch (loadError) {
      console.error('Failed to load trips:', loadError);
      setError('Unable to load your trips right now. Please try again.');
      setTrips([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const loadTripsAsync = async () => {
      await loadTrips();
    };

    void loadTripsAsync();
  }, []);

  return { trips, loading, error, reload: loadTrips };
}
