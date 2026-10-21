import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ErrorState } from '../../components/common/ErrorState';
import { LoadingState } from '../../components/common/LoadingState';
import { Button } from '../../components/ui/Button';
import { Field } from '../../components/ui/Field';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { getTripByIdForCurrentUser, updateTrip } from '../../services/trips/tripService';
import { getTripDaysForCurrentUser } from '../../services/trips/tripDayService';
import {
  createTripActivity,
  deleteTripActivity,
  getActivitiesForTripDay,
  updateTripActivity,
} from '../../services/trips/tripActivityService';
import { getPlaces } from '../../services/places/placeService';
import type { CompanionType, PlaceRow, Transportation, TripActivityRow, TripDayRow } from '../../types/database';

export function TripEditPage() {
  const navigate = useNavigate();
  const { tripId } = useParams();

  // Trip settings form state
  const [title, setTitle] = useState('');
  const [durationDays, setDurationDays] = useState(1);
  const [budget, setBudget] = useState('');
  const [companionType, setCompanionType] = useState<CompanionType | ''>('');
  const [transportation, setTransportation] = useState<Transportation | ''>('');
  const [status, setStatus] = useState('draft');

  // Activities & days state
  const [days, setDays] = useState<TripDayRow[]>([]);
  const [activities, setActivities] = useState<Record<string, TripActivityRow[]>>({});
  const [availablePlaces, setAvailablePlaces] = useState<PlaceRow[]>([]);
  const [selectedPlacePerDay, setSelectedPlacePerDay] = useState<Record<string, string>>({});

  // Loading & status states
  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [activityActionLoading, setActivityActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  const [reloadCount, setReloadCount] = useState<number>(0);

  useEffect(() => {
    if (!tripId) {
      return;
    }

    let isSubscribed = true;

    const loadData = async () => {
      try {
        const trip = await getTripByIdForCurrentUser(tripId);
        if (!isSubscribed) return;

        if (!trip) {
          setError('Trip not found or access is restricted.');
          setLoading(false);
          return;
        }

        setTitle(trip.title || '');
        setDurationDays(trip.days_count ?? 1);
        setBudget(trip.budget !== null && trip.budget !== undefined ? String(trip.budget) : '');
        setCompanionType(trip.companion_type || '');
        setTransportation(trip.transportation || '');
        setStatus(trip.status || 'draft');

        const [tripDays, placesList] = await Promise.all([
          getTripDaysForCurrentUser(tripId),
          getPlaces(),
        ]);
        if (!isSubscribed) return;

        setDays(tripDays);
        setAvailablePlaces(placesList);

        const activitiesMap: Record<string, TripActivityRow[]> = {};
        for (const day of tripDays) {
          const dayActs = await getActivitiesForTripDay(day.id);
          activitiesMap[day.id] = dayActs;
        }
        if (!isSubscribed) return;

        setActivities(activitiesMap);
      } catch (loadError) {
        if (!isSubscribed) return;
        console.error('Failed to load trip for editing:', loadError);
        setError('Unable to load this trip. Please try again.');
      } finally {
        if (isSubscribed) {
          setLoading(false);
        }
      }
    };

    void loadData();

    return () => {
      isSubscribed = false;
    };
  }, [tripId, reloadCount]);

  const reloadTripData = () => setReloadCount((c) => c + 1);

  if (!tripId) {
    return (
      <div className="page trip-edit-page">
        <ErrorState title="Unable to edit this trip" message="Trip ID is required." />
      </div>
    );
  }

  // 1. Action: Save Trip Configuration
  const handleSaveSettings = async () => {
    if (!tripId) return;

    if (!durationDays || isNaN(durationDays) || !Number.isInteger(durationDays) || durationDays < 1) {
      setError('Trip duration must be at least 1 day.');
      return;
    }
    if (durationDays > 30) {
      setError('Trip duration cannot exceed 30 days.');
      return;
    }

    let parsedBudget: number | null = null;
    if (budget.trim() !== '') {
      parsedBudget = Number(budget);
      if (isNaN(parsedBudget) || parsedBudget < 0) {
        setError('Budget must be a non-negative number.');
        return;
      }
    }

    setSavingSettings(true);
    setError(null);
    setFeedbackMessage(null);

    try {
      await updateTrip(tripId, {
        title: title.trim() || 'Untitled trip',
        days_count: durationDays,
        budget: parsedBudget,
        companion_type: companionType || null,
        transportation: transportation || null,
        status,
      });

      navigate(`/trip/${tripId}`);
    } catch (saveError) {
      console.error('Failed to save trip settings:', saveError);
      setError('Unable to save trip settings. Please try again.');
    } finally {
      setSavingSettings(false);
    }
  };

  // 2. Action: Re-plan Itinerary
  const handleReplan = async () => {
    if (!tripId) return;

    if (!durationDays || isNaN(durationDays) || !Number.isInteger(durationDays) || durationDays < 1) {
      setError('Trip duration must be at least 1 day.');
      return;
    }

    setSavingSettings(true);
    setError(null);

    try {
      await updateTrip(tripId, {
        title: title.trim() || 'Untitled trip',
        days_count: durationDays,
        budget: budget.trim() ? Number(budget) : null,
        companion_type: companionType || null,
        transportation: transportation || null,
        status: 'draft',
      });

      navigate(`/ai-generating?tripId=${tripId}`, { state: { tripId } });
    } catch (saveError) {
      console.error('Failed to update trip for re-planning:', saveError);
      setError('Unable to update your trip for re-planning. Please try again.');
    } finally {
      setSavingSettings(false);
    }
  };

  // 3. Action: Reorder Activities within a day
  const handleMoveActivity = async (dayId: string, fromIndex: number, toIndex: number) => {
    const dayActs = activities[dayId];
    if (!dayActs || fromIndex < 0 || toIndex < 0 || fromIndex >= dayActs.length || toIndex >= dayActs.length) {
      return;
    }

    setActivityActionLoading(true);
    setError(null);

    try {
      const actA = dayActs[fromIndex];
      const actB = dayActs[toIndex];

      const newOrderA = toIndex + 1;
      const newOrderB = fromIndex + 1;

      await Promise.all([
        updateTripActivity(actA.id, { order_index: newOrderA }),
        updateTripActivity(actB.id, { order_index: newOrderB }),
      ]);

      const reordered = [...dayActs];
      reordered[fromIndex] = { ...actA, order_index: newOrderA };
      reordered[toIndex] = { ...actB, order_index: newOrderB };
      reordered.sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));

      setActivities((prev) => ({ ...prev, [dayId]: reordered }));
      setFeedbackMessage('Activity order updated.');
    } catch (moveErr) {
      console.error('Failed to move activity:', moveErr);
      setError('Failed to update activity order. Reloading...');
      if (tripId) void reloadTripData();
    } finally {
      setActivityActionLoading(false);
    }
  };

  // 4. Action: Change Day of an activity
  const handleMoveToDay = async (activityId: string, sourceDayId: string, targetDayId: string) => {
    if (sourceDayId === targetDayId) return;

    setActivityActionLoading(true);
    setError(null);

    try {
      const targetDayActs = activities[targetDayId] ?? [];
      const newOrderIndex = targetDayActs.length + 1;

      await updateTripActivity(activityId, {
        trip_day_id: targetDayId,
        order_index: newOrderIndex,
      });

      // Re-index remaining activities in source day
      const sourceRemaining = (activities[sourceDayId] ?? []).filter((a) => a.id !== activityId);
      for (let i = 0; i < sourceRemaining.length; i++) {
        await updateTripActivity(sourceRemaining[i].id, { order_index: i + 1 });
        sourceRemaining[i].order_index = i + 1;
      }

      if (tripId) {
        await reloadTripData();
      }
      setFeedbackMessage('Activity moved to new day.');
    } catch (moveErr) {
      console.error('Failed to change day:', moveErr);
      setError('Failed to move activity to another day. Reloading...');
      if (tripId) void reloadTripData();
    } finally {
      setActivityActionLoading(false);
    }
  };

  // 5. Action: Remove Place / Activity
  const handleRemoveActivity = async (activityId: string, dayId: string) => {
    setActivityActionLoading(true);
    setError(null);

    try {
      await deleteTripActivity(activityId);

      // Re-index remaining activities in day
      const remaining = (activities[dayId] ?? []).filter((a) => a.id !== activityId);
      for (let i = 0; i < remaining.length; i++) {
        await updateTripActivity(remaining[i].id, { order_index: i + 1 });
        remaining[i].order_index = i + 1;
      }

      setActivities((prev) => ({ ...prev, [dayId]: remaining }));
      setFeedbackMessage('Activity removed from itinerary.');
    } catch (delErr) {
      console.error('Failed to remove activity:', delErr);
      setError('Failed to remove activity. Reloading...');
      if (tripId) void reloadTripData();
    } finally {
      setActivityActionLoading(false);
    }
  };

  // 6. Action: Add Place to Day
  const handleAddPlaceToDay = async (dayId: string) => {
    const selectedPlaceId = selectedPlacePerDay[dayId];
    if (!selectedPlaceId) return;

    const placeToAdd = availablePlaces.find((p) => p.id === selectedPlaceId);
    if (!placeToAdd) return;

    setActivityActionLoading(true);
    setError(null);

    try {
      const currentDayActs = activities[dayId] ?? [];
      const newOrderIndex = currentDayActs.length + 1;

      const created = await createTripActivity(dayId, {
        place_id: placeToAdd.id,
        title: placeToAdd.name_vi || placeToAdd.name_en || 'Activity',
        activity_type: 'visit',
        order_index: newOrderIndex,
        duration_minutes: placeToAdd.duration_minutes ?? 60,
        estimated_cost: placeToAdd.price_min ?? null,
        is_ai_generated: false,
      });

      setActivities((prev) => ({
        ...prev,
        [dayId]: [...(prev[dayId] ?? []), created],
      }));

      // Reset selection for this day
      setSelectedPlacePerDay((prev) => ({ ...prev, [dayId]: '' }));
      setFeedbackMessage(`Added "${placeToAdd.name_vi || placeToAdd.name_en}" to itinerary.`);
    } catch (addErr) {
      console.error('Failed to add place to day:', addErr);
      setError('Failed to add destination. Reloading...');
      if (tripId) void reloadTripData();
    } finally {
      setActivityActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="page trip-edit-page">
        <LoadingState title="Loading trip" message="Opening your editable details..." />
      </div>
    );
  }

  if (error && !days.length) {
    return (
      <div className="page trip-edit-page">
        <ErrorState title="Unable to edit this trip" message={error} />
      </div>
    );
  }

  return (
    <div className="page trip-edit-page">
      <section className="section stack stack--lg">
        <div className="section-header">
          <div>
            <div className="eyebrow">Trip Editor</div>
            <h1 className="page-heading">Edit / Re-plan Trip</h1>
          </div>
          <Button variant="outline" onClick={() => navigate(`/trip/${tripId}`)}>
            Back to Itinerary
          </Button>
        </div>

        {error && <div className="form-error" role="alert">{error}</div>}
        {feedbackMessage && (
          <div
            style={{
              padding: '0.75rem 1rem',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(28, 107, 93, 0.1)',
              color: 'var(--color-primary)',
              fontWeight: 600,
            }}
          >
            ✓ {feedbackMessage}
          </div>
        )}

        {/* Section 1: Trip Preferences */}
        <div className="card form-card">
          <h2 style={{ marginTop: 0, marginBottom: '1.25rem', fontSize: '1.3rem' }}>Trip Settings</h2>
          <div className="stack stack--lg">
            <Field label="Trip title" htmlFor="trip-title">
              <Input
                id="trip-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="My Huế adventure"
              />
            </Field>

            <div className="grid grid--cols-2">
              <Field label="Duration (days)" htmlFor="duration-days">
                <Input
                  id="duration-days"
                  type="number"
                  min="1"
                  max="30"
                  value={durationDays}
                  onChange={(event) => setDurationDays(Number(event.target.value) || 1)}
                />
              </Field>

              <Field label="Total trip budget (VND)" htmlFor="budget">
                <Input
                  id="budget"
                  type="number"
                  min="0"
                  value={budget}
                  onChange={(event) => setBudget(event.target.value)}
                  placeholder="e.g. 2000000"
                />
              </Field>
            </div>

            <div className="grid grid--cols-2">
              <Field label="Travel companions" htmlFor="companion-type">
                <Select
                  id="companion-type"
                  value={companionType}
                  onChange={(event) => setCompanionType(event.target.value as CompanionType | '')}
                >
                  <option value="">Select companions...</option>
                  <option value="solo">Solo</option>
                  <option value="couple">Couple</option>
                  <option value="family">Family</option>
                  <option value="friends">Friends</option>
                  <option value="other">Other</option>
                </Select>
              </Field>

              <Field label="Transportation" htmlFor="transportation">
                <Select
                  id="transportation"
                  value={transportation}
                  onChange={(event) => setTransportation(event.target.value as Transportation | '')}
                >
                  <option value="">Select transportation...</option>
                  <option value="walking">Walking</option>
                  <option value="motorbike">Motorbike</option>
                  <option value="car">Car</option>
                  <option value="taxi">Taxi</option>
                  <option value="cyclo">Cyclo</option>
                  <option value="mixed">Mixed</option>
                </Select>
              </Field>
            </div>

            <Field label="Status" htmlFor="status">
              <Select id="status" value={status} onChange={(event) => setStatus(event.target.value)}>
                <option value="draft">Draft</option>
                <option value="planned">Planned</option>
                <option value="active">Active</option>
              </Select>
            </Field>

            <div className="inline-actions">
              <Button
                type="button"
                variant="primary"
                onClick={() => void handleSaveSettings()}
                loading={savingSettings}
                disabled={savingSettings || activityActionLoading}
              >
                Save settings
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => void handleReplan()}
                disabled={savingSettings || activityActionLoading}
              >
                Re-plan itinerary
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => navigate(`/trip/${tripId}`)}
                disabled={savingSettings}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>

        {/* Section 2: Manage Itinerary Activities */}
        <div>
          <div className="eyebrow" style={{ marginTop: '1rem' }}>Itinerary Schedule</div>
          <h2 className="page-heading" style={{ fontSize: '1.6rem', marginBottom: '0.5rem' }}>
            Manage Places & Days
          </h2>
          <p className="page-subtitle" style={{ marginBottom: '1.5rem' }}>
            Reorder, move, add, or remove destinations for each day of your trip.
          </p>

          {days.length === 0 ? (
            <div className="card">
              <p className="muted">No days scheduled for this trip. Click &quot;Re-plan itinerary&quot; above to generate days.</p>
            </div>
          ) : (
            <div className="stack stack--lg">
              {days.map((day) => {
                const dayActs = activities[day.id] ?? [];

                return (
                  <div key={day.id} className="card stack stack--md">
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'baseline',
                        borderBottom: '1px solid var(--color-border)',
                        paddingBottom: '0.75rem',
                      }}
                    >
                      <div>
                        <h3 style={{ margin: 0 }}>
                          Day {day.day_number ?? 1}: {day.title || `Day ${day.day_number ?? 1}`}
                        </h3>
                        <span className="muted" style={{ fontSize: '0.85rem' }}>
                          {dayActs.length} destination{dayActs.length === 1 ? '' : 's'} scheduled
                        </span>
                      </div>
                    </div>

                    {/* Activities List */}
                    <div className="stack stack--sm">
                      {dayActs.length === 0 ? (
                        <p className="muted" style={{ margin: '0.5rem 0' }}>
                          No activities on this day. Add a destination below.
                        </p>
                      ) : (
                        dayActs.map((act, idx) => (
                          <div
                            key={act.id}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: '0.75rem',
                              padding: '0.65rem 0.75rem',
                              borderRadius: 'var(--radius-md)',
                              background: 'var(--color-surface-muted)',
                              flexWrap: 'wrap',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: '12rem' }}>
                              <span
                                style={{
                                  width: '1.75rem',
                                  height: '1.75rem',
                                  borderRadius: '50%',
                                  background: 'var(--color-primary)',
                                  color: '#fff',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: '0.85rem',
                                  fontWeight: 'bold',
                                }}
                              >
                                {idx + 1}
                              </span>
                              <div>
                                <strong style={{ display: 'block', fontSize: '0.95rem' }}>{act.title}</strong>
                                {act.start_time && (
                                  <span className="muted" style={{ fontSize: '0.8rem' }}>
                                    {act.start_time} {act.end_time ? `- ${act.end_time}` : ''}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Actions for this activity */}
                            <div className="inline-actions" style={{ alignItems: 'center' }}>
                              {/* Reorder buttons */}
                              <button
                                type="button"
                                className="button button--ghost"
                                style={{ padding: '0.25rem 0.5rem', minHeight: 'auto', fontSize: '0.9rem' }}
                                disabled={idx === 0 || activityActionLoading}
                                onClick={() => void handleMoveActivity(day.id, idx, idx - 1)}
                                title="Move up"
                                aria-label="Move up"
                              >
                                ↑
                              </button>
                              <button
                                type="button"
                                className="button button--ghost"
                                style={{ padding: '0.25rem 0.5rem', minHeight: 'auto', fontSize: '0.9rem' }}
                                disabled={idx === dayActs.length - 1 || activityActionLoading}
                                onClick={() => void handleMoveActivity(day.id, idx, idx + 1)}
                                title="Move down"
                                aria-label="Move down"
                              >
                                ↓
                              </button>

                              {/* Change day dropdown */}
                              {days.length > 1 && (
                                <select
                                  style={{
                                    fontSize: '0.8rem',
                                    padding: '0.35rem 0.5rem',
                                    borderRadius: 'var(--radius-sm)',
                                    border: '1px solid var(--color-border)',
                                  }}
                                  value={day.id}
                                  disabled={activityActionLoading}
                                  onChange={(e) => void handleMoveToDay(act.id, day.id, e.target.value)}
                                  aria-label="Move activity to different day"
                                >
                                  {days.map((d) => (
                                    <option key={d.id} value={d.id}>
                                      Move to Day {d.day_number}
                                    </option>
                                  ))}
                                </select>
                              )}

                              {/* Remove button */}
                              <button
                                type="button"
                                className="button button--outline"
                                style={{
                                  padding: '0.25rem 0.6rem',
                                  minHeight: 'auto',
                                  fontSize: '0.8rem',
                                  color: 'var(--color-error)',
                                }}
                                disabled={activityActionLoading}
                                onClick={() => void handleRemoveActivity(act.id, day.id)}
                              >
                                Remove
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    {/* Add Place Selector for this day */}
                    <div
                      style={{
                        display: 'flex',
                        gap: '0.5rem',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        marginTop: '0.5rem',
                        paddingTop: '0.75rem',
                        borderTop: '1px dashed var(--color-border)',
                      }}
                    >
                      <select
                        style={{
                          flex: 1,
                          minWidth: '14rem',
                          padding: '0.5rem 0.75rem',
                          borderRadius: 'var(--radius-md)',
                          border: '1px solid var(--color-border)',
                          fontSize: '0.9rem',
                        }}
                        value={selectedPlacePerDay[day.id] || ''}
                        onChange={(e) =>
                          setSelectedPlacePerDay((prev) => ({ ...prev, [day.id]: e.target.value }))
                        }
                        aria-label={`Select destination to add to Day ${day.day_number}`}
                      >
                        <option value="">Select a destination to add...</option>
                        {availablePlaces
                          .filter((p) => !dayActs.some((act) => act.place_id === p.id))
                          .map((place) => (
                            <option key={place.id} value={place.id}>
                              {place.name_vi || place.name_en} ({place.duration_minutes ?? 60} min)
                            </option>
                          ))}
                      </select>
                      <Button
                        type="button"
                        variant="outline"
                        style={{ padding: '0.5rem 1rem', minHeight: 'auto' }}
                        disabled={!selectedPlacePerDay[day.id] || activityActionLoading}
                        onClick={() => void handleAddPlaceToDay(day.id)}
                      >
                        + Add to Day {day.day_number}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
