import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/useAuth';
import { Button } from '../../components/ui/Button';
import { ErrorState } from '../../components/common/ErrorState';
import { getPlaces } from '../../services/places/placeService';
import { getTripByIdForCurrentUser } from '../../services/trips/tripService';
import {
  planDeterministicItinerary,
  persistPlannedItinerary,
  type PlannedItinerary,
} from '../../services/trips/itineraryPlanner';
import { generateAItinerary } from '../../services/ai/aiPlanService';
import { isDeterministicFallbackEligible } from '../../services/trips/fallbackPolicy';

function getSupabaseErrorDetails(error: unknown) {
  if (!error || typeof error !== 'object') {
    return { message: String(error), details: '', hint: '', code: '' };
  }

  const supabaseError = error as {
    message?: string;
    details?: string;
    hint?: string;
    code?: string;
  };

  return {
    message: supabaseError.message || 'Unknown error occurred',
    details: supabaseError.details || '',
    hint: supabaseError.hint || '',
    code: supabaseError.code || '',
  };
}

interface StepInfo {
  id: number;
  label: string;
}

const PLANNING_STEPS: StepInfo[] = [
  { id: 1, label: 'Preparing Huế destinations' },
  { id: 2, label: 'Creating itinerary' },
  { id: 3, label: 'Optimizing route' },
  { id: 4, label: 'Calculating cost & saving itinerary' },
];

