import { supabase } from './client';
import type { PlaceCategoryRow, PlaceImageRow, PlaceRow, TagRow } from '../../types/database';

export async function getPlaces() {
  const { data, error } = await supabase
    .from('places')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  return data as PlaceRow[];
}

export async function getPlaceById(placeId: string) {
  const { data, error } = await supabase
    .from('places')
    .select('*')
    .eq('id', placeId)
    .eq('is_active', true)
    .single();

  if (error) {
    throw error;
  }

  return data as PlaceRow;
}

export async function getPlaceImages(placeId: string) {
  const { data, error } = await supabase
    .from('place_images')
    .select('*')
    .eq('place_id', placeId)
    .order('sort_order', { ascending: true, nullsFirst: false });

  if (error) {
    throw error;
  }

  return data as PlaceImageRow[];
}

export async function getPlaceCategory(categoryId: string | null) {
  if (!categoryId) {
    return null;
  }

  const { data, error } = await supabase
    .from('place_categories')
    .select('*')
    .eq('id', categoryId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as PlaceCategoryRow | null;
}

export async function getPlaceTags(placeId: string) {
  const { data, error } = await supabase
    .from('place_tags')
    .select('tag_id, tags(*)')
    .eq('place_id', placeId);

  if (error) {
    throw error;
  }

  return data as Array<{ tag_id: string; tags: TagRow | TagRow[] }>;
}
