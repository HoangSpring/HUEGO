import { Button } from '../ui/Button';

export interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
}

export function ErrorState({
  title = 'Something went wrong',
  message = 'Please try again in a moment.',
  onRetry,
}: ErrorStateProps) {
  return (
    <div className="state-card" role="alert">
      <div className="state-card__icon" aria-hidden="true">!</div>
      <div>
        <h2>{title}</h2>
        <p>{message}</p>
      </div>
      {onRetry && <Button variant="primary" onClick={onRetry}>Retry</Button>}
    </div>
  );
}
