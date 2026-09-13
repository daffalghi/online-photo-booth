'use client';

import { useState } from 'react';
import { CameraIcon, PaletteIcon, LayoutIcon, DownloadIcon, CopyIcon, CheckIcon, HomeIcon } from './Icons';
import { Participant, Room, RoomStatus } from '@/types';
import { useLanguage } from '@/lib/i18n';
import LanguageSwitcher from './LanguageSwitcher';
import ConfirmModal from './ConfirmModal';
import SnapSyncLogo from './SnapSyncLogo';

interface StepHeaderProps {
  roomCode: string;
  status: RoomStatus;
  participants: Participant[];
  myParticipantId: string;
  room?: Room;
}

export default function StepHeader({ roomCode, status, participants, myParticipantId, room }: StepHeaderProps) {
  const { t } = useLanguage();
  const [copied, setCopied] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);

  const STEPS = [
    { key: 'capturing', stepNum: '1', title: t('step1Title'), desc: t('step1Desc'), icon: CameraIcon },
    { key: 'frame_selection', stepNum: '2', title: t('step2Title'), desc: t('step2Desc'), icon: PaletteIcon },
    { key: 'photo_selection', stepNum: '3', title: t('step3Title'), desc: t('step3Desc'), icon: LayoutIcon },
    { key: 'completed', stepNum: '4', title: t('step4Title'), desc: t('step4Desc'), icon: DownloadIcon },
  ];

  function handleCopyCode() {
    navigator.clipboard.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleLeave() {
    if (status !== 'completed') {
      setShowLeaveModal(true);
    } else {
      window.location.href = '/';
    }
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
    <>
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

          <SnapSyncLogo size={28} showText textSize={15} />

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
            padding: '3px 6px',
            borderRadius: 'var(--radius-full)',
            border: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          {STEPS.map((step, idx) => {
            const isActive = activeIdx === idx;
            const isCompleted = activeIdx > idx;

            return (
              <div
                key={step.key}
                className={isActive ? 'step-item-active' : ''}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: isActive ? '3px 10px' : '3px 6px',
                  borderRadius: 'var(--radius-full)',
                  fontSize: '11.5px',
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
                    flexShrink: 0,
                  }}
                >
                  {isCompleted ? <CheckIcon size={10} color="#ffffff" /> : step.stepNum}
                </div>
                <span className="step-item-title">{step.title}</span>
              </div>
            );
          })}
        </nav>

        {/* Right: Language Switcher */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <LanguageSwitcher />
        </div>
      </div>
    </header>

      <ConfirmModal
        isOpen={showLeaveModal}
        title={t('leaveConfirmTitle')}
        message={t('leaveConfirmDesc')}
        confirmText={t('btnLeave')}
        cancelText={t('btnStay')}
        isDestructive
        onConfirm={() => {
          setShowLeaveModal(false);
          window.location.href = '/';
        }}
        onCancel={() => setShowLeaveModal(false)}
      />
    </>
  );
}

