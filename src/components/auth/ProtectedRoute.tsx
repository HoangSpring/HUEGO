import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/useAuth';
import { LoadingState } from '../common/LoadingState';

export interface ProtectedRouteProps {
  children: ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="page-shell" style={{ paddingTop: '2rem' }}>
        <LoadingState title="Loading your account" message="Checking your HUEGO session..." />
      </div>
    );
  }

  if (!user) {
    const redirectTo = `/auth?redirect=${encodeURIComponent(location.pathname + location.search)}`;
    return <Navigate to={redirectTo} replace />;
  }

  return <>{children}</>;
}
