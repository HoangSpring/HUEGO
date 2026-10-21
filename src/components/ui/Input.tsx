import type { InputHTMLAttributes } from 'react';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

export function Input({ className, error = false, ...props }: InputProps) {
  return <input className={cn('form-field__control', error ? 'form-field--error' : undefined, className)} {...props} />;
}
