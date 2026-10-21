import { useState, type FormEvent } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/useAuth';
import { Button } from '../../components/ui/Button';
import { Field } from '../../components/ui/Field';
import { Input } from '../../components/ui/Input';

export function AuthPage() {
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchParams] = useSearchParams();
  const { user, signIn, signUp } = useAuth();

  const redirectTo = searchParams.get('redirect') || '/home';

  if (user) {
    return <Navigate to={redirectTo} replace />;
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (mode === 'sign-in') {
        await signIn(email, password);
      } else {
        await signUp(email, password, displayName || undefined);
      }
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : 'Authentication failed.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page page-shell" style={{ display: 'grid', placeItems: 'center', minHeight: '100vh' }}>
      <section className="card" style={{ width: 'min(100%, 32rem)', padding: '2rem' }}>
        <div className="stack stack--lg">
          <div>
            <div className="eyebrow">HUEGO account</div>
            <h1 className="page-heading">{mode === 'sign-in' ? 'Welcome back' : 'Create your account'}</h1>
          </div>

          <div className="inline-actions">
            <Button type="button" variant={mode === 'sign-in' ? 'primary' : 'outline'} onClick={() => setMode('sign-in')}>
              Sign in
            </Button>
            <Button type="button" variant={mode === 'sign-up' ? 'primary' : 'outline'} onClick={() => setMode('sign-up')}>
              Sign up
            </Button>
          </div>

          <form onSubmit={handleSubmit} className="stack stack--lg">
            {mode === 'sign-up' && (
              <Field label="Display name" htmlFor="display-name">
                <Input id="display-name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="Your name" />
              </Field>
            )}

            <Field label="Email" htmlFor="email">
              <Input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@example.com" required />
            </Field>

            <Field label="Password" htmlFor="password">
              <Input id="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="••••••••" required />
            </Field>

            {error && <div className="form-error">{error}</div>}

            <Button type="submit" variant="primary" size="lg" loading={loading}>
              {mode === 'sign-in' ? 'Sign in' : 'Create account'}
            </Button>
          </form>
        </div>
      </section>
    </div>
  );
}
