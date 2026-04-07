import React from 'react';
import { Music } from 'lucide-react';
import { cn } from '@/lib/utils';
import { API_URL } from '@/lib/api';

function normalizeCoverUrl(src?: string | null): string | null {
  if (!src) return null;
  const s = String(src);
  if (s.startsWith('http://') || s.startsWith('https://') || s.startsWith('data:') || s.startsWith('blob:')) {
    return s;
  }
  // Assume it is a backend filename
  return `${API_URL}${API_URL.endsWith('/') ? '' : '/'}/covers/${s.startsWith('/') ? s.slice(1) : s}`;
}

export interface CoverImageProps extends React.HTMLAttributes<HTMLDivElement> {
  src?: string | null;
  alt?: string;
  rounded?: string; // Tailwind rounding class override (e.g., 'rounded-xl')
  showBorder?: boolean;
  fallbackIconClassName?: string;
}

export const CoverImage: React.FC<CoverImageProps> = ({
  src,
  alt,
  className,
  rounded = 'rounded-lg',
  showBorder = true,
  fallbackIconClassName,
  ...rest
}) => {
  const url = normalizeCoverUrl(src);

  return (
    <div
      className={cn(
        'relative overflow-hidden bg-muted select-none',
        rounded,
        showBorder && 'border border-border/50',
        className
      )}
      {...rest}
    >
      {url ? (
        <img
          src={url}
          alt={alt || ''}
          className="w-full h-full object-cover"
          onError={(e) => {
            const target = e.currentTarget as HTMLImageElement;
            target.style.display = 'none';
          }}
          draggable={false}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-muted-foreground">
          <Music className={cn('h-6 w-6', fallbackIconClassName)} />
        </div>
      )}
    </div>
  );
};

export default CoverImage;
