import type { TextareaHTMLAttributes } from 'react';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
}

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

export function Textarea({ className, error = false, ...props }: TextareaProps) {
  return <textarea className={cn('form-field__control', error ? 'form-field--error' : undefined, className)} {...props} />;
}
