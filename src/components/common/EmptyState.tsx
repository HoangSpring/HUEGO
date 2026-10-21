import { Button } from '../ui/Button';

export interface EmptyStateProps {
  title?: string;
  message?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function EmptyState({
  title = 'No trips yet',
  message = 'Nothing to show here yet.',
  action,
}: EmptyStateProps) {
  return (
    <div className="state-card">
      <div className="state-card__icon" aria-hidden="true">✦</div>
      <div>
        <h2>{title}</h2>
        <p>{message}</p>
      </div>
      {action && <Button variant="primary" onClick={action.onClick}>{action.label}</Button>}
    </div>
  );
}
