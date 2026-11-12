'use client';

import { useState, useRef, useEffect } from 'react';
import { LivePhotoIcon } from './Icons';

interface LivePhotoProps {
  photoUrl: string;
  liveVideoUrl?: string;
  alt?: string;
  className?: string;
  style?: React.CSSProperties;
  imgClassName?: string;
  showBadge?: boolean;
  autoPlayOnHover?: boolean;
  onPlayStateChange?: (playing: boolean) => void;
}

export default function LivePhoto({
  photoUrl,
  liveVideoUrl,
  alt = 'Photo',
  className = '',
  style,
  imgClassName = '',
  showBadge = true,
  autoPlayOnHover = true,
  onPlayStateChange,
}: LivePhotoProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const touchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hasLive = Boolean(liveVideoUrl);

  const handleStartPlay = () => {
    if (!hasLive || !videoRef.current) return;
    setIsPlaying(true);
    if (onPlayStateChange) onPlayStateChange(true);
    videoRef.current.currentTime = 0;
    videoRef.current.play().catch(() => {});
  };

  const handleStopPlay = () => {
    if (!hasLive || !videoRef.current) return;
    setIsPlaying(false);
    if (onPlayStateChange) onPlayStateChange(false);
    videoRef.current.pause();
    videoRef.current.currentTime = 0;
  };

  const togglePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isPlaying) {
      handleStopPlay();
    } else {
      handleStartPlay();
    }
  };

  // Touch handlers for mobile press-and-hold
  const handleTouchStart = () => {
    if (!hasLive) return;
    touchTimerRef.current = setTimeout(() => {
      handleStartPlay();
    }, 150);
  };

  const handleTouchEnd = () => {
    if (touchTimerRef.current) {
      clearTimeout(touchTimerRef.current);
      touchTimerRef.current = null;
    }
    if (isPlaying) {
      handleStopPlay();
    }
  };

  useEffect(() => {
    return () => {
      if (touchTimerRef.current) clearTimeout(touchTimerRef.current);
    };
  }, []);

  return (
    <div
      className={`relative overflow-hidden group select-none ${className}`}
      style={style}
      onMouseEnter={autoPlayOnHover ? handleStartPlay : undefined}
      onMouseLeave={autoPlayOnHover ? handleStopPlay : undefined}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
    >
      {/* Still Photo */}
      <img
        src={photoUrl}
        alt={alt}
        className={`w-full h-full object-cover transition-opacity duration-200 ${
          isPlaying ? 'opacity-0' : 'opacity-100'
        } ${imgClassName}`}
        loading="lazy"
      />

      {/* Live Video */}
      {hasLive && (
        <video
          ref={videoRef}
          src={liveVideoUrl}
          muted
          playsInline
          loop
          preload="metadata"
          onCanPlay={() => setIsReady(true)}
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-200 pointer-events-none ${
            isPlaying ? 'opacity-100' : 'opacity-0'
          }`}
        />
      )}

      {/* iOS Live Photo Badge */}
      {hasLive && showBadge && (
        <button
          type="button"
          onClick={togglePlay}
          className={`absolute top-2 left-2 z-10 flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold tracking-wide backdrop-blur-md transition-all shadow-md cursor-pointer ${
            isPlaying
              ? 'bg-amber-400/90 text-slate-950 shadow-amber-400/30 ring-2 ring-amber-300'
              : 'bg-black/60 text-white/90 hover:bg-black/80 hover:text-white'
          }`}
          title={isPlaying ? 'Live Photo (Sedang Berputar)' : 'Klik / Tahan untuk Live Photo'}
        >
          <LivePhotoIcon size={14} active={isPlaying} className={isPlaying ? 'animate-pulse text-slate-950' : 'text-amber-400'} />
          <span>LIVE</span>
        </button>
      )}
    </div>
  );
}

