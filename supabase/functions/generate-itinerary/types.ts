/**
 * HUEGO — Edge Function: generate-itinerary
 * Shared domain and contract types for server-side AI planning and grounding.
 */

export type CompanionType = 'solo' | 'couple' | 'family' | 'friends' | 'other';
export type Transportation = 'walking' | 'motorbike' | 'car' | 'taxi' | 'cyclo' | 'mixed';
export type TravelStyle = 'relaxed' | 'balanced' | 'packed';
export type Language = 'vi' | 'en';

export interface TripPlanningPreferences {
  durationDays: number;
  budget?: number | null;
  peopleCount?: number | null;
  companionType?: CompanionType | null;
  transportation?: Transportation | null;
  interests?: string[];
  travelStyle?: TravelStyle;
  specialConstraints?: string | null;
  startLocation?: {
    latitude: number;
    longitude: number;
    label?: string;
  } | null;
  language?: Language;
}

export interface GenerateItineraryRequest {
  tripId?: string;
  preferences: TripPlanningPreferences;
}

export interface CandidatePlaceSummary {
  id: string;
  categoryId: string | null;
  categoryName: string;
  nameVi: string;
  nameEn: string;
  slug: string | null;
  address: string | null;
  shortDescription: string;
  latitude: number | null;
  longitude: number | null;
  openingTime: string | null;
  closingTime: string | null;
  durationMinutes: number;
  priceMin: number | null;
  priceMax: number | null;
  rating: number | null;
  isVerified: boolean;
}

export interface RawLLMActivity {
  placeId: string;
  activityType?: string;
  title?: string;
  startTime?: string;
  endTime?: string;
  durationMinutes?: number;
  notes?: string;
  localTip?: string;
}

export interface RawLLMDay {
  dayNumber: number;
  title?: string;
  theme?: string;
  activities: RawLLMActivity[];
}

export interface RawLLMItineraryOutput {
  tripTitle?: string;
  days: RawLLMDay[];
  notes?: string;
}

export interface ValidatedPlannedActivity {
  placeId: string;
  title: string;
  activityType: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  orderIndex: number;
  estimatedCost: number | null;
  transportation: string | null;
  travelMinutes: number | null;
  distanceKm: number | null;
  notes: string | null;
  localTip: string | null;
  isAiGenerated: boolean;
}

export interface ValidatedPlannedDay {
  dayNumber: number;
  title: string;
  theme?: string;
  estimatedCost: number | null;
  totalDistanceKm: number | null;
  estimatedTravelMinutes: number | null;
  activities: ValidatedPlannedActivity[];
}

export interface ValidatedPlannedItinerary {
  tripTitle: string;
  daysCount: number;
  totalEstimatedCost: number | null;
  totalDistanceKm: number | null;
  estimatedTravelMinutes: number | null;
  days: ValidatedPlannedDay[];
  warnings: string[];
}

export interface GenerateItineraryResponse {
  success: true;
  itinerary: ValidatedPlannedItinerary;
  metadata: {
    provider: string;
    groundedPlaceCount: number;
    generatedAt: string;
  };
}

export type ErrorCode =
  | 'METHOD_NOT_ALLOWED'
  | 'PAYLOAD_TOO_LARGE'
  | 'INVALID_JSON'
  | 'INVALID_REQUEST'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'BUDGET_EXCEEDED'
  | 'NO_PLACES'
  | 'INSUFFICIENT_PLACES'
  | 'PROVIDER_ERROR'
  | 'PROVIDER_NOT_CONFIGURED'
  | 'PROVIDER_TIMEOUT'
  | 'PROVIDER_RATE_LIMIT'
  | 'VALIDATION_FAILED'
  | 'UNKNOWN_PLACE_ID'
  | 'DAY_COUNT_MISMATCH'
  | 'INVALID_TIME_ORDER'
  | 'INVALID_ACTIVITY_ORDER'
  | 'INVALID_OUTPUT_FORMAT'
  | 'MISSING_ACTIVITIES'
  | 'INTERNAL_ERROR';

export interface GenerateItineraryErrorResponse {
  success: false;
  error: {
    code: ErrorCode;
    message: string;
    details?: string;
  };
}

export interface AuthenticatedUser {
  id: string;
  email?: string;
}
