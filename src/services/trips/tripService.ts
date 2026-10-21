import { supabase } from '../supabase/client';
import type { TripInsert, TripRow, TripUpdate } from '../../types/database';

export async function getCurrentUserId() {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    throw error;
  }

  if (!user) {
    throw new Error('Authentication required to access trips.');
  }

  return user.id;
}

export async function getTripsForCurrentUser(): Promise<TripRow[]> {
  const userId = await getCurrentUserId();

  const { data, error } = await supabase
    .from('trips')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []) as TripRow[];
}

export async function getTripByIdForCurrentUser(tripId: string): Promise<TripRow | null> {
  const userId = await getCurrentUserId();

  const { data, error } = await supabase
    .from('trips')
    .select('*')
    .eq('id', tripId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data as TripRow | null) ?? null;
}

export async function createTrip(input: TripInsert): Promise<TripRow> {
  const userId = await getCurrentUserId();

  const payload = {
    title: input.title || 'New trip',
    start_date: input.start_date ?? null,
    end_date: input.end_date ?? null,
    days_count: input.days_count ?? 1,
    people_count: input.people_count ?? 1,
    budget: input.budget ?? null,
    budget_level: input.budget_level ?? null,
    companion_type: input.companion_type ?? null,
    transportation: input.transportation ?? null,
    constraints: input.constraints ?? null,
    notes: input.notes ?? null,
    user_id: userId,
    status: input.status ?? 'draft',
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase.from('trips').insert(payload).select().single();

  if (error) {
    throw error;
  }

  return data as TripRow;
}

export async function updateTrip(tripId: string, updates: TripUpdate): Promise<TripRow> {
  const userId = await getCurrentUserId();

  const { data, error } = await supabase
    .from('trips')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', tripId)
    .eq('user_id', userId)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data as TripRow;
}

export async function deleteTrip(tripId: string): Promise<void> {
  const userId = await getCurrentUserId();

  const { error } = await supabase.from('trips').delete().eq('id', tripId).eq('user_id', userId);

  if (error) {
    throw error;
  }
}
