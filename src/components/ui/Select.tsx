import type { SelectHTMLAttributes } from 'react';

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  error?: boolean;
}

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

export function Select({ className, error = false, children, ...props }: SelectProps) {
  return (
    <select className={cn('form-field__control', error ? 'form-field--error' : undefined, className)} {...props}>
      {children}
    </select>
  );
}
