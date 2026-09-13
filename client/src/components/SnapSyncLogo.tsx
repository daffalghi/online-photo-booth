'use client';

import React from 'react';

interface SnapSyncLogoProps {
  size?: number;
  className?: string;
  showText?: boolean;
  textSize?: number;
}

export default function SnapSyncLogo({
  size = 40,
  className = '',
  showText = false,
  textSize = 20,
}: SnapSyncLogoProps) {
  return (
    <div
      className={`snapsync-logo-root ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: `${Math.max(8, Math.round(size * 0.26))}px`,
        textDecoration: 'none',
        userSelect: 'none',
        background: 'transparent',
      }}
    >
      <div
        className="snapsync-logo-mark"
        style={{
          width: `${size}px`,
          height: `${size}px`,
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          background: 'transparent',
        }}
      >
        <svg
          viewBox="0 0 96 96"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          style={{ width: '100%', height: '100%', overflow: 'visible', background: 'transparent' }}
        >
          <defs>
            {/* Smooth Vibrant Rose Gradient */}
            <linearGradient id="ss-rose-grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#ff2a6d" />
              <stop offset="60%" stopColor="#ff5e97" />
              <stop offset="100%" stopColor="#f43f5e" />
            </linearGradient>

            {/* Electric Violet / Indigo Gradient */}
            <linearGradient id="ss-violet-grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#a855f7" />
              <stop offset="50%" stopColor="#8b5cf6" />
              <stop offset="100%" stopColor="#6366f1" />
            </linearGradient>

            {/* Glowing Shutter Spark Gradient */}
            <linearGradient id="ss-spark-grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="60%" stopColor="#fdf2f8" />
              <stop offset="100%" stopColor="#fed7aa" />
            </linearGradient>

            {/* Soft Shadow for Depth on Transparent BG */}
            <filter id="ss-shadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="2" stdDeviation="4" floodColor="#ff5e97" floodOpacity="0.35" />
            </filter>
          </defs>

          {/* ─── Snap Frame (Top Left) - 100% Transparent Inside ─── */}
          <g filter="url(#ss-shadow)">
            <rect
              x="8"
              y="8"
              width="48"
              height="48"
              rx="15"
              fill="none"
              stroke="url(#ss-rose-grad)"
              strokeWidth="6"
            />
            {/* Viewfinder corner accent */}
            <path
              d="M 17 24 V 17 H 24"
              stroke="#ffffff"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeOpacity="0.95"
            />
          </g>

          {/* ─── Sync Frame (Bottom Right - Interlocking) - 100% Transparent Inside ─── */}
          <g filter="url(#ss-shadow)">
            <rect
              x="40"
              y="40"
              width="48"
              height="48"
              rx="15"
              fill="none"
              stroke="url(#ss-violet-grad)"
              strokeWidth="6"
            />
            {/* Viewfinder corner accent */}
            <path
              d="M 79 72 V 79 H 72"
              stroke="#ffffff"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeOpacity="0.95"
            />
          </g>

          {/* ─── Center Sync Shutter Node (100% Transparent Interior) ─── */}
          <circle
            cx="48"
            cy="48"
            r="12"
            fill="none"
            stroke="rgba(255, 255, 255, 0.45)"
            strokeWidth="2.5"
          />

          {/* 4-Point Luminous Shutter Flash Star */}
          <path
            d="M 48 35 Q 48 46 37 48 Q 48 48 48 61 Q 48 50 59 48 Q 48 48 48 35 Z"
            fill="url(#ss-spark-grad)"
          />

          {/* Center pinpoint catchlight */}
          <circle cx="48" cy="48" r="2.5" fill="#ffffff" />
        </svg>
      </div>

      {showText && (
        <span
          style={{
            fontSize: `${textSize}px`,
            fontWeight: 850,
            letterSpacing: '-0.03em',
            lineHeight: 1,
            display: 'inline-flex',
            alignItems: 'baseline',
          }}
        >
          <span style={{ color: '#ffffff' }}>Snap</span>
          <span
            style={{
              background: 'linear-gradient(135deg, #ff5e97 0%, #a855f7 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            Sync
          </span>
        </span>
      )}
    </div>
  );
}
