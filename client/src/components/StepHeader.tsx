'use client';

import { useState } from 'react';
import { CameraIcon, PaletteIcon, LayoutIcon, SparklesIcon, CopyIcon, CheckIcon, HomeIcon, UsersIcon } from './Icons';
import { Participant, RoomStatus } from '@/types';

interface StepHeaderProps {
  roomCode: string;
  status: RoomStatus;
  participants: Participant[];
  myParticipantId: string;
}

const STEPS = [
  { key: 'capturing', stepNum: '1', title: 'Shoot', desc: 'Ambil Foto', icon: CameraIcon },
  { key: 'frame_selection', stepNum: '2', title: 'Frame', desc: 'Pilih Frame', icon: PaletteIcon },
  { key: 'photo_selection', stepNum: '3', title: 'Place', desc: 'Atur Posisi', icon: LayoutIcon },
  { key: 'completed', stepNum: '4', title: 'Finish', desc: 'Selesai', icon: SparklesIcon },
];

export default function StepHeader({ roomCode, status, participants, myParticipantId }: StepHeaderProps) {
  const [copied, setCopied] = useState(false);

  const me = participants.find((p) => p.id === myParticipantId);
  const partner = participants.find((p) => p.id !== myParticipantId);

  function handleCopyCode() {
    navigator.clipboard.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleLeave() {
    if (status !== 'completed') {
      if (!confirm('Apakah kamu yakin ingin keluar dari photobooth? Sesi yang berjalan akan dibatalkan.')) {
        return;
      }
    }
    window.location.href = '/';
  }

  // Determine active step index
  const getActiveIndex = () => {
    switch (status) {
      case 'lobby': return -1;
      case 'capturing': return 0;
      case 'frame_selection': return 1;
      case 'photo_selection': return 2;
      case 'rendering':
      case 'completed': return 3;
      default: return 0;
    }
  };

  const activeIdx = getActiveIndex();

  if (status === 'lobby' || status === 'expired') return null;

  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        backgroundColor: 'rgba(9, 10, 15, 0.88)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        padding: '8px 16px',
        marginBottom: '12px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
      }}
    >
      <div
        style={{
          maxWidth: '1200px',
          margin: '0 auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          flexWrap: 'wrap',
        }}
      >
        {/* Left: Branding & Room Code */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={handleLeave}
            className="btn btn-ghost btn-icon"
            style={{ padding: '6px', color: 'var(--text-muted)' }}
            title="Keluar / Ke Halaman Utama"
          >
            <HomeIcon size={16} />
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div
              style={{
                width: '26px',
                height: '26px',
                borderRadius: '8px',
                background: 'linear-gradient(135deg, #ff5e97, #8b5cf6)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 10px rgba(255,94,151,0.4)',
              }}
            >
              <CameraIcon size={14} color="white" />
            </div>
            <span style={{ fontWeight: 800, fontSize: '15px', letterSpacing: '-0.02em' }}>
              <span className="gradient-text">SnapSync</span>
            </span>
          </div>

          {/* Room Code Badge with Copy */}
          <button
            onClick={handleCopyCode}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 10px',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 'var(--radius-full)',
              color: 'var(--text-secondary)',
              fontSize: '11.5px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
            title="Klik untuk salin kode room"
          >
            <span>Room: <strong style={{ color: 'white', fontFamily: 'monospace', letterSpacing: '0.05em' }}>{roomCode}</strong></span>
            {copied ? <CheckIcon size={12} color="#10b981" /> : <CopyIcon size={12} />}
          </button>
        </div>

        {/* Center: Phase Stepper Progress */}
        <nav
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            background: 'rgba(255,255,255,0.03)',
            padding: '4px 6px',
            borderRadius: 'var(--radius-full)',
            border: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          {STEPS.map((step, idx) => {
            const Icon = step.icon;
            const isActive = activeIdx === idx;
            const isCompleted = activeIdx > idx;

            return (
              <div
                key={step.key}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '4px 10px',
                  borderRadius: 'var(--radius-full)',
                  fontSize: '12px',
                  fontWeight: isActive ? 700 : 500,
                  color: isActive ? '#ffffff' : isCompleted ? '#34d399' : 'var(--text-muted)',
                  backgroundColor: isActive ? 'rgba(255, 94, 151, 0.22)' : 'transparent',
                  border: isActive ? '1px solid rgba(255, 94, 151, 0.45)' : '1px solid transparent',
                  transition: 'all 0.2s ease',
                }}
              >
                <div
                  style={{
                    width: '18px',
                    height: '18px',
                    borderRadius: '50%',
                    backgroundColor: isActive
                      ? 'var(--accent-pink)'
                      : isCompleted
                      ? '#10b981'
                      : 'rgba(255,255,255,0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '10px',
                    fontWeight: 800,
                    color: '#ffffff',
                  }}
                >
                  {isCompleted ? <CheckIcon size={10} color="#ffffff" /> : step.stepNum}
                </div>
                <span>{step.title}</span>
              </div>
            );
          })}
        </nav>

        {/* Right: Partner Connection Status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {partner ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 10px',
                background: 'rgba(255,255,255,0.03)',
                borderRadius: 'var(--radius-full)',
                border: '1px solid rgba(255,255,255,0.08)',
                fontSize: '11.5px',
              }}
            >
              <div
                style={{
                  width: '7px',
                  height: '7px',
                  borderRadius: '50%',
                  backgroundColor: partner.connectionStatus === 'connected' ? '#10b981' : '#f59e0b',
                  boxShadow: partner.connectionStatus === 'connected' ? '0 0 8px #10b981' : 'none',
                }}
              />
              <span style={{ color: 'var(--text-secondary)' }}>
                {partner.displayName}
              </span>
            </div>
          ) : (
            <span className="badge badge-neutral" style={{ fontSize: '11px' }}>
              <UsersIcon size={11} /> Menunggu Partner
            </span>
          )}
        </div>
      </div>
    </header>
  );
}

