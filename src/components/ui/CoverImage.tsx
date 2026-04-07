import { useState } from 'react';

const FALLBACK_URL = 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=512&h=512&fit=crop';

interface CoverImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  /** Custom fallback URL. Defaults to a safe Unsplash placeholder. */
  fallback?: string;
}

/**
 * Drop-in replacement for <img> when displaying album/song cover art.
 *
 * - Silently falls back to a placeholder on CORS errors or 404s.
 * - Does NOT set crossOrigin on native (Capacitor) to avoid CORS preflight crashes.
 * - Accepts all standard img props (className, style, onClick, etc.)
 */
export const CoverImage = ({
  src,
  fallback = FALLBACK_URL,
  alt = 'Cover art',
  ...props
}: CoverImageProps) => {
  const [imgSrc, setImgSrc] = useState<string | undefined>(src);
  const [errored, setErrored] = useState(false);

  const handleError = () => {
    if (!errored) {
      setErrored(true);
      setImgSrc(fallback);
    }
  };

  return (
    <img
      {...props}
      src={imgSrc || fallback}
      alt={alt}
      onError={handleError}
    />
  );
};

export default CoverImage;
