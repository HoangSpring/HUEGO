/**
 * HUEGO — AI Itinerary Planning Client Service
 * Invokes the secure Supabase Edge Function `generate-itinerary` and maps the validated
 * result to the client-side PlannedItinerary structure for persistence and UI rendering.
 */

import { supabase } from '../supabase/client';
import type { PlannedItinerary } from '../trips/itineraryPlanner';

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

export interface GenerateAItineraryParams {
  tripId?: string;
  preferences: TripPlanningPreferences;
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

export interface GenerateItineraryErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: string;
  };
}

export interface GenerateAItinerarySuccess {
  success: true;
  itinerary: PlannedItinerary;
  metadata: {
    provider: string;
    groundedPlaceCount: number;
    generatedAt: string;
  };
}

export interface GenerateAItineraryFailure {
  success: false;
  error: string;
  code: string;
  details?: string;
}

export type GenerateAItineraryResult = GenerateAItinerarySuccess | GenerateAItineraryFailure;

/**
 * Maps the server-validated itinerary output to the client's PlannedItinerary schema.
 * Explicitly preserves `isAiGenerated: true` for all activities.
 */
export function mapValidatedItineraryToPlannedItinerary(
  validated: ValidatedPlannedItinerary
): PlannedItinerary {
  return {
    tripTitle: validated.tripTitle,
    daysCount: validated.daysCount,
    totalEstimatedCost: validated.totalEstimatedCost,
    totalDistanceKm: validated.totalDistanceKm,
    days: validated.days.map((day) => ({
      dayNumber: day.dayNumber,
      title: day.title,
      estimatedCost: day.estimatedCost,
      totalDistanceKm: day.totalDistanceKm,
      estimatedTravelMinutes: day.estimatedTravelMinutes,
      activities: day.activities.map((act) => {
        let notes = act.notes;
        if (act.localTip) {
          notes = notes ? `${notes}\n\nTip: ${act.localTip}` : `Tip: ${act.localTip}`;
        }
        return {
          placeId: act.placeId,
          title: act.title,
          activityType: act.activityType,
          startTime: act.startTime,
          endTime: act.endTime,
          durationMinutes: act.durationMinutes,
          orderIndex: act.orderIndex,
          estimatedCost: act.estimatedCost,
          transportation: act.transportation,
          travelMinutes: act.travelMinutes,
          distanceKm: act.distanceKm,
          notes,
          isAiGenerated: true,
        };
      }),
    })),
    warnings: validated.warnings || [],
  };
}

/**
 * Invokes the server-side generate-itinerary edge function with authenticated caller credentials.
 */
export async function generateAItinerary(
  params: GenerateAItineraryParams
): Promise<GenerateAItineraryResult> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    return {
      success: false,
      error: 'You must be signed in to generate an itinerary.',
      code: 'UNAUTHORIZED',
    };
  }

  try {
    const { data, error } = await supabase.functions.invoke<GenerateItineraryResponse>(
      'generate-itinerary',
      {
        body: params,
      }
    );

    if (error) {
      let code = 'PROVIDER_ERROR';
      let message = error.message || 'AI itinerary generation failed.';

      // Attempt to inspect response payload if available in error context
      try {
        if ('context' in error && error.context) {
          const res = error.context as Response;
          if (typeof res.json === 'function') {
            const errJson = (await res.json()) as GenerateItineraryErrorResponse;
            if (errJson?.error) {
              code = errJson.error.code || code;
              message = errJson.error.message || message;
            }
          }
        }
      } catch {
        // Fall back to top-level error message
      }

      return {
        success: false,
        error: message,
        code,
      };
    }

    if (!data || !data.success || !data.itinerary) {
      return {
        success: false,
        error: 'Invalid or incomplete response from itinerary generation service.',
        code: 'INVALID_OUTPUT_FORMAT',
      };
    }

    const planned = mapValidatedItineraryToPlannedItinerary(data.itinerary);

    return {
      success: true,
      itinerary: planned,
      metadata: data.metadata,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      error: message || 'Failed to communicate with AI itinerary service.',
      code: 'PROVIDER_ERROR',
    };
  }
}
