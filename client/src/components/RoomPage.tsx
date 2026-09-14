'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { connectSocket, disconnectSocket, getSocket } from '@/lib/socket';
import { stopLocalStream, stopVideoOnly, closePeerConnection } from '@/lib/webrtc';
import {
  FrameLockedPayload, PairedShot, Participant, Room,
  RoomStatePayload, RenderReadyPayload, VoteStatus, VoteStatusPayload
} from '@/types';
import Lobby from './Lobby';
import CapturePhase from './CapturePhase';
import PhotoSelection from './PhotoSelection';
import FrameSelection from './FrameSelection';
import ResultPage from './ResultPage';
import StepHeader from './StepHeader';
import RoomChat from './RoomChat';
import { CameraIcon, UserIcon, InfoIcon, HomeIcon, LockIcon, SearchIcon, SparklesIcon, ArrowRightIcon, CheckIcon } from './Icons';
import { resolveMediaUrl, getServerUrl } from '@/lib/config';
import { useLanguage } from '@/lib/i18n';
import LanguageSwitcher from './LanguageSwitcher';
import ConnectionBanner from './ConnectionBanner';
import SnapSyncLogo from './SnapSyncLogo';

interface RoomPageProps {
  code: string;
}

type AppPhase = 'loading' | 'name_entry' | 'lobby' | 'capturing' | 'photo_selection' | 'frame_selection' | 'rendering' | 'completed' | 'error' | 'destroyed';

