import { supabase } from '../supabase/client';
import type { TripDayRow } from '../../types/database';
import { getTripByIdForCurrentUser } from './tripService';

export async function getTripDaysForCurrentUser(tripId: string): Promise<TripDayRow[]> {
  const trip = await getTripByIdForCurrentUser(tripId);

  if (!trip) {
    return [];
  }

  const { data, error } = await supabase
    .from('trip_days')
    .select('*')
    .eq('trip_id', tripId)
    .order('day_number', { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []) as TripDayRow[];
}

export async function createTripDay(tripId: string, input: Partial<TripDayRow>): Promise<TripDayRow> {
  await getTripByIdForCurrentUser(tripId);

  const payload = {
    trip_id: tripId,
    day_number: input.day_number ?? 1,
    date: input.date ?? null,
    title: input.title ?? 'Day 1',
    estimated_cost: input.estimated_cost ?? null,
    total_distance_km: input.total_distance_km ?? null,
    estimated_travel_minutes: input.estimated_travel_minutes ?? null,
  };

  const { data, error } = await supabase.from('trip_days').insert(payload).select().single();

  if (error) {
    throw error;
  }

  return data as TripDayRow;
}

export async function createTripDaysForTrip(tripId: string, daysCount: number): Promise<TripDayRow[]> {
  await getTripByIdForCurrentUser(tripId);

  const safeDaysCount = Math.max(1, Math.floor(daysCount));
  const payload = Array.from({ length: safeDaysCount }, (_, index) => ({
    trip_id: tripId,
    day_number: index + 1,
    date: null,
    title: `Day ${index + 1}`,
    estimated_cost: null,
    total_distance_km: null,
    estimated_travel_minutes: null,
  }));

  const { data, error } = await supabase
    .from('trip_days')
    .insert(payload)
    .select()
    .order('day_number', { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []) as TripDayRow[];
}

export async function updateTripDay(dayId: string, updates: Partial<TripDayRow>): Promise<TripDayRow> {
  const { data, error } = await supabase
    .from('trip_days')
    .update(updates)
    .eq('id', dayId)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data as TripDayRow;
}

export async function deleteTripDay(dayId: string): Promise<void> {
  const { error } = await supabase.from('trip_days').delete().eq('id', dayId);

  if (error) {
    throw error;
  }
}