export function AIGeneratingPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { user, loading: authLoading } = useAuth();

  const tripIdFromUrl = searchParams.get('tripId');
  const tripIdFromState = (location.state as { tripId?: string } | null)?.tripId;
  const tripId = tripIdFromUrl || tripIdFromState || null;

  const [currentStep, setCurrentStep] = useState<number>(1);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [error, setError] = useState<{ title: string; message: string } | null>(null);

  const isMountedRef = useRef<boolean>(true);
  const inProgressRef = useRef<boolean>(false);
  const [retryCount, setRetryCount] = useState<number>(0);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (authLoading || !tripId || !user) {
      return;
    }

    let isSubscribed = true;

    const execute = async () => {
      if (inProgressRef.current) {
        return;
      }

      inProgressRef.current = true;

      try {
        // 1. Fetch trip configuration from Supabase
        const trip = await getTripByIdForCurrentUser(tripId);
        if (!isSubscribed) return;

        setIsRunning(true);
        setError(null);
        setCurrentStep(1);

        if (!trip) {
          setError({
            title: 'Trip Not Found',
            message: 'The requested trip could not be found or access is restricted.',
          });
          return;
        }

        // Fetch active destinations from Supabase
        const places = await getPlaces();
        if (!isSubscribed) return;

        if (!places || places.length === 0) {
          setError({
            title: 'No Destinations Available',
            message: 'No active destinations were found in Huế to generate an itinerary.',
          });
          return;
        }

        // 2. Generating itinerary (AI with deterministic fallback)
        setCurrentStep(2);
        await new Promise((resolve) => setTimeout(resolve, 250));
        if (!isSubscribed) return;

        let plannedItinerary: PlannedItinerary | null = null;
        let fallbackUsed = false;
        let fallbackReason: string | undefined = undefined;

        try {
          const aiResult = await generateAItinerary({
            tripId: trip.id,
            preferences: {
              durationDays: trip.days_count || 1,
              budget: trip.budget,
              peopleCount: trip.people_count,
              companionType: trip.companion_type,
              transportation: trip.transportation,
              travelStyle: 'balanced',
              language: 'vi',
            },
          });

          if (aiResult.success) {
            plannedItinerary = aiResult.itinerary;
          } else {
            // Strictly check whether this failure is an approved recoverable provider failure
            if (isDeterministicFallbackEligible(aiResult.code)) {
              console.warn(
                `AI plan requires deterministic recovery (${aiResult.code}: ${aiResult.error}).`
              );
              fallbackUsed = true;
              fallbackReason = aiResult.error;
            } else {
              // Non-recoverable failure: Auth, Forbidden, Invalid Request, or Grounding Violation
              console.error(`AI planning non-recoverable error (${aiResult.code}):`, aiResult.error);
              let errorTitle = 'Planning Failed';
              if (aiResult.code === 'UNAUTHORIZED') errorTitle = 'Authentication Required';
              else if (aiResult.code === 'FORBIDDEN') errorTitle = 'Access Denied';
              else if (aiResult.code === 'INVALID_REQUEST' || aiResult.code === 'PAYLOAD_TOO_LARGE') errorTitle = 'Invalid Trip Request';
              else if (aiResult.code === 'NO_PLACES' || aiResult.code === 'INSUFFICIENT_PLACES') errorTitle = 'No Destinations Available';
              else if (aiResult.code === 'UNKNOWN_PLACE_ID' || aiResult.code === 'DAY_COUNT_MISMATCH' || aiResult.code === 'INVALID_TIME_ORDER') {
                errorTitle = 'Itinerary Validation Failed';
              }

              setError({
                title: errorTitle,
                message: aiResult.error || 'Failed to generate itinerary.',
              });
              return;
            }
          }
        } catch {
          console.error('AI generation service failed before returning a classified result.');
          setError({
            title: 'AI Planning Failed',
            message: 'The itinerary service could not complete the request. Please retry.',
          });
          return;
        }

        // Fallback to deterministic planner if AI generation was unavailable or failed
        if (!plannedItinerary) {
          const fallbackResult = planDeterministicItinerary(
            {
              daysCount: trip.days_count || 1,
              budget: trip.budget,
              peopleCount: trip.people_count,
              companionType: trip.companion_type,
              transportation: trip.transportation,
            },
            places
          );

          if (!fallbackResult.success) {
            setError({
              title: fallbackResult.code === 'BUDGET_TOO_LOW' ? 'Budget Too Low' : 'Planning Failed',
              message: fallbackResult.error,
            });
            return;
          }

          plannedItinerary = fallbackResult.itinerary;
        }

        // 3. Optimizing route
        setCurrentStep(3);
        await new Promise((resolve) => setTimeout(resolve, 250));
        if (!isSubscribed) return;

        // 4. Calculating cost & saving itinerary
        setCurrentStep(4);
        await persistPlannedItinerary(trip.id, plannedItinerary);
        if (!isSubscribed) return;

        // Navigate to Trip Result only after successful persistence
        navigate(`/trip/${trip.id}`, {
          replace: true,
          state: {
            fallbackUsed,
            fallbackReason,
          },
        });
      } catch (plannerError) {
        if (!isSubscribed) return;
        console.error('Error during itinerary generation:', plannerError);
        const details = getSupabaseErrorDetails(plannerError);
        setError({
          title: 'Failed to Save Itinerary',
          message: details.message || 'An error occurred while persisting your itinerary. Please try again.',
        });
      } finally {
        if (isSubscribed) {
          setIsRunning(false);
        }
        inProgressRef.current = false;
      }
    };

    void execute();

    return () => {
      isSubscribed = false;
    };
  }, [authLoading, tripId, user, retryCount, navigate]);

  const handleRetry = () => {
    inProgressRef.current = false;
    setRetryCount((prev) => prev + 1);
  };

  // State: Missing Trip ID
  if (!tripId) {
    return (
      <div className="page ai-generating-page">
        <section className="section stack stack--lg" style={{ maxWidth: '36rem', margin: '0 auto' }}>
          <ErrorState
            title="Missing Trip ID"
            message="No trip ID was provided for itinerary planning. Please start by configuring your trip."
          />
          <div className="inline-actions" style={{ justifyContent: 'center' }}>
            <Button variant="primary" onClick={() => navigate('/plan')}>
              Go to Plan Trip
            </Button>
          </div>
        </section>
      </div>
    );
  }

  // State: Not Authenticated
  if (!authLoading && !user) {
    return (
      <div className="page ai-generating-page">
        <section className="section stack stack--lg" style={{ maxWidth: '36rem', margin: '0 auto' }}>
          <ErrorState
            title="Authentication Required"
            message="You must be signed in to generate an itinerary."
          />
          <div className="inline-actions" style={{ justifyContent: 'center' }}>
            <Button variant="primary" onClick={() => navigate('/auth')}>
              Sign In
            </Button>
          </div>
        </section>
      </div>
    );
  }

  // State: Error
  if (error) {
    return (
      <div className="page ai-generating-page">
        <section className="section stack stack--lg" style={{ maxWidth: '36rem', margin: '0 auto' }}>
          <ErrorState
            title={error.title}
            message={error.message}
            onRetry={handleRetry}
          />
          <div className="inline-actions" style={{ justifyContent: 'center' }}>
            <Button variant="outline" onClick={() => navigate('/plan')}>
              Back to Plan Trip
            </Button>
          </div>
        </section>
      </div>
    );
  }

  // State: In Progress / Generating
  return (
    <div className="page ai-generating-page">
      <section className="section stack stack--lg" style={{ maxWidth: '36rem', margin: '0 auto' }}>
        <div>
          <div className="eyebrow">Itinerary Generator</div>
          <h1 className="page-heading">Planning Your Huế Itinerary</h1>
          <p className="page-subtitle">
            Creating a personalized itinerary using verified Huế destinations and your preferences.
          </p>
        </div>

        <div className="card form-card stack stack--md" style={{ textAlign: 'center', padding: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem' }}>
            <div
              style={{
                width: '3rem',
                height: '3rem',
                borderRadius: '50%',
                border: '3px solid rgba(28, 107, 93, 0.2)',
                borderTopColor: 'var(--color-primary)',
                animation: 'spin 0.8s linear infinite',
              }}
              aria-hidden="true"
            />
          </div>

          <div
            className="progress-steps stack stack--sm"
            style={{ textAlign: 'left', maxWidth: '24rem', margin: '0 auto', width: '100%' }}
          >
            {PLANNING_STEPS.map((step) => {
              const isDone = currentStep > step.id;
              const isCurrent = currentStep === step.id;

              return (
                <div
                  key={step.id}
                  className="step"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    padding: '0.5rem 0.75rem',
                    borderRadius: 'var(--radius-md)',
                    background: isCurrent ? 'rgba(28, 107, 93, 0.08)' : 'transparent',
                    fontWeight: isCurrent ? 'bold' : 'normal',
                    color: isDone
                      ? 'var(--color-primary)'
                      : isCurrent
                        ? 'var(--color-text-primary)'
                        : 'var(--color-text-secondary)',
                  }}
                >
                  <span className="step-icon" style={{ width: '1.5rem', textAlign: 'center' }}>
                    {isDone ? '✓' : isCurrent ? '●' : '○'}
                  </span>
                  <span className="step-label">{step.label}</span>
                </div>
              );
            })}
          </div>

          <p className="muted" style={{ marginTop: '1.5rem', fontSize: '0.875rem' }}>
            {isRunning
              ? 'Please wait while we calculate the best routes and schedule for your visit...'
              : 'Finishing up...'}
          </p>
        </div>
      </section>
    </div>
  );
}
