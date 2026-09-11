'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  CameraIcon,
  ArrowRightIcon,
  UsersIcon,
  DownloadIcon,
  PaletteIcon,
  UserIcon,
  LockIcon,
  CloseIcon,
  GroupPeopleIcon,
} from './Icons';
import { getServerUrl } from '@/lib/config';
import { useLanguage } from '@/lib/i18n';
import LanguageSwitcher from './LanguageSwitcher';
import CreatorCard from './CreatorCard';

export default function LandingPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const [selectedMode, setSelectedMode] = useState<'solo' | 'duo' | 'group'>('solo');
  const [joinCode, setJoinCode] = useState('');
  const [checkingRoom, setCheckingRoom] = useState(false);
  const [mainError, setMainError] = useState('');

  // ─── Modal Create Room State ─────────────────────────────────────────────
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createMode, setCreateMode] = useState<'solo' | 'duo' | 'group'>('solo');
  const [createPin, setCreatePin] = useState('');
  const [createName, setCreateName] = useState('');
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState('');

  // ─── Modal Join Room State ───────────────────────────────────────────────
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [targetJoinCode, setTargetJoinCode] = useState('');
  const [joinPin, setJoinPin] = useState('');
  const [joinName, setJoinName] = useState('');
  const [joinHasPin, setJoinHasPin] = useState(false);
  const [joinModalError, setJoinModalError] = useState('');
  const [joinLoading, setJoinLoading] = useState(false);

  // Open Create Room Modal
  function handleOpenCreateModal(mode: 'solo' | 'duo' | 'group' = selectedMode) {
    setCreateMode(mode);
    setCreatePin('');
    setCreateName('');
    setCreateError('');
    setShowCreateModal(true);
  }

  // Confirm Create Room
  async function handleConfirmCreate() {
    const trimmedName = createName.trim();
    if (!trimmedName) {
      setCreateError(t('nameRequiredError'));
      return;
    }

    let cleanedPin = '';
    if (createMode !== 'solo') {
      cleanedPin = createPin.trim().replace(/[^0-9]/g, '');
      if (cleanedPin.length < 4 || cleanedPin.length > 6) {
        setCreateError(t('pinDigitRule'));
        return;
      }
    }

    setCreateLoading(true);
    setCreateError('');
    try {
      const res = await fetch(`${getServerUrl()}/api/rooms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: createMode,
          shotCount: createMode === 'solo' ? 4 : 3,
          pin: cleanedPin || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal membuat room');

      const roomCode = data.room.code;
      localStorage.setItem(`host_${roomCode}`, '1');
      localStorage.setItem(`name_${roomCode}`, trimmedName);
      if (cleanedPin) {
        localStorage.setItem(`pin_${roomCode}`, cleanedPin);
      }

      setShowCreateModal(false);
      router.push(`/room/${roomCode}`);
    } catch (e: unknown) {
      setCreateError(e instanceof Error ? e.message : 'Gagal membuat room');
    } finally {
      setCreateLoading(false);
    }
  }

  // Check room when joining via 6-digit code
  async function handleJoinCheck() {
    const code = joinCode.trim().toUpperCase();
    if (code.length < 4) {
      setMainError(t('roomCodeInvalidError'));
      return;
    }

    setCheckingRoom(true);
    setMainError('');
    try {
      const res = await fetch(`${getServerUrl()}/api/rooms/${code}`);
      const data = await res.json();
      if (!res.ok || !data.room) {
        throw new Error(data.error || 'Room tidak ditemukan atau telah kedaluwarsa');
      }

      setTargetJoinCode(code);
      setJoinHasPin(Boolean(data.room.hasPin));
      setJoinPin('');
      setJoinName('');
      setJoinModalError('');
      setShowJoinModal(true);
    } catch (err: unknown) {
      setMainError(err instanceof Error ? err.message : 'Gagal memeriksa room');
    } finally {
      setCheckingRoom(false);
    }
  }

  // Confirm Join from Join Modal
  function handleConfirmJoin() {
    const trimmedName = joinName.trim();
    if (!trimmedName) {
      setJoinModalError(t('nameRequiredError'));
      return;
    }

    let cleanedPin = '';
    if (joinHasPin) {
      cleanedPin = joinPin.trim().replace(/[^0-9]/g, '');
      if (cleanedPin.length < 4 || cleanedPin.length > 6) {
        setJoinModalError(t('pinDigitRule'));
        return;
      }
    }

    localStorage.setItem(`name_${targetJoinCode}`, trimmedName);
    if (cleanedPin) {
      localStorage.setItem(`pin_${targetJoinCode}`, cleanedPin);
    }

    setShowJoinModal(false);
    router.push(`/room/${targetJoinCode}`);
  }

  return (
    <main style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 16px', position: 'relative' }}>
      
      {/* Top Navbar with Language Switcher */}
      <div style={{ position: 'absolute', top: '16px', right: '16px', zIndex: 10 }}>
        <LanguageSwitcher />
      </div>

      <div style={{ width: '100%', maxWidth: '680px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '22px', position: 'relative', zIndex: 1 }}>
        
        {/* Brand Header */}
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{
            width: '56px', height: '56px', borderRadius: '16px',
            background: 'linear-gradient(135deg, rgba(255,94,151,0.2), rgba(139,92,246,0.2))',
            border: '1px solid rgba(255,94,151,0.35)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--accent-pink)', marginBottom: '14px',
            boxShadow: '0 0 24px rgba(255,94,151,0.25)'
          }}>
            <CameraIcon size={28} />
          </div>

          <h1 style={{ fontSize: '36px', fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.15 }}>
            Snap<span className="gradient-text">Sync</span>
          </h1>
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginTop: '8px', maxWidth: '520px', lineHeight: 1.5 }}>
            {t('brandSubtitle')}
          </p>
        </div>

        {/* Feature Badges */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
          <span className="badge badge-neutral"><UserIcon size={12} /> {t('badgeSoloDuoGroup')}</span>
          <span className="badge badge-neutral"><LockIcon size={12} /> {t('badgePrivateSecure')}</span>
          <span className="badge badge-neutral"><PaletteIcon size={12} /> {t('badgeVariousFrame')}</span>
          <span className="badge badge-neutral"><DownloadIcon size={12} /> {t('badgeExportHd')}</span>
        </div>

        {/* Mode Selector & Main Action Card */}
        <div className="glass-card" style={{ width: '100%', padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Mode Switcher Tabs (3 Modes) */}
          <div>
            <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '10px', letterSpacing: '0.04em' }}>
              {t('chooseMode')}
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
              {/* Solo Mode Button */}
              <button
                type="button"
                onClick={() => { setSelectedMode('solo'); setMainError(''); }}
                style={{
                  padding: '14px 8px',
                  borderRadius: '12px',
                  border: selectedMode === 'solo' ? '2px solid var(--accent-pink)' : '1px solid var(--border-subtle)',
                  background: selectedMode === 'solo' ? 'rgba(255,94,151,0.12)' : 'rgba(255,255,255,0.02)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                  textAlign: 'center',
                  transition: 'all 0.15s ease',
                  boxShadow: selectedMode === 'solo' ? '0 0 16px rgba(255,94,151,0.2)' : 'none',
                }}
              >
                <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: selectedMode === 'solo' ? 'var(--accent-pink)' : 'rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: selectedMode === 'solo' ? 'white' : 'var(--text-secondary)' }}>
                  <UserIcon size={16} />
                </div>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 800, color: selectedMode === 'solo' ? 'white' : 'var(--text-primary)' }}>
                    {t('modeSolo')}
                  </div>
                  <div style={{ fontSize: '10.5px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                    {t('modeSoloSub')}
                  </div>
                </div>
              </button>

              {/* Duo Mode Button */}
              <button
                type="button"
                onClick={() => { setSelectedMode('duo'); setMainError(''); }}
                style={{
                  padding: '14px 8px',
                  borderRadius: '12px',
                  border: selectedMode === 'duo' ? '2px solid #8b5cf6' : '1px solid var(--border-subtle)',
                  background: selectedMode === 'duo' ? 'rgba(139,92,246,0.12)' : 'rgba(255,255,255,0.02)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                  textAlign: 'center',
                  transition: 'all 0.15s ease',
                  boxShadow: selectedMode === 'duo' ? '0 0 16px rgba(139,92,246,0.2)' : 'none',
                }}
              >
                <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: selectedMode === 'duo' ? '#8b5cf6' : 'rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: selectedMode === 'duo' ? 'white' : 'var(--text-secondary)' }}>
                  <UsersIcon size={16} />
                </div>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 800, color: selectedMode === 'duo' ? 'white' : 'var(--text-primary)' }}>
                    {t('modeDuo')}
                  </div>
                  <div style={{ fontSize: '10.5px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                    {t('modeDuoSub')}
                  </div>
                </div>
              </button>

              {/* Group Mode Button */}
              <button
                type="button"
                onClick={() => { setSelectedMode('group'); setMainError(''); }}
                style={{
                  padding: '14px 8px',
                  borderRadius: '12px',
                  border: selectedMode === 'group' ? '2px solid #06b6d4' : '1px solid var(--border-subtle)',
                  background: selectedMode === 'group' ? 'rgba(6,182,212,0.12)' : 'rgba(255,255,255,0.02)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                  textAlign: 'center',
                  transition: 'all 0.15s ease',
                  boxShadow: selectedMode === 'group' ? '0 0 16px rgba(6,182,212,0.2)' : 'none',
                }}
              >
                <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: selectedMode === 'group' ? '#06b6d4' : 'rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: selectedMode === 'group' ? 'white' : 'var(--text-secondary)' }}>
                  <GroupPeopleIcon size={16} />
                </div>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 800, color: selectedMode === 'group' ? 'white' : 'var(--text-primary)' }}>
                    {t('modeGroup')}
                  </div>
                  <div style={{ fontSize: '10.5px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                    {t('modeGroupSub')}
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* Mode Description Banner */}
          <div style={{
            background: 'rgba(255,255,255,0.025)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: '14px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <div style={{
              width: '32px', height: '32px', borderRadius: '8px',
              background: selectedMode === 'solo' ? 'rgba(255,94,151,0.15)' : selectedMode === 'duo' ? 'rgba(139,92,246,0.15)' : 'rgba(6,182,212,0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: selectedMode === 'solo' ? 'var(--accent-pink)' : selectedMode === 'duo' ? 'var(--accent-violet)' : 'var(--accent-cyan)'
            }}>
              {selectedMode === 'solo' ? <UserIcon size={16} /> : selectedMode === 'duo' ? <UsersIcon size={16} /> : <GroupPeopleIcon size={16} />}
            </div>
            <div>
              <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', display: 'block' }}>
                {selectedMode === 'solo' ? t('modeSolo') : selectedMode === 'duo' ? t('modeDuo') : t('modeGroup')}
              </span>
              <span style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>
                {selectedMode === 'solo' ? t('modeSoloDesc') : selectedMode === 'duo' ? t('modeDuoDesc') : t('modeGroupDesc')}
              </span>
            </div>
          </div>

          {/* Launch Room Button -> Opens Creation Modal */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <button
              className="btn btn-primary btn-lg"
              onClick={() => handleOpenCreateModal(selectedMode)}
              id="create-room-btn"
              style={{
                width: '100%',
                fontSize: '15px',
              }}
            >
              <CameraIcon size={18} /> {selectedMode === 'solo' ? t('btnCreateSolo') : selectedMode === 'duo' ? t('btnCreateDuo') : t('btnCreateGroup')}
            </button>
          </div>

          {/* Join with code separator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ flex: 1, height: '1px', background: 'var(--border-subtle)' }} />
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.06em' }}>{t('orJoinWithCode')}</span>
            <div style={{ flex: 1, height: '1px', background: 'var(--border-subtle)' }} />
          </div>

          {/* Join Room Input */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                className="input"
                id="join-code-input"
                placeholder={t('roomCodePlaceholder')}
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === 'Enter' && handleJoinCheck()}
                maxLength={6}
                style={{ letterSpacing: '0.15em', fontWeight: 800, fontSize: '15px', textAlign: 'center', textTransform: 'uppercase' }}
              />
              <button
                className="btn btn-secondary"
                onClick={handleJoinCheck}
                disabled={checkingRoom}
                id="join-room-btn"
                style={{ padding: '0 20px', flexShrink: 0 }}
              >
                {checkingRoom ? <span className="spinner" /> : <>{t('btnJoin')} <ArrowRightIcon size={16} /></>}
              </button>
            </div>
          </div>

          {mainError && (
            <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 'var(--radius-sm)', color: '#f87171', fontSize: '12.5px', textAlign: 'center' }}>
              {mainError}
            </div>
          )}
        </div>

        {/* 4 Steps How It Works */}
        <div className="glass-card-compact steps-grid-mobile" style={{ width: '100%', padding: '16px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', textAlign: 'center' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
            <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'rgba(255,94,151,0.15)', color: 'var(--accent-pink)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 800 }}>1</div>
            <span style={{ fontSize: '11px', fontWeight: 700 }}>{t('step1Title')}</span>
            <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{t('step1Desc')}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
            <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'rgba(139,92,246,0.15)', color: 'var(--accent-violet)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 800 }}>2</div>
            <span style={{ fontSize: '11px', fontWeight: 700 }}>{t('step2Title')}</span>
            <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{t('step2Desc')}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
            <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'rgba(6,182,212,0.15)', color: 'var(--accent-cyan)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 800 }}>3</div>
            <span style={{ fontSize: '11px', fontWeight: 700 }}>{t('step3Title')}</span>
            <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{t('step3Desc')}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
            <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'rgba(16,185,129,0.15)', color: 'var(--accent-emerald)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 800 }}>4</div>
            <span style={{ fontSize: '11px', fontWeight: 700 }}>{t('step4Title')}</span>
            <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{t('step4Desc')}</span>
          </div>
        </div>

        {/* Creator & Support / Donation Footer */}
        <CreatorCard />

        {/* Footer */}
        <p style={{ color: 'var(--text-muted)', fontSize: '12px', textAlign: 'center' }}>
          {t('footerNotice')}
        </p>
      </div>

      {/* ─── MODAL 1: CREATE ROOM MODAL (PIN -> NAMA) ────────────────────── */}
      {showCreateModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 100,
          background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px'
        }}>
          <div className="glass-card" style={{ width: '100%', maxWidth: '440px', maxHeight: '90dvh', overflowY: 'auto', padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: '18px', border: '1px solid rgba(255,94,151,0.3)', boxShadow: '0 20px 50px rgba(0,0,0,0.85)' }}>
            
            {/* Modal Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(255,94,151,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-pink)' }}>
                  {createMode === 'solo' ? <UserIcon size={18} /> : <LockIcon size={18} />}
                </div>
                <div>
                  <h3 style={{ fontSize: '17px', fontWeight: 800, margin: 0 }}>
                    {createMode === 'solo' ? t('btnCreateSolo') : createMode === 'duo' ? t('btnCreateDuo') : t('btnCreateGroup')}
                  </h3>
                  <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                    {createMode === 'solo' ? t('createRoomModalDescSolo') : t('createRoomModalDesc')}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
              >
                <CloseIcon size={18} />
              </button>
            </div>

            {/* Input 1: PIN Keamanan Room (Only for Duo & Group, strictly 4-6 numeric digits) */}
            {createMode !== 'solo' && (
              <div style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,94,151,0.25)',
                borderRadius: 'var(--radius-md)',
                padding: '14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <label htmlFor="create-room-pin" style={{ fontSize: '12px', fontWeight: 700, color: 'var(--accent-pink)', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <LockIcon size={14} color="var(--accent-pink)" /> {t('pinLabelRequired')}
                  </label>
                  <span style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    color: createPin.length >= 4 ? 'var(--accent-emerald)' : 'var(--text-muted)'
                  }}>
                    {createPin.length}/6 angka {createPin.length >= 4 ? '✓' : '(min. 4)'}
                  </span>
                </div>
                <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4 }}>
                  {t('pinDescription')}
                </p>
                <input
                  id="create-room-pin"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  placeholder={t('pinPlaceholder')}
                  value={createPin}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/[^0-9]/g, '').slice(0, 6);
                    setCreatePin(digits);
                    if (createError) setCreateError('');
                  }}
                  maxLength={6}
                  autoFocus
                  style={{
                    padding: '11px 14px',
                    borderRadius: 'var(--radius-sm)',
                    border: createPin.length >= 4 ? '1px solid var(--accent-emerald)' : '1px solid var(--accent-pink)',
                    background: 'rgba(0, 0, 0, 0.35)',
                    color: 'var(--text-primary)',
                    fontSize: '16px',
                    fontWeight: 800,
                    letterSpacing: '0.18em',
                    textAlign: 'center',
                    outline: 'none',
                  }}
                />
              </div>
            )}

            {/* Input 2: Host Display Name */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label htmlFor="create-host-name" style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--text-primary)', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <UserIcon size={14} color="var(--accent-pink)" /> {t('createRoomHostNameLabel')}
              </label>
              <input
                id="create-host-name"
                type="text"
                placeholder={t('createRoomHostNamePlaceholder')}
                value={createName}
                onChange={(e) => {
                  setCreateName(e.target.value.slice(0, 24));
                  if (createError) setCreateError('');
                }}
                onKeyDown={(e) => e.key === 'Enter' && handleConfirmCreate()}
                maxLength={24}
                autoFocus={createMode === 'solo'}
                style={{
                  padding: '11px 14px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-subtle)',
                  background: 'rgba(255, 255, 255, 0.05)',
                  color: 'var(--text-primary)',
                  fontSize: '14.5px',
                  fontWeight: 600,
                  outline: 'none',
                }}
              />
            </div>

            {createError && (
              <div style={{ padding: '9px 12px', background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 'var(--radius-sm)', color: '#f87171', fontSize: '12px' }}>
                {createError}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '4px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowCreateModal(false)}
                disabled={createLoading}
              >
                {t('btnCancel')}
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleConfirmCreate}
                disabled={createLoading}
                id="confirm-create-room-btn"
              >
                {createLoading ? (
                  <>
                    <span className="spinner" /> {t('btnPreparing')}
                  </>
                ) : (
                  <>
                    <CameraIcon size={16} /> {t('btnCreateNow')}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL 2: JOIN ROOM MODAL (PIN + GUEST NAME) ──────────────────── */}
      {showJoinModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 100,
          background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px'
        }}>
          <div className="glass-card" style={{ width: '100%', maxWidth: '420px', maxHeight: '90dvh', overflowY: 'auto', padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: '16px', border: '1px solid rgba(255,94,151,0.3)', boxShadow: '0 20px 50px rgba(0,0,0,0.85)' }}>
            
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(255,94,151,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-pink)' }}>
                  {joinHasPin ? <LockIcon size={16} /> : <UserIcon size={16} />}
                </div>
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: 800, margin: 0 }}>{t('pinPromptTitle')}</h3>
                  <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                    {t('pinPromptRoomCode')} <strong style={{ color: 'var(--accent-pink)', letterSpacing: '0.1em' }}>{targetJoinCode}</strong>
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowJoinModal(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
              >
                <CloseIcon size={16} />
              </button>
            </div>

            <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
              {joinHasPin ? t('joinRoomModalDesc') : t('joinRoomModalDescNoPin')}
            </p>

            {/* Input 1: PIN Room (Only if room has PIN, strictly 4-6 numeric digits) */}
            {joinHasPin && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <label htmlFor="join-room-pin-input" style={{ fontSize: '12px', fontWeight: 700, color: 'var(--accent-pink)' }}>
                    {t('pinLabelRequired')}
                  </label>
                  <span style={{ fontSize: '11px', color: joinPin.length >= 4 ? 'var(--accent-emerald)' : 'var(--text-muted)' }}>
                    {joinPin.length}/6 angka
                  </span>
                </div>
                <input
                  id="join-room-pin-input"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  placeholder={t('pinPromptPlaceholder')}
                  value={joinPin}
                  onChange={(e) => {
                    setJoinPin(e.target.value.replace(/[^0-9]/g, '').slice(0, 6));
                    if (joinModalError) setJoinModalError('');
                  }}
                  maxLength={6}
                  autoFocus
                  style={{
                    padding: '11px 14px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--accent-pink)',
                    background: 'rgba(255,255,255,0.04)',
                    color: 'white',
                    fontSize: '15px',
                    fontWeight: 700,
                    letterSpacing: '0.15em',
                    textAlign: 'center',
                    outline: 'none',
                  }}
                />
              </div>
            )}

            {/* Input 2: Guest Display Name */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label htmlFor="join-guest-name-input" style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)' }}>
                {t('guestNameLabel')}
              </label>
              <input
                id="join-guest-name-input"
                type="text"
                placeholder={t('guestNamePlaceholder')}
                value={joinName}
                onChange={(e) => {
                  setJoinName(e.target.value.slice(0, 24));
                  if (joinModalError) setJoinModalError('');
                }}
                onKeyDown={(e) => e.key === 'Enter' && handleConfirmJoin()}
                maxLength={24}
                autoFocus={!joinHasPin}
                style={{
                  padding: '11px 14px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-subtle)',
                  background: 'rgba(255,255,255,0.04)',
                  color: 'white',
                  fontSize: '14.5px',
                  fontWeight: 600,
                  outline: 'none',
                }}
              />
            </div>

            {joinModalError && (
              <div style={{ padding: '8px 12px', background: 'rgba(239,68,68,0.15)', borderRadius: 'var(--radius-sm)', color: '#f87171', fontSize: '12px' }}>
                {joinModalError}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '4px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowJoinModal(false)}
                disabled={joinLoading}
              >
                {t('btnCancel')}
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleConfirmJoin}
                disabled={joinLoading}
                id="confirm-join-room-btn"
              >
                {t('btnEnterRoom')} <ArrowRightIcon size={15} />
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
