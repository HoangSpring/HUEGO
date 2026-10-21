import { supabase } from '../supabase/client';
import type { FavoriteRow } from '../../types/database';

async function getCurrentUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();

  if (error) {
    throw error;
  }

  if (!data.user) {
    throw new Error('Authentication required to manage favorites.');
  }

  return data.user.id;
}

export async function getFavoriteForPlace(placeId: string): Promise<FavoriteRow | null> {
  const userId = await getCurrentUserId();
  const { data, error } = await supabase
    .from('favorites')
    .select('*')
    .eq('user_id', userId)
    .eq('place_id', placeId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data as FavoriteRow | null) ?? null;
}

export async function setFavorite(placeId: string, favorite: boolean): Promise<void> {
  const userId = await getCurrentUserId();

  if (favorite) {
    const { error } = await supabase
      .from('favorites')
      .upsert({ user_id: userId, place_id: placeId }, { onConflict: 'user_id,place_id' });

    if (error) {
      throw error;
    }

    return;
  }

  const { error } = await supabase
    .from('favorites')
    .delete()
    .eq('user_id', userId)
    .eq('place_id', placeId);

  if (error) {
    throw error;
  }
}
