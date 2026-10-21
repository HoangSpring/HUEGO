import type { ReactNode } from 'react';

export interface FieldProps {
  label?: ReactNode;
  htmlFor?: string;
  children: ReactNode;
  helperText?: ReactNode;
  error?: ReactNode;
  className?: string;
}

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

export function Field({ label, htmlFor, children, helperText, error, className }: FieldProps) {
  return (
    <div className={cn('form-field', error ? 'form-field--error' : undefined, className)}>
      {label && (
        <label className="form-field__label" htmlFor={htmlFor}>
          {label}
        </label>
      )}
      {children}
      {helperText && !error && <span className="form-help">{helperText}</span>}
      {error && <span className="form-error">{error}</span>}
    </div>
  );
}
