export interface LoadingStateProps {
  message?: string;
  title?: string;
}

export function LoadingState({ title = 'Preparing your itinerary', message = 'Loading...' }: LoadingStateProps) {
  return (
    <div className="state-card" aria-live="polite">
      <div className="state-card__icon" aria-hidden="true">⏳</div>
      <div>
        <h2>{title}</h2>
        <p>{message}</p>
      </div>
    </div>
  );
}
