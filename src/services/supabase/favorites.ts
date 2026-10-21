import { supabase } from './client';
import type { FavoriteRow } from '../../types/database';

export async function getFavoritesForCurrentUser(userId: string) {
  const { data, error } = await supabase
    .from('favorites')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  return data as FavoriteRow[];
}

export async function addFavorite(placeId: string, userId: string) {
  const { data, error } = await supabase
    .from('favorites')
    .insert({ user_id: userId, place_id: placeId })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data as FavoriteRow;
}

export async function removeFavorite(favoriteId: string) {
  const { error } = await supabase.from('favorites').delete().eq('id', favoriteId);

  if (error) {
    throw error;
  }
}

export async function isPlaceFavorited(placeId: string, userId: string) {
  const { data, error } = await supabase
    .from('favorites')
    .select('id')
    .eq('place_id', placeId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return Boolean(data);
}
