import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { Card, CardBody } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { EmptyState } from '../../components/common/EmptyState';
import { ErrorState } from '../../components/common/ErrorState';
import { LoadingState } from '../../components/common/LoadingState';
import { useTrips } from '../../hooks/useTrips';

export function MyTripsPage() {
  const navigate = useNavigate();
  const { trips, loading, error, reload } = useTrips();

  if (loading) {
    return (
      <div className="page my-trips-page">
        <LoadingState title="Loading your trips" message="Checking your saved plans in HUEGO..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="page my-trips-page">
        <ErrorState title="Unable to load trips" message={error} onRetry={reload} />
      </div>
    );
  }

  if (!trips.length) {
    return (
      <div className="page my-trips-page">
        <EmptyState
          title="No trips yet"
          message="Start planning your Huế adventure and save your first itinerary."
          action={{ label: 'Plan My Trip', onClick: () => navigate('/plan') }}
        />
      </div>
    );
  }

  return (
    <div className="page my-trips-page">
      <section className="section stack stack--lg">
        <div className="section-header">
          <div>
            <div className="eyebrow">Saved plans</div>
            <h1 className="page-heading">My Trips</h1>
          </div>
          <Button variant="primary" onClick={() => navigate('/plan')}>Plan another trip</Button>
        </div>

        <div className="stack stack--lg">
          {trips.map((trip) => (
            <Card key={trip.id} interactive>
              <CardBody>
                <div className="card__header" style={{ alignItems: 'flex-start' }}>
                  <div>
                    <h3 style={{ margin: 0 }}>{trip.title || 'Untitled trip'}</h3>
                    <p className="muted" style={{ margin: '0.45rem 0 0' }}>
                      {trip.days_count ?? 1} day{(trip.days_count ?? 1) === 1 ? '' : 's'} • {trip.budget ? `${trip.budget.toLocaleString()} VND` : 'Budget not set'}
                    </p>
                  </div>
                  <Badge variant="success">{trip.status || 'draft'}</Badge>
                </div>

                <div className="inline-actions" style={{ marginTop: '1rem' }}>
                  <Button variant="ghost" onClick={() => navigate(`/trip/${trip.id}`)}>View</Button>
                  <Button variant="outline" onClick={() => navigate(`/trip/${trip.id}/edit`)}>Edit</Button>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
