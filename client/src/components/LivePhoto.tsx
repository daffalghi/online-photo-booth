'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { LivePhotoIcon } from './Icons';

interface LivePhotoProps {
  photoUrl: string;
  liveVideoUrl?: string;
  alt?: string;
  className?: string;
  style?: React.CSSProperties;
  imgClassName?: string;
  showBadge?: boolean;
  autoPlayLoop?: boolean; // Continuous GIF-like loop
  motionDurationMs?: number; // 5000ms motion
  stillHoldDurationMs?: number; // 3000ms static hold
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
  autoPlayLoop = true,
  motionDurationMs = 5000,
  stillHoldDurationMs = 3000,
  onPlayStateChange,
}: LivePhotoProps) {
  const [isVideoVisible, setIsVideoVisible] = useState(false);
  const [isPlayingMotion, setIsPlayingMotion] = useState(false);
  const [isPausedByUser, setIsPausedByUser] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const loopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const motionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hasLive = Boolean(liveVideoUrl);

  const clearAllTimers = useCallback(() => {
    if (loopTimerRef.current) {
      clearTimeout(loopTimerRef.current);
      loopTimerRef.current = null;
    }
    if (motionTimerRef.current) {
      clearTimeout(motionTimerRef.current);
      motionTimerRef.current = null;
    }
  }, []);

  // Hold still photo (pauses video, smoothly fades out video so crisp still image is displayed)
  const holdStill = useCallback(() => {
    clearAllTimers();
    setIsPlayingMotion(false);
    setIsVideoVisible(false);
    if (onPlayStateChange) onPlayStateChange(false);

    if (videoRef.current) {
      videoRef.current.pause();
    }

    if (autoPlayLoop && !isPausedByUser) {
      // Hold still photo for 3 seconds, then restart motion cycle (continuous GIF loop)
      loopTimerRef.current = setTimeout(() => {
        startMotion();
      }, stillHoldDurationMs);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clearAllTimers, autoPlayLoop, isPausedByUser, onPlayStateChange, stillHoldDurationMs]);

  // Start motion cycle (plays live video for ~5 seconds)
  const startMotion = useCallback(() => {
    if (!hasLive || !videoRef.current || isPausedByUser) return;
    clearAllTimers();

    const video = videoRef.current;
    video.currentTime = 0;

    video
      .play()
      .then(() => {
        setIsPlayingMotion(true);
        if (onPlayStateChange) onPlayStateChange(true);

        // Motion duration: 5 seconds, then transition to 3s still photo
        motionTimerRef.current = setTimeout(() => {
          holdStill();
        }, motionDurationMs);
      })
      .catch(() => {
        holdStill();
      });
  }, [hasLive, isPausedByUser, clearAllTimers, onPlayStateChange, motionDurationMs, holdStill]);

  // Initial auto-start loop
  useEffect(() => {
    if (hasLive && autoPlayLoop && !isPausedByUser) {
      const t = setTimeout(() => {
        startMotion();
      }, 400);
      return () => {
        clearTimeout(t);
        clearAllTimers();
      };
    }
    return () => clearAllTimers();
  }, [hasLive, autoPlayLoop, isPausedByUser, startMotion, clearAllTimers]);

  const toggleUserPlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isPlayingMotion) {
      setIsPausedByUser(true);
      holdStill();
    } else {
      setIsPausedByUser(false);
      startMotion();
    }
  };

  return (
    <div
      className={`relative overflow-hidden group select-none ${className}`}
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: '#090a10',
        ...style,
      }}
    >
      {/* Base Still Photo - ALWAYS 100% visible at z-1, never flashes black! */}
      <img
        src={photoUrl}
        alt={alt}
        className={`w-full h-full object-cover ${imgClassName}`}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          display: 'block',
          zIndex: 1,
        }}
        decoding="async"
      />

      {/* Live Video Layer - sits at z-2, smoothly fades in ONLY after playing frames */}
      {hasLive && (
        <video
          ref={videoRef}
          src={liveVideoUrl}
          muted
          playsInline
          preload="auto"
          onPlaying={() => setIsVideoVisible(true)}
          onEnded={holdStill}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            zIndex: 2,
            opacity: isVideoVisible && isPlayingMotion ? 1 : 0,
            transition: 'opacity 0.25s ease-in-out',
            pointerEvents: 'none',
          }}
        />
      )}

      {/* iOS Live Photo Indicator Badge */}
      {hasLive && showBadge && (
        <button
          type="button"
          onClick={toggleUserPlay}
          className={`absolute top-2.5 left-2.5 z-10 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold tracking-wide backdrop-blur-md transition-all shadow-md cursor-pointer ${
            isPlayingMotion
              ? 'bg-amber-400 text-slate-950 shadow-amber-400/40 ring-2 ring-amber-300'
              : 'bg-black/60 text-white/90 hover:bg-black/80 hover:text-white'
          }`}
          title={isPlayingMotion ? 'Sedang Bergerak (5s gerak -> 3s statis)' : 'Foto Diam (Klik untuk memutar)'}
        >
          <LivePhotoIcon
            size={14}
            active={isPlayingMotion}
            className={isPlayingMotion ? 'animate-pulse text-slate-950' : 'text-amber-400'}
          />
          <span>{isPlayingMotion ? 'LIVE' : 'LIVE PHOTO'}</span>
        </button>
      )}
    </div>
  );
}
