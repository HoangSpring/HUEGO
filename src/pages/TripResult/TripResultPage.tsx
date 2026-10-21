import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ErrorState } from '../../components/common/ErrorState';
import { LoadingState } from '../../components/common/LoadingState';
import { useTrip } from '../../hooks/useTrip';
import { summarizeEntranceFeeBudget } from '../../services/trips/budgetSummary';

export function TripResultPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { tripId } = useParams();
  const { trip, days, activities, places, images, loading, error } = useTrip(tripId);

  const locationState = location.state as { fallbackUsed?: boolean; fallbackReason?: string } | null;

  if (loading) {
    return (
      <div className="page trip-result-page">
        <LoadingState title="Loading itinerary" message="Preparing your trip details..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="page trip-result-page">
        <ErrorState title="Unable to load this trip" message={error} />
      </div>
    );
  }

  if (!trip) {
    return (
      <div className="page trip-result-page">
        <ErrorState title="Trip not found" message="This trip could not be found or access is restricted." />
      </div>
    );
  }

  const allActivities = Object.values(activities).flat();
  const feeBudget = summarizeEntranceFeeBudget(
    trip.budget,
    allActivities.map((activity) => activity.estimated_cost)
  );
  const hasBudget = trip.budget !== null && trip.budget !== undefined;

  return (
    <div className="page trip-result-page">
      <div className="section-header">
        <div>
          <div className="eyebrow">Itinerary</div>
          <h1 className="page-heading">{trip.title || 'Untitled trip'}</h1>
        </div>
        <div className="inline-actions">
          <button
            type="button"
            className="button button--outline"
            onClick={() => navigate(`/trip/${trip.id}/edit`)}
          >
            Edit / Re-plan trip
          </button>
        </div>
      </div>

      {locationState?.fallbackUsed && (
        <div
          role="status"
          style={{
            padding: '0.75rem 1rem',
            borderRadius: 'var(--radius-md)',
            background: 'rgba(217, 119, 6, 0.1)',
            border: '1px solid rgba(217, 119, 6, 0.25)',
            color: '#b45309',
            marginBottom: '1.25rem',
            fontSize: '0.9rem',
          }}
        >
          ℹ️ <strong>Standard Route:</strong> AI did not return a usable plan ({locationState.fallbackReason || 'provider unavailable'}). This itinerary was planned using verified destinations and your total trip budget.
        </div>
      )}

      <div className="trip-summary">
        <div className="summary-item">
          <span className="label">Duration:</span>
          <span className="value">{trip.days_count ?? 1} day{(trip.days_count ?? 1) === 1 ? '' : 's'}</span>
        </div>
        <div className="summary-item">
          <span className="label">Total trip budget:</span>
          <span className="value">{trip.budget != null ? `${trip.budget.toLocaleString()} VND` : 'Not set'}</span>
        </div>
        <div className="summary-item">
          <span className="label">Status:</span>
          <span className="value">{trip.status || 'draft'}</span>
        </div>
        {trip.transportation && (
          <div className="summary-item">
            <span className="label">Transit:</span>
            <span className="value" style={{ textTransform: 'capitalize' }}>{trip.transportation}</span>
          </div>
        )}
        {trip.companion_type && (
          <div className="summary-item">
            <span className="label">Companions:</span>
            <span className="value" style={{ textTransform: 'capitalize' }}>{trip.companion_type}</span>
          </div>
        )}
        {trip.start_date && (
          <div className="summary-item">
            <span className="label">Dates:</span>
            <span className="value">
              {trip.start_date}{trip.end_date ? ` – ${trip.end_date}` : ''}
            </span>
          </div>
        )}
      </div>

      {(hasBudget || feeBudget.unknownFeeCount > 0) && (
        <div
          role={feeBudget.exceedsBudget || feeBudget.unknownFeeCount > 0 ? 'alert' : 'status'}
          style={{
            padding: '0.75rem 1rem',
            borderRadius: 'var(--radius-md)',
            background: feeBudget.exceedsBudget || feeBudget.unknownFeeCount > 0 ? 'rgba(217, 119, 6, 0.1)' : 'var(--color-surface-muted)',
            border: '1px solid rgba(217, 119, 6, 0.25)',
            color: feeBudget.exceedsBudget || feeBudget.unknownFeeCount > 0 ? '#92400e' : 'var(--color-text-secondary)',
            margin: '1rem 0',
            fontSize: '0.9rem',
          }}
        >
          <p style={{ margin: 0 }}>
            Listed entrance fees for the full trip: {feeBudget.knownFeesTotal.toLocaleString()} VND.
            {' '}Transportation, food, and lodging are not included.
          </p>
          {feeBudget.exceedsBudget && trip.budget !== null && trip.budget !== undefined && (
            <p style={{ margin: '0.35rem 0 0' }}>
              Known entrance fees exceed your total trip budget of {trip.budget.toLocaleString()} VND. Increase the budget or edit the itinerary.
            </p>
          )}
          {feeBudget.unknownFeeCount > 0 && (
            <p style={{ margin: '0.35rem 0 0' }}>
              {feeBudget.unknownFeeCount} activity fee(s) are not listed in the verified catalog, so the displayed subtotal is incomplete.
            </p>
          )}
          {hasBudget && !feeBudget.exceedsBudget && (
            <p style={{ margin: '0.35rem 0 0' }}>
              The planner prioritizes catalog-listed entrance fees within this total trip budget. Missing fees and other trip expenses are not assumed to be free.
            </p>
          )}
        </div>
      )}

      {days.length === 0 ? (
        <div className="card">
          <p className="muted">No activities planned yet for this trip.</p>
        </div>
      ) : (
        <div className="trip-days">
          {days.map((day) => {
            const dayActivities = activities[day.id] ?? [];
            return (
              <div key={day.id} className="day-section card">
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'baseline',
                    flexWrap: 'wrap',
                    gap: '0.5rem',
                    marginBottom: '1rem',
                  }}
                >
                  <h2 style={{ margin: 0 }}>{day.title || `Day ${day.day_number ?? 1}`}</h2>
                  <div
                    className="muted"
                    style={{ fontSize: '0.875rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}
                  >
                    {day.total_distance_km !== null && day.total_distance_km !== undefined && (
                      <span>Est. Distance: {day.total_distance_km} km</span>
                    )}
                    {day.estimated_travel_minutes !== null && day.estimated_travel_minutes !== undefined && (
                      <span>Est. Transit: ~{day.estimated_travel_minutes} min</span>
                    )}
                    {day.estimated_cost !== null && day.estimated_cost !== undefined && (
                      <span>
                        {dayActivities.some((activity) => activity.estimated_cost === null) ? 'Known fees: ' : 'Est. Fees: '}
                        {day.estimated_cost === 0 ? 'Free admission' : `${day.estimated_cost.toLocaleString()} VND`}
                      </span>
                    )}
                  </div>
                </div>

                <div className="activities stack stack--sm">
                  {dayActivities.length === 0 ? (
                    <p className="muted">No activities scheduled for this day.</p>
                  ) : (
                    dayActivities.map((activity) => {
                      const place = places.find((p) => p.id === activity.place_id);
                      const placeImagesList = activity.place_id ? images[activity.place_id] : undefined;
                      const coverImg = placeImagesList?.find((img) => img.is_cover) || placeImagesList?.[0];

                      return (
                        <div
                          key={activity.id}
                          className="activity"
                          style={{
                            display: 'flex',
                            gap: '1rem',
                            alignItems: 'flex-start',
                            padding: '0.85rem 0',
                            borderBottom: '1px solid var(--color-border)',
                          }}
                        >
                          {coverImg?.storage_path ? (
                            <div
                              style={{
                                width: '4.5rem',
                                height: '4.5rem',
                                borderRadius: 'var(--radius-md)',
                                overflow: 'hidden',
                                flexShrink: 0,
                                background: 'var(--color-surface-muted)',
                              }}
                            >
                              <img
                                src={coverImg.storage_path}
                                alt={coverImg.alt_text_vi || coverImg.alt_text_en || activity.title}
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                loading="lazy"
                              />
                            </div>
                          ) : (
                            <div
                              style={{
                                width: '4.5rem',
                                height: '4.5rem',
                                borderRadius: 'var(--radius-md)',
                                flexShrink: 0,
                                background: 'rgba(28, 107, 93, 0.08)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'var(--color-primary)',
                                fontSize: '1.25rem',
                              }}
                              aria-hidden="true"
                            >
                              🏛
                            </div>
                          )}

                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'baseline',
                                flexWrap: 'wrap',
                                gap: '0.5rem',
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                                {activity.place_id ? (
                                  <Link
                                    to={`/place/${activity.place_id}`}
                                    className="text-primary"
                                    style={{ fontWeight: 'bold', fontSize: '1.05rem' }}
                                  >
                                    {activity.title}
                                  </Link>
                                ) : (
                                  <strong style={{ color: 'var(--color-text-primary)', fontSize: '1.05rem' }}>
                                    {activity.title}
                                  </strong>
                                )}
                                {activity.is_ai_generated && (
                                  <span
                                    style={{
                                      fontSize: '0.725rem',
                                      padding: '0.15rem 0.45rem',
                                      borderRadius: 'var(--radius-sm)',
                                      background: 'rgba(28, 107, 93, 0.12)',
                                      color: 'var(--color-primary)',
                                      fontWeight: 600,
                                      whiteSpace: 'nowrap',
                                    }}
                                  >
                                    ✨ AI
                                  </span>
                                )}
                              </div>
                              <time className="muted" style={{ fontSize: '0.875rem', fontWeight: 600 }}>
                                {activity.start_time
                                  ? activity.end_time
                                    ? `${activity.start_time} - ${activity.end_time}`
                                    : activity.start_time
                                  : 'Time TBD'}
                              </time>
                            </div>

                            {activity.notes && (
                              <p className="muted" style={{ margin: '0.35rem 0 0.25rem', fontSize: '0.9rem' }}>
                                {activity.notes}
                              </p>
                            )}

                            <div
                              className="muted"
                              style={{
                                fontSize: '0.8rem',
                                display: 'flex',
                                gap: '0.75rem',
                                flexWrap: 'wrap',
                                marginTop: '0.35rem',
                              }}
                            >
                              {activity.duration_minutes !== null && activity.duration_minutes !== undefined && (
                                <span>⏱ Visit: {activity.duration_minutes} min</span>
                              )}
                              {place?.opening_time && place?.closing_time && (
                                <span>🕒 Open: {place.opening_time.slice(0, 5)} - {place.closing_time.slice(0, 5)}</span>
                              )}
                              {(activity.travel_minutes !== null && activity.travel_minutes !== undefined) ||
                              (activity.distance_km !== null && activity.distance_km !== undefined) ? (
                                <span>
                                  🚗 Est. transit: {activity.travel_minutes ? `~${activity.travel_minutes} min` : ''}
                                  {activity.distance_km ? ` (${activity.distance_km} km)` : ''}
                                  {activity.transportation ? ` via ${activity.transportation}` : ''}
                                </span>
                              ) : null}
                              {activity.estimated_cost !== null && activity.estimated_cost !== undefined && (
                                <span>
                                  🎟 Fee: {activity.estimated_cost === 0 ? 'Free admission' : `${activity.estimated_cost.toLocaleString()} VND`}
                                </span>
                              )}
                              {activity.estimated_cost === null && <span>🎟 Fee not listed</span>}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="trip-actions inline-actions" style={{ marginTop: '2rem' }}>
        <button
          type="button"
          className="button button--primary"
          onClick={() => navigate(`/trip/${trip.id}/edit`)}
        >
          Edit / Re-plan Trip
        </button>
        <Link to="/my-trips" className="button button--outline">
          My Trips
        </Link>
        <Link to="/plan" className="button button--ghost">
          Plan Another Trip
        </Link>
      </div>
    </div>
  );
}
