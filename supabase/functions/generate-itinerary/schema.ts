/**
 * HUEGO — Edge Function: Request Schema Validation
 * Validates request payloads strictly using Zod schemas aligned with domain types.
 */

import { z } from 'npm:zod';

export const CompanionTypeSchema = z.enum(['solo', 'couple', 'family', 'friends', 'other']);
export const TransportationSchema = z.enum(['walking', 'motorbike', 'car', 'taxi', 'cyclo', 'mixed']);
export const TravelStyleSchema = z.enum(['relaxed', 'balanced', 'packed']);
export const LanguageSchema = z.enum(['vi', 'en']);

export const StartLocationSchema = z.object({
  latitude: z.number().min(-90, 'startLocation.latitude must be between -90 and 90.').max(90, 'startLocation.latitude must be between -90 and 90.'),
  longitude: z.number().min(-180, 'startLocation.longitude must be between -180 and 180.').max(180, 'startLocation.longitude must be between -180 and 180.'),
  label: z.string().trim().max(100, 'startLocation.label must be at most 100 characters.').optional(),
});

export const TripPlanningPreferencesSchema = z.object({
  durationDays: z
    .number({
      required_error: 'preferences.durationDays is required.',
      invalid_type_error: 'preferences.durationDays must be a number.',
    })
    .int('preferences.durationDays must be an integer between 1 and 30.')
    .min(1, 'preferences.durationDays must be an integer between 1 and 30.')
    .max(30, 'preferences.durationDays must be an integer between 1 and 30.'),

  budget: z
    .number({ invalid_type_error: 'preferences.budget must be a non-negative number.' })
    .nonnegative('preferences.budget must be a non-negative number.')
    .max(10_000_000_000, 'preferences.budget exceeds supported limit.')
    .nullable()
    .optional(),

  peopleCount: z
    .number({ invalid_type_error: 'preferences.peopleCount must be an integer between 1 and 100.' })
    .int('preferences.peopleCount must be an integer between 1 and 100.')
    .min(1, 'preferences.peopleCount must be an integer between 1 and 100.')
    .max(100, 'preferences.peopleCount must be an integer between 1 and 100.')
    .nullable()
    .optional(),

  companionType: CompanionTypeSchema.nullable().optional(),
  transportation: TransportationSchema.nullable().optional(),

  interests: z
    .array(
      z.string({ invalid_type_error: 'All items in preferences.interests must be strings.' })
        .trim()
        .max(50, 'Each interest item must be at most 50 characters.')
    )
    .max(10, 'preferences.interests cannot exceed 10 items.')
    .optional(),

  travelStyle: TravelStyleSchema.optional().default('balanced'),

  specialConstraints: z
    .string({ invalid_type_error: 'preferences.specialConstraints must be a string.' })
    .trim()
    .max(500, 'preferences.specialConstraints cannot exceed 500 characters.')
    .nullable()
    .optional(),

  startLocation: StartLocationSchema.nullable().optional(),
  language: LanguageSchema.optional().default('vi'),
});

export const GenerateItineraryRequestSchema = z.object({
  tripId: z
    .string({ invalid_type_error: 'tripId must be a string.' })
    .trim()
    .min(1, 'tripId must be between 1 and 100 characters.')
    .max(100, 'tripId must be between 1 and 100 characters.')
    .optional(),
  preferences: TripPlanningPreferencesSchema,
});

export type ValidatedGenerateItineraryRequest = z.infer<typeof GenerateItineraryRequestSchema>;

export type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; field?: string };

/**
 * Validates raw request payload using Zod schema.
 * Reconciles Zod errors into a clear, unified field-level message.
 */
export function validateGenerateItineraryRequest(raw: unknown): ValidationResult<ValidatedGenerateItineraryRequest> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { success: false, error: 'Request body must be a JSON object.' };
  }

  const result = GenerateItineraryRequestSchema.safeParse(raw);

  if (!result.success) {
    const firstIssue = result.error.issues[0];
    const fieldPath = firstIssue.path.join('.');
    return {
      success: false,
      error: firstIssue.message || 'Validation failed for request body.',
      field: fieldPath || undefined,
    };
  }

  return {
    success: true,
    data: result.data,
  };
}