export default function RoomPage({ code }: RoomPageProps) {
  const router = useRouter();
  const { t } = useLanguage();
  const [phase, setPhase] = useState<AppPhase>('loading');
  const [destroyedMessage, setDestroyedMessage] = useState('');
  const [room, setRoom] = useState<Room | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [slots, setSlots] = useState<PairedShot[]>([]);
  const [myParticipantId, setMyParticipantId] = useState('');
  const [sessionToken, setSessionToken] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [hasPin, setHasPin] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [votes, setVotes] = useState<VoteStatus[]>([]);
  const [downloadUrlPng, setDownloadUrlPng] = useState('');
  const [lockedFrameId, setLockedFrameId] = useState('');
  const [lockedCustomization, setLockedCustomization] = useState<{ accentColor?: string; captionText?: string }>({});
  const [error, setError] = useState('');
  const [takingLong, setTakingLong] = useState(false);
  const [retryCodeInput, setRetryCodeInput] = useState('');
  const [showFlash, setShowFlash] = useState(false);
  const joinedRef = useRef(false);

  // Smart media lifecycle: turn off physical camera sensor/LED during frame & photo selection,
  // while keeping microphone audio live so friends can discuss in Duo/Group mode.
  useEffect(() => {
    if (phase === 'frame_selection' || phase === 'photo_selection') {
      stopVideoOnly();
    } else if (phase !== 'capturing') {
      stopLocalStream();
    }
  }, [phase]);

  // Monitor loading timeout
  useEffect(() => {
    if (phase !== 'loading') {
      setTakingLong(false);
      return;
    }
    const timer = setTimeout(() => {
      setTakingLong(true);
    }, 4000);
    return () => clearTimeout(timer);
  }, [phase]);

  // Unified Room Init & Socket Connection
  useEffect(() => {
    let active = true;
    const socket = connectSocket();

    const onRoomState = (payload: RoomStatePayload) => {
      if (!active || !payload.room) return;
      setRoom(payload.room);
      setParticipants(payload.participants);

      const normalizedSlots = (payload.slots || []).map((s) => ({
        ...s,
        leftPhotoUrl: resolveMediaUrl(s.leftPhotoUrl),
        rightPhotoUrl: resolveMediaUrl(s.rightPhotoUrl),
        photos: (s.photos || []).map((p) => ({
          ...p,
          url: resolveMediaUrl(p.url),
        })),
      }));
      setSlots(normalizedSlots);

      if (payload.votes && payload.votes.length > 0) {
        setVotes(payload.votes);
      }
      if (payload.downloadUrlPng) {
        setDownloadUrlPng(resolveMediaUrl(payload.downloadUrlPng));
      }

      const selectedFrame = payload.room.settings?.selectedFrameTemplateId;
      if (selectedFrame) {
        setLockedFrameId(selectedFrame);
      }
      if (payload.room.settings?.customization) {
        setLockedCustomization(payload.room.settings.customization);
      }

      if (payload.myParticipantId) {
        setMyParticipantId(payload.myParticipantId);
      }
      if (payload.sessionToken) {
        setSessionToken(payload.sessionToken);
        localStorage.setItem(`token_${code}`, payload.sessionToken);
      }

      const status = payload.room.status;
      if (status === 'lobby') setPhase('lobby');
      else if (status === 'capturing') setPhase('capturing');
      else if (status === 'photo_selection') setPhase('photo_selection');
      else if (status === 'frame_selection') setPhase('frame_selection');
      else if (status === 'rendering') setPhase('rendering');
      else if (status === 'completed') setPhase('completed');
    };

    const onError = ({ message, code: errCode }: { message: string; code?: string }) => {
      if (!active) return;
      setError(message);
      if (errCode === 'INVALID_PIN') {
        joinedRef.current = false;
        setPhase('name_entry');
      } else if (errCode === 'ROOM_NOT_FOUND' || errCode === 'ROOM_FULL') {
        setPhase('error');
      }
    };

    socket.on('room:state', onRoomState);
    socket.on('frame:voteStatus', (payload: VoteStatusPayload) => {
      if (active) setVotes(payload.votes);
    });
    socket.on('frame:locked', (payload: FrameLockedPayload) => {
      if (!active) return;
      setLockedFrameId(payload.frameTemplateId);
      setLockedCustomization(payload.customization);
      setPhase('photo_selection');
    });
    socket.on('render:ready', (payload: RenderReadyPayload) => {
      if (!active) return;
      setDownloadUrlPng(resolveMediaUrl(payload.downloadUrlPng));
      setPhase('completed');
    });
    socket.on('error', onError);
    socket.on('room:destroyed', ({ message }: { message?: string }) => {
      if (!active) return;
      stopLocalStream();
      setDestroyedMessage(message || 'Seluruh data sesi, foto, dan histori telah dihapus secara permanen dari server.');
      setPhase('destroyed');
    });

    async function initRoomAndJoin() {
      try {
        const res = await fetch(`${getServerUrl()}/api/rooms/${code}`);
        if (!active) return;

        if (!res.ok) {
          setError(`Room "${code}" tidak ditemukan atau masa berlakunya telah berakhir.`);
          setPhase('error');
          return;
        }

        const data = await res.json();
        const roomRequiresPin = Boolean(data.room?.hasPin);
        if (roomRequiresPin) {
          setHasPin(true);
        }

        const existingToken = localStorage.getItem(`token_${code}`);
        const existingName = localStorage.getItem(`name_${code}`);
        const existingPin = localStorage.getItem(`pin_${code}`) || '';
        const isRoomSolo = data.room?.capacity === 1 || data.room?.settings?.mode === 'solo';
        const effectiveName = existingName || (isRoomSolo ? 'Solo' : '');

        // If we already have the name (or it is solo mode) and valid PIN if required:
        if (effectiveName && (!roomRequiresPin || existingPin.trim().length >= 4)) {
          setDisplayName(effectiveName);
          setNameInput(effectiveName);
          if (existingPin) setPinInput(existingPin);

          const emitJoin = () => {
            if (!active) return;
            joinedRef.current = true;
            socket.emit('room:join', {
              roomCode: code,
              displayName: effectiveName,
              sessionToken: existingToken || undefined,
              pin: existingPin.trim() || undefined,
            });
          };

          if (socket.connected) {
            emitJoin();
          } else {
            socket.once('connect', emitJoin);
          }
        } else {
          setPhase('name_entry');
        }
      } catch (err) {
        console.error('Room init error:', err);
        if (active) setPhase('name_entry');
      }
    }

    initRoomAndJoin();

    return () => {
      active = false;
      socket.off('room:state', onRoomState);
      socket.off('error', onError);
      disconnectSocket();
      stopLocalStream();
      closePeerConnection();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  function handleJoin() {
    const name = nameInput.trim();
    if (!name) { setError(t('nameRequiredError')); return; }
    
    let cleanedPin = '';
    if (hasPin) {
      cleanedPin = pinInput.trim().replace(/[^0-9]/g, '');
      if (cleanedPin.length < 4 || cleanedPin.length > 6) {
        setError(t('pinDigitRule'));
        return;
      }
    }

    setDisplayName(name);
    localStorage.setItem(`name_${code}`, name);
    if (cleanedPin) {
      localStorage.setItem(`pin_${code}`, cleanedPin);
    }
    setError('');
    setPhase('loading');

    const socket = connectSocket();
    const token = localStorage.getItem(`token_${code}`) || undefined;

    const emitJoin = () => {
      joinedRef.current = true;
      socket.emit('room:join', {
        roomCode: code,
        displayName: name,
        sessionToken: token,
        pin: cleanedPin || undefined,
      });
    };

    if (socket.connected) {
      emitJoin();
    } else {
      socket.once('connect', emitJoin);
    }
  }


  // Ordered slots based on selection
  const selectedOrder = room?.settings?.selectedPhotoOrder;
  const orderedSlots: PairedShot[] = (selectedOrder && selectedOrder.length > 0)
    ? selectedOrder
        .map((val: number | string, newIdx: number) => {
          const numIdx = typeof val === 'number' ? val : parseInt(String(val).split('_')[0], 10);
          const match = !isNaN(numIdx) ? slots.find((s) => s.slotIndex === numIdx) : null;
          return match ? { ...match, slotIndex: newIdx } : null;
        })
        .filter(Boolean) as PairedShot[]
    : slots;

  // ─── Render Phases ────────────────────────────────────────────────────
  if (phase === 'name_entry') {
    return (
      <main style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 16px', position: 'relative' }}>
        <ConnectionBanner />
        <div style={{ position: 'absolute', top: '16px', right: '16px', zIndex: 10 }}>
          <LanguageSwitcher />
        </div>
        <div style={{ width: '100%', maxWidth: '400px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{
              width: '48px', height: '48px', borderRadius: '14px',
              background: 'rgba(255,94,151,0.15)', border: '1px solid rgba(255,94,151,0.3)',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--accent-pink)', marginBottom: '12px',
            }}>
              <UserIcon size={24} />
            </div>
            <h1 style={{ fontSize: '26px', fontWeight: 800 }}>
              {t('nameEntryTitle')}
            </h1>
            <p style={{ color: 'var(--text-secondary)', marginTop: '4px', fontSize: '13px' }}>
              Kode Room: <span style={{ fontFamily: 'monospace', fontWeight: 800, color: 'var(--accent-pink)', fontSize: '16px' }}>{code}</span>
            </p>
          </div>

          <div className="glass-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ fontSize: '12.5px', color: 'var(--text-muted)', display: 'block', marginBottom: '6px', fontWeight: 600 }}>{t('nameEntryLabel')}</label>
              <input
                className="input"
                id="display-name-input"
                placeholder={t('nameEntryPlaceholder')}
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
                maxLength={24}
                autoFocus
                style={{ fontSize: '15px', textAlign: 'center', fontWeight: 600 }}
              />
            </div>

            {hasPin && (
              <div>
                <label style={{ fontSize: '12.5px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '6px', fontWeight: 600 }}>
                  <LockIcon size={13} color="var(--accent-pink)" /> {t('nameEntryPinLabel')}
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  className="input"
                  id="room-pin-input"
                  placeholder={t('pinPlaceholder')}
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
                  onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
                  maxLength={6}
                  style={{ fontSize: '15px', textAlign: 'center', fontWeight: 700, letterSpacing: '0.15em' }}
                />
              </div>
            )}

            {error && (
              <div style={{ color: '#f87171', fontSize: '12.5px', textAlign: 'center' }}>{error}</div>
            )}
            <button
              className="btn btn-primary btn-lg"
              style={{ width: '100%', fontSize: '15px' }}
              onClick={handleJoin}
              id="join-room-confirm-btn"
            >
              <CameraIcon size={18} /> {t('btnEnterRoomConfirm')}
            </button>
          </div>
        </div>
      </main>
    );
  }

  if (phase === 'loading') {
    return (
      <main style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '20px', padding: '24px', position: 'relative' }}>
        <ConnectionBanner />
        <SnapSyncLogo size={72} />
        <div className="spinner" style={{ width: '40px', height: '40px', borderWidth: '3.5px' }} />
        <div style={{ textAlign: 'center', maxWidth: '380px' }}>
          <p style={{ fontWeight: 800, fontSize: '16px', color: 'var(--text-primary)', margin: '0 0 6px 0' }}>
            {t('connectingRoom', { code })}
          </p>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: 0, lineHeight: 1.5 }}>
            {takingLong ? t('connectingTakingLong') : t('connectingWaitHelp')}
          </p>
        </div>

        {takingLong && (
          <div style={{ display: 'flex', gap: '10px', marginTop: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => {
                joinedRef.current = false;
                setPhase('name_entry');
              }}
              id="btn-manual-entry"
            >
              {t('btnManualEntry')}
            </button>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => {
                joinedRef.current = false;
                setTakingLong(false);
                const socket = connectSocket();
                const name = localStorage.getItem(`name_${code}`) || displayName;
                const token = localStorage.getItem(`token_${code}`) || sessionToken;
                const pin = localStorage.getItem(`pin_${code}`) || pinInput;
                if (name) {
                  socket.emit('room:join', {
                    roomCode: code,
                    displayName: name,
                    sessionToken: token || undefined,
                    pin: pin || undefined,
                  });
                } else {
                  setPhase('name_entry');
                }
              }}
              id="btn-retry-conn"
            >
              {t('btnRetry')}
            </button>
            <a href="/" className="btn btn-ghost btn-sm" id="btn-back-home">
              {t('btnLeave')}
            </a>
          </div>
        )}
      </main>
    );
  }

  if (phase === 'error' || !room) {
    const triggerFlash = () => {
      setShowFlash(true);
      setTimeout(() => setShowFlash(false), 450);
    };

    const handleRetrySubmit = (e: React.FormEvent) => {
      e.preventDefault();
      const clean = retryCodeInput.trim().toUpperCase();
      if (clean.length >= 4) {
        window.location.href = `/room/${clean}`;
      }
    };

    return (
      <main className="not-found-wrapper">
        {showFlash && <div className="flash-effect-overlay" />}

        {/* Ambient Glow Orbs */}
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
          {/* Interactive Polaroid Artwork */}
          <div className="not-found-art-scene" onClick={triggerFlash} title="Klik polaroid untuk jepret kamera! 📸">
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
                  ROOM HILANG
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
                KODE: {code}
              </div>
            </div>
          </div>

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
              🔒 Sesi Tidak Ditemukan
            </span>
          </div>

          <h2
            style={{
              fontSize: 'clamp(20px, 4.5vw, 24px)',
              fontWeight: 800,
              lineHeight: 1.25,
              marginBottom: '10px',
              fontFamily: 'var(--font-display)',
              letterSpacing: '-0.5px',
            }}
          >
            Room &ldquo;{code}&rdquo; Tidak Ditemukan
          </h2>

          <p
            style={{
              color: 'var(--text-secondary)',
              fontSize: '13.5px',
              lineHeight: 1.6,
              marginBottom: '6px',
              maxWidth: '380px',
            }}
          >
            {error || `Room "${code}" tidak ditemukan atau masa berlakunya telah berakhir (maksimal 2 jam demi privasi).`}
          </p>

          {/* Quick Room Code Re-try Form */}
          <div className="not-found-quick-join">
            <label
              htmlFor="retry-room-code"
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
              Coba Masukkan Ulang Kode Room:
            </label>
            <form onSubmit={handleRetrySubmit} className="quick-join-input-group">
              <input
                id="retry-room-code"
                type="text"
                maxLength={6}
                value={retryCodeInput}
                onChange={(e) => setRetryCodeInput(e.target.value.toUpperCase())}
                placeholder="Contoh: AB12CD"
                className="quick-join-input"
              />
              <button
                type="submit"
                disabled={retryCodeInput.trim().length < 4}
                className="btn btn-primary btn-sm"
                style={{ padding: '0 16px', borderRadius: 'var(--radius-md)', whiteSpace: 'nowrap' }}
              >
                Masuk <ArrowRightIcon size={13} />
              </button>
            </form>
          </div>

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
            <a
              href="/"
              className="btn btn-primary"
              id="home-btn"
              style={{
                flex: '1 1 180px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                fontWeight: 700,
              }}
            >
              <HomeIcon size={16} /> Kembali ke Beranda
            </a>

            <button
              type="button"
              onClick={triggerFlash}
              className="btn btn-secondary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
              }}
            >
              <CameraIcon size={15} /> Flash Kamera ⚡
            </button>
          </div>

          <div style={{ marginTop: '22px', fontSize: '11px', color: 'var(--text-muted)' }}>
            Online Photo Booth • Abadikan Momen Bersama
          </div>
        </div>
      </main>
    );
  }

  if (phase === 'destroyed') {
    return (
      <main className="not-found-wrapper">
        <div className="not-found-card" style={{ maxWidth: '480px', padding: '36px 26px', textAlign: 'center' }}>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            background: 'rgba(16, 185, 129, 0.15)',
            border: '2px solid var(--accent-green)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--accent-green)',
            margin: '0 auto 16px auto',
          }}>
            <CheckIcon size={32} />
          </div>
          <h2 style={{ fontSize: '22px', fontWeight: 800, marginBottom: '8px', color: 'white' }}>
            Sesi Telah Dihapus Permanen
          </h2>
          <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', lineHeight: '1.6', marginBottom: '24px' }}>
            {destroyedMessage || 'Seluruh data sesi, file foto capture, dan histori ruangan telah dibersihkan secara permanen dari server demi privasi Anda.'}
          </p>
          <a
            href="/"
            className="btn btn-primary"
            id="destroyed-home-btn"
            style={{
              width: '100%',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              fontWeight: 700,
              padding: '12px 20px',
              background: 'linear-gradient(135deg, #10b981, #059669)',
              border: 'none',
            }}
          >
            <HomeIcon size={18} /> Kembali ke Beranda
          </a>
          <div style={{ marginTop: '18px', fontSize: '11px', color: 'var(--text-muted)' }}>
            Privasi Terjamin • Semua file sesi telah dimusnahkan
          </div>
        </div>
      </main>
    );
  }

  function renderPhaseContent() {
    if (!room) return null;

    if (phase === 'lobby') {
      return (
        <Lobby
          room={room}
          participants={participants}
          myParticipantId={myParticipantId}
          onStart={() => setPhase('capturing')}
        />
      );
    }

    if (phase === 'capturing') {
      return (
        <>
          <StepHeader roomCode={code} status={room.status} participants={participants} myParticipantId={myParticipantId} room={room} />
          <CapturePhase
            room={room}
            participants={participants}
            myParticipantId={myParticipantId}
            slots={slots}
            socket={getSocket()}
          />
        </>
      );
    }

    if (phase === 'frame_selection') {
      return (
        <>
          <StepHeader roomCode={code} status={room.status} participants={participants} myParticipantId={myParticipantId} room={room} />
          <FrameSelection
            room={room}
            participants={participants}
            myParticipantId={myParticipantId}
            slots={orderedSlots}
            votes={votes}
            socket={getSocket()}
          />
        </>
      );
    }

    if (phase === 'photo_selection') {
      return (
        <>
          <StepHeader roomCode={code} status={room.status} participants={participants} myParticipantId={myParticipantId} room={room} />
          <PhotoSelection
            room={room}
            participants={participants}
            myParticipantId={myParticipantId}
            slots={slots}
            socket={getSocket()}
            frameTemplateId={lockedFrameId || room.settings?.selectedFrameTemplateId || room.settings?.layout}
            customization={lockedCustomization}
          />
        </>
      );
    }

    if (phase === 'rendering') {
      return (
        <main style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
          <div className="spinner" style={{ width: '32px', height: '32px', borderWidth: '3px' }} />
          <h2 style={{ fontSize: '20px', fontWeight: 700 }}>
            <span className="gradient-text">Generating Final Photo Strip…</span>
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Compositing split camera frames into high-resolution layout</p>
        </main>
      );
    }

    if (phase === 'completed') {
      return (
        <>
          <StepHeader roomCode={code} status={room.status} participants={participants} myParticipantId={myParticipantId} room={room} />
          <ResultPage
            room={room}
            participants={participants}
            slots={orderedSlots}
            downloadUrlPng={downloadUrlPng}
            frameTemplateId={lockedFrameId || room.settings?.selectedFrameTemplateId || room.settings?.layout}
            customization={lockedCustomization}
            socket={getSocket()}
          />
        </>
      );
    }

    return null;
  }

  const phaseContent = renderPhaseContent();
  if (!phaseContent) return null;

  return (
    <>
      <ConnectionBanner />
      {phaseContent}
      {room && room.capacity > 1 && room.settings?.mode !== 'solo' && (
        <RoomChat
          room={room}
          participants={participants}
          myParticipantId={myParticipantId}
          socket={getSocket()}
        />
      )}
    </>
  );
}
