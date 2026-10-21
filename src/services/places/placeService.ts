import { supabase } from '../supabase/client';
import type { PlaceCategoryRow, PlaceImageRow, PlaceRow, TagRow } from '../../types/database';

export async function getPlaces(): Promise<PlaceRow[]> {
  const { data, error } = await supabase
    .from('places')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []) as PlaceRow[];
}

export async function getPlaceById(placeId: string): Promise<PlaceRow | null> {
  const { data, error } = await supabase
    .from('places')
    .select('*')
    .eq('id', placeId)
    .eq('is_active', true)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data as PlaceRow | null) ?? null;
}

export async function getPlacesByIds(placeIds: string[]): Promise<PlaceRow[]> {
  if (!placeIds.length) {
    return [];
  }

  const { data, error } = await supabase
    .from('places')
    .select('*')
    .in('id', placeIds)
    .eq('is_active', true);

  if (error) {
    throw error;
  }

  return (data ?? []) as PlaceRow[];
}

export async function getPlaceImages(placeId: string): Promise<PlaceImageRow[]> {
  const { data, error } = await supabase
    .from('place_images')
    .select('*')
    .eq('place_id', placeId)
    .order('sort_order', { ascending: true, nullsFirst: false });

  if (error) {
    throw error;
  }

  return (data ?? []) as PlaceImageRow[];
}

export async function getPlaceCategory(categoryId: string | null): Promise<PlaceCategoryRow | null> {
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

  return (data as PlaceCategoryRow | null) ?? null;
}

export async function getPlaceCategories(): Promise<PlaceCategoryRow[]> {
  const { data, error } = await supabase
    .from('place_categories')
    .select('*')
    .order('name_en', { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []) as PlaceCategoryRow[];
}

export async function getPlaceTags(placeId: string): Promise<TagRow[]> {
  const { data, error } = await supabase
    .from('place_tags')
    .select('tag_id, tags(*)')
    .eq('place_id', placeId);

  if (error) {
    throw error;
  }

  return ((data ?? []) as Array<{ tags: TagRow | TagRow[] }>).flatMap(({ tags }) => Array.isArray(tags) ? tags : [tags]);
}
