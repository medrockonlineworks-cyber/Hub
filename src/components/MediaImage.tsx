import { useEffect, useState } from 'react';
import { Film } from 'lucide-react';
import { useResolvedImageSrc } from '../hooks/useGitHubMedia';

interface MediaImageProps {
  src: string;
  alt: string;
  className?: string;
  fallbackTitle?: string;
}

export function MediaImage({ src, alt, className = '', fallbackTitle }: MediaImageProps) {
  const resolvedSrc = useResolvedImageSrc(src);
  const [activeSrc, setActiveSrc] = useState<string>(resolvedSrc || src);
  const [failed, setFailed] = useState(false);

  // Automatically refresh rendered image whenever GitHub cache resolves a new/updated blob URL
  useEffect(() => {
    setActiveSrc(resolvedSrc || src);
    setFailed(false);
  }, [resolvedSrc, src]);

  const handleError = () => {
    // Safe fallback chain: cached/GitHub raw -> original local path -> styled fallback placeholder
    if (activeSrc !== src && src) {
      setActiveSrc(src);
      return;
    }
    if (activeSrc.startsWith('/remote-images/')) {
      const preservedOriginal = `/src/assets/images/${activeSrc.slice('/remote-images/'.length)}`;
      if (activeSrc !== preservedOriginal) {
        setActiveSrc(preservedOriginal);
        return;
      }
    }
    setFailed(true);
  };

  if (failed || !activeSrc) {
    return (
      <div
        role="img"
        aria-label={alt}
        className={`flex flex-col items-center justify-center bg-gradient-to-br from-[#18181E] via-[#121216] to-[#0D0D11] text-zinc-400 p-4 select-none ${className}`}
      >
        <Film className="w-7 h-7 text-[#E5A91A]/70 mb-2" strokeWidth={1.5} />
        {fallbackTitle && (
          <span className="text-xs font-medium text-zinc-300 text-center line-clamp-2 max-w-[80%]">
            {fallbackTitle}
          </span>
        )}
      </div>
    );
  }

  return (
    <img
      src={activeSrc}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={handleError}
      className={className}
    />
  );
}
