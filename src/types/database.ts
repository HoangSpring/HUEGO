export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];
export type CompanionType = 'solo' | 'couple' | 'family' | 'friends' | 'other';
export type Transportation = 'walking' | 'motorbike' | 'car' | 'taxi' | 'cyclo' | 'mixed';

export interface ProfileRow {
  id: string;
  display_name: string | null;
  preferred_language: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface PlaceCategoryRow {
  id: string;
  name_vi: string | null;
  name_en: string | null;
  slug: string | null;
  created_at: string | null;
}

export interface PlaceRow {
  id: string;
  category_id: string | null;
  name_vi: string | null;
  name_en: string | null;
  slug: string | null;
  description_vi: string | null;
  description_en: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  opening_time: string | null;
  closing_time: string | null;
  duration_minutes: number | null;
  price_min: number | null;
  price_max: number | null;
  rating: number | null;
  review_count: number | null;
  is_verified: boolean | null;
  is_active: boolean | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface PlaceImageRow {
  id: string;
  place_id: string | null;
  storage_path: string | null;
  alt_text_vi: string | null;
  alt_text_en: string | null;
  sort_order: number | null;
  is_cover: boolean | null;
  created_at: string | null;
}

export interface TagRow {
  id: string;
  name_vi: string | null;
  name_en: string | null;
  slug: string | null;
  created_at: string | null;
}

export interface PlaceTagRow {
  id: string;
  place_id: string | null;
  tag_id: string | null;
  created_at: string | null;
}

export interface TripRow {
  id: string;
  user_id: string | null;
  title: string | null;
  start_date: string | null;
  end_date: string | null;
  days_count: number | null;
  budget: number | null;
  people_count: number | null;
  budget_level: string | null;
  companion_type: CompanionType | null;
  transportation: Transportation | null;
  constraints: Json | null;
  notes: string | null;
  status: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export type TripInsert = Partial<Omit<TripRow, 'id' | 'created_at' | 'updated_at' | 'user_id'>> & {
  user_id?: string | null;
  title?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  days_count?: number | null;
  budget?: number | null;
  people_count?: number | null;
  budget_level?: string | null;
  companion_type?: CompanionType | null;
  transportation?: Transportation | null;
  interests?: Json | null;
  constraints?: Json | null;
  notes?: string | null;
  status?: string | null;
};

export type TripUpdate = Partial<TripInsert>;

export interface TripDayRow {
  id: string;
  trip_id: string | null;
  day_number: number | null;
  date: string | null;
  title: string | null;
  estimated_cost: number | null;
  total_distance_km: number | null;
  estimated_travel_minutes: number | null;
}

export type TripDayInsert = Partial<Omit<TripDayRow, 'id'>> & {
  trip_id: string;
  day_number: number;
};

export type TripDayUpdate = Partial<TripDayInsert>;

export interface TripActivityRow {
  id: string;
  trip_day_id: string | null;
  place_id: string | null;
  title: string;
  activity_type: string;
  start_time: string | null;
  end_time: string | null;
  duration_minutes: number | null;
  order_index: number | null;
  estimated_cost: number | null;
  transportation: string | null;
  travel_minutes: number | null;
  distance_km: number | null;
  notes: string | null;
  is_ai_generated: boolean | null;
}

export type TripActivityInsert = Partial<Omit<TripActivityRow, 'id'>> & {
  trip_day_id: string;
  title: string;
  activity_type: string;
};

export type TripActivityUpdate = Partial<TripActivityInsert>;

export interface FavoriteRow {
  id: string;
  user_id: string | null;
  place_id: string | null;
  created_at: string | null;
}

export interface UserPreferenceRow {
  id: string;
  user_id: string | null;
  preferred_language: string | null;
  travel_style: string | null;
  favorite_interests: Json | null;
  created_at: string | null;
  updated_at: string | null;
}
