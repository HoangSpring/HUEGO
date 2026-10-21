import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { Field } from '../../components/ui/Field';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { createTrip } from '../../services/trips/tripService';
import type { CompanionType, Transportation } from '../../types/database';

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
    message: supabaseError.message || 'Unknown Supabase error',
    details: supabaseError.details || '',
    hint: supabaseError.hint || '',
    code: supabaseError.code || '',
  };
}

export function PlanTripPage() {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [durationDays, setDurationDays] = useState(3);
  const [budget, setBudget] = useState('');
  const [travelersCount, setTravelersCount] = useState(2);
  const [companionType, setCompanionType] = useState<CompanionType | ''>('');
  const [transportation, setTransportation] = useState<Transportation | ''>('');
  const [constraints, setConstraints] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (submitting) {
      return;
    }

    // Input validation
    if (!durationDays || isNaN(durationDays) || !Number.isInteger(durationDays) || durationDays < 1) {
      setError('Trip duration must be at least 1 day.');
      return;
    }

    if (durationDays > 30) {
      setError('Trip duration cannot exceed 30 days.');
      return;
    }

    if (!travelersCount || isNaN(travelersCount) || !Number.isInteger(travelersCount) || travelersCount < 1) {
      setError('Number of travelers must be at least 1.');
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

    setSubmitting(true);
    setError(null);

    try {
      const trip = await createTrip({
        title: title.trim() || `Huế trip ${new Date().toLocaleDateString()}`,
        days_count: durationDays,
        budget: parsedBudget,
        people_count: travelersCount,
        budget_level: null,
        companion_type: companionType || null,
        transportation: transportation || null,
        constraints: constraints.trim() ? { notes: constraints.trim() } : null,
        status: 'draft',
      });

      navigate(`/ai-generating?tripId=${trip.id}`, { state: { tripId: trip.id } });
    } catch (submitError) {
      const details = getSupabaseErrorDetails(submitError);
      console.error('Failed to create trip:', details);
      setError([
        details.message,
        details.code && `Code: ${details.code}`,
        details.details && `Details: ${details.details}`,
        details.hint && `Hint: ${details.hint}`,
      ].filter(Boolean).join(' | '));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page plan-trip-page">
      <section className="section stack stack--lg">
        <div>
          <div className="eyebrow">Plan your route</div>
          <h1 className="page-heading">Build a Huế itinerary</h1>
        </div>

        <div className="card form-card">
          <form className="stack stack--lg" aria-label="Trip planning form" onSubmit={handleSubmit}>
            <Field label="Trip title" htmlFor="title">
              <Input id="title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="My Huế adventure" />
            </Field>

            <div className="grid grid--cols-2">
              <Field label="Trip Duration (days)" htmlFor="duration">
                <Input id="duration" type="number" min="1" value={durationDays} onChange={(event) => setDurationDays(Number(event.target.value) || 1)} />
              </Field>

              <Field label="Total trip budget (VND)" htmlFor="budget">
                <Input id="budget" type="number" min="0" value={budget} onChange={(event) => setBudget(event.target.value)} placeholder="e.g. 5000000" />
              </Field>

              <Field label="Travelers" htmlFor="travelers">
                <Input id="travelers" type="number" min="1" value={travelersCount} onChange={(event) => setTravelersCount(Number(event.target.value) || 1)} />
              </Field>

              <Field label="Travel companions" htmlFor="companion-type">
                <Select id="companion-type" value={companionType} onChange={(event) => setCompanionType(event.target.value as CompanionType | '')}>
                  <option value="">Select companions...</option>
                  <option value="solo">Solo</option>
                  <option value="couple">Couple</option>
                  <option value="family">Family</option>
                  <option value="friends">Friends</option>
                  <option value="other">Other</option>
                </Select>
              </Field>

              <Field label="Transportation" htmlFor="transportation">
                <Select id="transportation" value={transportation} onChange={(event) => setTransportation(event.target.value as Transportation | '')}>
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

            <Field label="Special constraints" htmlFor="constraints">
              <Input id="constraints" value={constraints} onChange={(event) => setConstraints(event.target.value)} placeholder="e.g. low mobility, avoid long walks" />
            </Field>

            {error && <div className="form-error">{error}</div>}

            <div className="inline-actions">
              <Button type="submit" variant="primary" size="lg" loading={submitting} disabled={submitting}>Create trip</Button>
            </div>
          </form>
        </div>
      </section>
    </div>
  );
}
