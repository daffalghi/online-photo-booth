'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  CameraIcon,
  HomeIcon,
  SparklesIcon,
  ArrowRightIcon,
  SearchIcon,
  RefreshCwIcon,
} from '@/components/Icons';

const FUN_TIPS = [
  'Tips: Pastikan pencahayaan terang di depan wajah agar hasil foto makin jernih! 💡',
  'Tahukah kamu? Kamu bisa ganti background kamera dengan pemandangan atau blur estetik! 🌄',
  'Tips: Ajak temanmu pose seru di mode Berdua atau Grup! 👯‍♀️',
  'Filter Classic B&W atau Vintage 90s bakal bikin fotomu serasa foto analog! 🎞️',
  'Jangan lupa senyum sebelum countdown 3 detik berakhir! 📸✨',
];

export default function NotFound() {
  const router = useRouter();
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [showFlash, setShowFlash] = useState(false);
  const [tipIndex, setTipIndex] = useState(0);
  const [clickCount, setClickCount] = useState(0);

  const handleFlashClick = () => {
    setShowFlash(true);
    setClickCount((c) => c + 1);
    setTipIndex((prev) => (prev + 1) % FUN_TIPS.length);
    setTimeout(() => {
      setShowFlash(false);
    }, 450);
  };

  const handleJoinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = roomCodeInput.trim().toUpperCase();
    if (clean.length >= 4) {
      router.push(`/room/${clean}`);
    }
  };

  return (
    <div className="not-found-wrapper">
      {/* Camera Flash Burst Animation */}
      {showFlash && <div className="flash-effect-overlay" />}

      {/* Decorative Glow Ambient Orbs */}
      <div
        style={{
          position: 'absolute',
          top: '15%',
          left: '20%',
          width: '280px',
          height: '280px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(244,63,94,0.15) 0%, transparent 70%)',
          filter: 'blur(40px)',
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: '15%',
          right: '20%',
          width: '320px',
          height: '320px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(139,92,246,0.15) 0%, transparent 70%)',
          filter: 'blur(50px)',
          pointerEvents: 'none',
        }}
      />

      <div className="not-found-card">
        {/* Playful Interactive Polaroid Artwork */}
        <div className="not-found-art-scene" onClick={handleFlashClick} title="Klik polaroid untuk jepret kamera! 📸">
          {/* Background tilted polaroid */}
          <div className="polaroid-frame polaroid-bg-tilt">
            <div
              style={{
                flex: 1,
                background: 'linear-gradient(135deg, #1e293b, #0f172a)',
                borderRadius: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <SparklesIcon size={24} color="#f43f5e" />
            </div>
          </div>

          {/* Main interactive polaroid */}
          <div className="polaroid-frame polaroid-main float-gentle">
            <div className="polaroid-tape" />
            <div className="polaroid-photo-area">
              <CameraIcon size={28} color="#f43f5e" />
              <span
                style={{
                  fontSize: '9px',
                  fontFamily: 'var(--font-display)',
                  fontWeight: 800,
                  color: 'var(--accent-pink)',
                  letterSpacing: '0.5px',
                }}
              >
                FRAME HILANG
              </span>
              <span style={{ fontSize: '7.5px', color: 'var(--text-muted)' }}>Klik Aku! ⚡</span>
            </div>
            <div
              style={{
                marginTop: '6px',
                fontSize: '9.5px',
                fontWeight: 700,
                color: '#334155',
                letterSpacing: '1px',
                textAlign: 'center',
              }}
            >
              404 • NO SHOT
            </div>
          </div>
        </div>

        {/* Status Badge */}
        <div style={{ marginBottom: '12px' }}>
          <span
            className="badge badge-pink"
            style={{
              padding: '4px 12px',
              fontSize: '11px',
              fontWeight: 700,
              letterSpacing: '0.8px',
              textTransform: 'uppercase',
            }}
          >
            📸 404 • Halaman Tidak Ditemukan
          </span>
        </div>

        {/* Headline */}
        <h1
          style={{
            fontSize: 'clamp(22px, 5vw, 26px)',
            fontWeight: 800,
            lineHeight: 1.25,
            marginBottom: '10px',
            fontFamily: 'var(--font-display)',
            letterSpacing: '-0.5px',
          }}
        >
          Oops! Frame Ini Hilang dari Roll Film
        </h1>

        {/* Description */}
        <p
          style={{
            fontSize: '13.5px',
            color: 'var(--text-secondary)',
            lineHeight: 1.6,
            marginBottom: '6px',
            maxWidth: '380px',
          }}
        >
          Halaman atau sesi photobooth yang kamu cari tidak ada, sudah kedaluwarsa, atau mungkin alamat URL-nya salah ketik.
        </p>

        {/* Interactive Tip Bubble */}
        <div
          onClick={handleFlashClick}
          style={{
            margin: '12px 0 6px',
            padding: '8px 14px',
            background: 'rgba(244, 63, 94, 0.08)',
            border: '1px solid rgba(244, 63, 94, 0.2)',
            borderRadius: 'var(--radius-full)',
            fontSize: '11.5px',
            color: '#fda4af',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            transition: 'all 0.2s ease',
          }}
          title="Klik untuk tips lainnya!"
        >
          <SparklesIcon size={13} color="#f43f5e" />
          <span>{FUN_TIPS[tipIndex]}</span>
        </div>

        {/* Quick Join Room Input (in case they mistyped room code in URL) */}
        <div className="not-found-quick-join">
          <label
            htmlFor="quick-room-code"
            style={{
              fontSize: '11.5px',
              fontWeight: 600,
              color: 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
            }}
          >
            <SearchIcon size={12} color="var(--accent-pink)" />
            Punya Kode Room 6 Digit? Langsung Gabung:
          </label>
          <form onSubmit={handleJoinSubmit} className="quick-join-input-group">
            <input
              id="quick-room-code"
              type="text"
              maxLength={6}
              value={roomCodeInput}
              onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase())}
              placeholder="Contoh: AB12CD"
              className="quick-join-input"
            />
            <button
              type="submit"
              disabled={roomCodeInput.trim().length < 4}
              className="btn btn-primary btn-sm"
              style={{ padding: '0 16px', borderRadius: 'var(--radius-md)', whiteSpace: 'nowrap' }}
            >
              Masuk <ArrowRightIcon size={13} />
            </button>
          </form>
        </div>

        {/* Navigation Action Buttons */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
            width: '100%',
            flexWrap: 'wrap',
          }}
        >
          <Link
            href="/"
            className="btn btn-primary"
            style={{
              flex: '1 1 180px',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              fontWeight: 700,
            }}
          >
            <HomeIcon size={16} /> Ke Beranda Utama
          </Link>

          <button
            type="button"
            onClick={handleFlashClick}
            className="btn btn-secondary"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
            }}
            title="Nyalakan efek kilau flash kamera"
          >
            <CameraIcon size={15} /> Flash Jepret! {clickCount > 0 && `(${clickCount})`}
          </button>
        </div>

        {/* Footer tiny branding */}
        <div style={{ marginTop: '22px', fontSize: '11px', color: 'var(--text-muted)' }}>
          Online Photo Booth • Abadikan Momen Bersama
        </div>
      </div>
    </div>
  );
}
