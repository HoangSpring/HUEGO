import { supabase } from '../supabase/client';
import type { TripActivityRow } from '../../types/database';

export async function getActivitiesForTripDay(tripDayId: string): Promise<TripActivityRow[]> {
  const { data, error } = await supabase
    .from('trip_activities')
    .select('*')
    .eq('trip_day_id', tripDayId)
    .order('order_index', { ascending: true, nullsFirst: true });

  if (error) {
    throw error;
  }

  return (data ?? []) as TripActivityRow[];
}

export async function createTripActivity(tripDayId: string, input: Partial<TripActivityRow>): Promise<TripActivityRow> {
  const payload = {
    trip_day_id: tripDayId,
    place_id: input.place_id ?? null,
    title: input.title || 'Activity',
    activity_type: input.activity_type || 'visit',
    start_time: input.start_time ?? null,
    end_time: input.end_time ?? null,
    duration_minutes: input.duration_minutes ?? null,
    order_index: input.order_index ?? 1,
    estimated_cost: input.estimated_cost ?? null,
    transportation: input.transportation ?? null,
    travel_minutes: input.travel_minutes ?? null,
    distance_km: input.distance_km ?? null,
    notes: input.notes ?? null,
    is_ai_generated: input.is_ai_generated ?? false,
  };

  const { data, error } = await supabase.from('trip_activities').insert(payload).select().single();

  if (error) {
    throw error;
  }

  return data as TripActivityRow;
}

export async function updateTripActivity(activityId: string, updates: Partial<TripActivityRow>): Promise<TripActivityRow> {
  const { data, error } = await supabase
    .from('trip_activities')
    .update(updates)
    .eq('id', activityId)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data as TripActivityRow;
}

export async function deleteTripActivity(activityId: string): Promise<void> {
  const { error } = await supabase.from('trip_activities').delete().eq('id', activityId);

  if (error) {
    throw error;
  }
}
