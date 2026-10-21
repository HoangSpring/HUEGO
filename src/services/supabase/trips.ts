import { supabase } from './client';
import type { TripActivityRow, TripDayRow, TripRow } from '../../types/database';

export async function getTripsForCurrentUser(userId: string) {
  const { data, error } = await supabase
    .from('trips')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  return data as TripRow[];
}

export async function getTripById(tripId: string) {
  const { data, error } = await supabase
    .from('trips')
    .select('*')
    .eq('id', tripId)
    .single();

  if (error) {
    throw error;
  }

  return data as TripRow;
}

export async function getTripDays(tripId: string) {
  const { data, error } = await supabase
    .from('trip_days')
    .select('*')
    .eq('trip_id', tripId)
    .order('day_number', { ascending: true });

  if (error) {
    throw error;
  }

  return data as TripDayRow[];
}

export async function getTripActivities(tripDayId: string) {
  const { data, error } = await supabase
    .from('trip_activities')
    .select('*')
    .eq('trip_day_id', tripDayId)
    .order('order_index', { ascending: true });

  if (error) {
    throw error;
  }

  return data as TripActivityRow[];
}
