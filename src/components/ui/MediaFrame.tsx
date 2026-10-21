import type { ImgHTMLAttributes } from 'react';

export interface MediaFrameProps extends ImgHTMLAttributes<HTMLImageElement> {
  aspect?: 'square' | 'landscape' | 'portrait';
  fallback?: React.ReactNode;
}

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

export function MediaFrame({ src, alt, aspect = 'landscape', fallback, className, ...props }: MediaFrameProps) {
  const hasSrc = Boolean(src);

  return (
    <div className={cn('media-frame', `media-frame--${aspect}`, className)}>
      {hasSrc ? <img src={src} alt={alt || ''} {...props} /> : <div className="media-fallback">{fallback ?? 'Image unavailable'}</div>}
    </div>
  );
}
