import type { ReactNode } from 'react';

export type BadgeVariant = 'neutral' | 'primary' | 'accent' | 'success' | 'warning' | 'danger';

export interface BadgeProps {
  children: ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

export function Badge({ children, variant = 'neutral', className }: BadgeProps) {
  return <span className={cn('badge', `badge--${variant}`, className)}>{children}</span>;
}
