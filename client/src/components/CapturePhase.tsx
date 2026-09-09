'use client';

import { useEffect, useRef, useState } from 'react';
import { Socket } from 'socket.io-client';
import { PairedShot, Participant, Room, RoundStatus } from '@/types';
import { captureFrame, FilterType } from '@/lib/capture';
import { getLocalStream, createPeerConnection, handleWebRTCSignal, setRemoteStreamCallback } from '@/lib/webrtc';
import { CameraIcon, CheckIcon, RefreshCwIcon, PlusIcon, SparklesIcon, SlidersIcon, ClockIcon, ArrowRightIcon, UserIcon } from './Icons';

const MAX_SHOTS = 10;

const FILTERS: { id: FilterType; label: string }[] = [
  { id: 'none', label: 'Normal' },
  { id: 'bw', label: 'B&W' },
  { id: 'warm', label: 'Warm' },
  { id: 'vivid', label: 'Vivid' },
  { id: 'cool', label: 'Cool' },
];

const FILTER_CSS: Record<FilterType, string> = {
  none: '',
  bw: 'grayscale(100%)',
  warm: 'sepia(40%) saturate(120%) brightness(105%)',
  vivid: 'saturate(180%) contrast(110%)',
  cool: 'hue-rotate(20deg) saturate(80%) brightness(105%)',
};

interface CapturePhaseProps {
  room: Room;
  participants: Participant[];
  myParticipantId: string;
  slots: PairedShot[];
  socket: Socket;
}

export default function CapturePhase({ room, participants, myParticipantId, slots, socket }: CapturePhaseProps) {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const [filter, setFilter] = useState<FilterType>('none');
  const [countdown, setCountdown] = useState<number | null>(null);
  const [countdownKey, setCountdownKey] = useState(0);
  const [showFlash, setShowFlash] = useState(false);
  const [iAmReady, setIAmReady] = useState(false);
  const [readyParticipantIds, setReadyParticipantIds] = useState<string[]>([]);
  const [localKeepStatus, setLocalKeepStatus] = useState<string[]>([]);
  const [iFinished, setIFinished] = useState(false);
  const [finishedParticipantIds, setFinishedParticipantIds] = useState<string[]>([]);
  const [camError, setCamError] = useState('');
  const [remoteConnected, setRemoteConnected] = useState(false);
  const [cameraAspect, setCameraAspect] = useState<string>('16/9');
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const captureTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isSolo = room.capacity === 1 || room.settings?.mode === 'solo';
  const me = participants.find((p) => p.id === myParticipantId);
  const partner = participants.find((p) => p.id !== myParticipantId);
  const slotIndex = room.currentRoundIndex;
  const roundStatus: RoundStatus = room.currentRoundStatus;

  const lockedSlots = slots.filter((s) => s.status === 'locked');
  const currentSlot = slots.find((s) => s.slotIndex === slotIndex);
  const keepStatus = Array.from(new Set([...localKeepStatus, ...(currentSlot?.keptByParticipantIds ?? [])]));
  const iHaveKept = keepStatus.includes(myParticipantId);
  const canTakeMore = lockedSlots.length < MAX_SHOTS;

  const handleVideoMetadata = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const v = e.currentTarget;
    if (v.videoWidth > 0 && v.videoHeight > 0) {
      setCameraAspect(`${v.videoWidth}/${v.videoHeight}`);
    }
  };

  // ─── Camera Setup ──────────────────────────────────────────────────────────
  useEffect(() => {
    let mounted = true;
    getLocalStream()
      .then((stream) => {
        if (!mounted || !localVideoRef.current) return;
        localVideoRef.current.srcObject = stream;
        const track = stream.getVideoTracks()[0];
        if (track) {
          const settings = track.getSettings();
          if (settings.width && settings.height) {
            setCameraAspect(`${settings.width}/${settings.height}`);
          }
        }
      })
      .catch((err) => {
        setCamError(
          err.name === 'NotAllowedError'
            ? 'Izin kamera ditolak. Mohon aktifkan akses kamera pada browser lalu muat ulang.'
            : 'Tidak dapat memulai kamera: ' + err.message,
        );
      });
    return () => { mounted = false; };
  }, []);

  // ─── WebRTC (Only needed for Duo mode) ──────────────────────────────────────
  useEffect(() => {
    if (isSolo) return;

    const isInitiator = me?.side === 'left';

    setRemoteStreamCallback((stream) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = stream;
        setRemoteConnected(true);
      }
    });

    getLocalStream().then((stream) => {
      if (stream) createPeerConnection(room.id, myParticipantId, isInitiator);
    }).catch(console.error);

    const handleSignal = ({ signal, fromParticipantId }: { signal: RTCSessionDescriptionInit | RTCIceCandidateInit; fromParticipantId: string }) => {
      if (fromParticipantId !== myParticipantId) handleWebRTCSignal(room.id, myParticipantId, signal);
    };
    socket.on('webrtc:signal', handleSignal);
    return () => { socket.off('webrtc:signal', handleSignal); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSolo]);

  // ─── Socket Events ──────────────────────────────────────────────────────────
  useEffect(() => {
    const onReadyStatus = ({ slotIndex: si, readyParticipantIds: ids }: { slotIndex: number; readyParticipantIds: string[] }) => {
      if (si === slotIndex) setReadyParticipantIds(ids);
    };

    const onCountdown = ({ slotIndex: si, durationMs, targetCaptureTimestamp }: { slotIndex: number; durationMs?: number; targetCaptureTimestamp?: number }) => {
      if (si !== slotIndex) return;

      // Clear any prior timer to prevent desync
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
      if (captureTimeoutRef.current) clearTimeout(captureTimeoutRef.current);

      const totalMs = durationMs || (targetCaptureTimestamp ? Math.max(1000, targetCaptureTimestamp - Date.now()) : 3000);
      const startTime = performance.now();
      const endTime = startTime + totalMs;

      const initialSec = Math.ceil(totalMs / 1000);
      setCountdown(initialSec);
      setCountdownKey((k) => k + 1);

      countdownIntervalRef.current = setInterval(() => {
        const remainingMs = endTime - performance.now();
        const remainingSec = Math.ceil(remainingMs / 1000);

        if (remainingSec > 0) {
          setCountdown((prev) => {
            if (prev !== remainingSec) {
              setCountdownKey((k) => k + 1);
            }
            return remainingSec;
          });
        } else {
          if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
          countdownIntervalRef.current = null;
        }
      }, 100);

      captureTimeoutRef.current = setTimeout(() => {
        if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
        triggerCapture(si);
      }, totalMs);
    };

    const onKeepStatus = ({ slotIndex: si, confirmedParticipantIds: ids }: { slotIndex: number; confirmedParticipantIds: string[] }) => {
      if (si === slotIndex) setLocalKeepStatus(ids);
    };

    const onFinishStatus = ({ finishedParticipantIds: ids }: { finishedParticipantIds: string[] }) => {
      setFinishedParticipantIds(ids);
    };

    socket.on('capture:readyStatus', onReadyStatus);
    socket.on('capture:countdown', onCountdown);
    socket.on('capture:keepStatus', onKeepStatus);
    socket.on('capture:finishStatus', onFinishStatus);

    return () => {
      socket.off('capture:readyStatus', onReadyStatus);
      socket.off('capture:countdown', onCountdown);
      socket.off('capture:keepStatus', onKeepStatus);
      socket.off('capture:finishStatus', onFinishStatus);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
      if (captureTimeoutRef.current) clearTimeout(captureTimeoutRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slotIndex, socket]);

  // Reset local state on round change
  useEffect(() => {
    setIAmReady(false);
    setReadyParticipantIds([]);
    setLocalKeepStatus([]);
    setCountdown(null);
    setIFinished(false);
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    if (captureTimeoutRef.current) clearTimeout(captureTimeoutRef.current);
  }, [slotIndex]);

  // ─── Actions ────────────────────────────────────────────────────────────────
  function handleTakePhoto() {
    setIAmReady(true);
    socket.emit('capture:ready', { roomId: room.id, slotIndex });
  }

  async function triggerCapture(currentSlotIndex: number) {
    setCountdown(null);
    setShowFlash(true);
    setTimeout(() => setShowFlash(false), 500);

    if (!localVideoRef.current) return;
    try {
      const dataUrl = await captureFrame(localVideoRef.current, filter);
      socket.emit('capture:frameUpload', {
        roomId: room.id,
        slotIndex: currentSlotIndex,
        photoDataUrl: dataUrl,
        filters: filter !== 'none' ? [filter] : [],
      });
    } catch (e) {
      console.error('Capture error:', e);
    }
  }

  function handleKeep() {
    setLocalKeepStatus((prev) => (prev.includes(myParticipantId) ? prev : [...prev, myParticipantId]));
    socket.emit('capture:keep', { roomId: room.id, slotIndex });
  }

  function handleRetake() {
    setIAmReady(false);
    setReadyParticipantIds([]);
    setLocalKeepStatus([]);
    socket.emit('capture:retake', { roomId: room.id, slotIndex });
  }

  function handleTakeAnother() {
    setIAmReady(false);
    setReadyParticipantIds([]);
    setLocalKeepStatus([]);
    socket.emit('capture:nextRound', { roomId: room.id });
  }

  function handleDone() {
    setIFinished(true);
    socket.emit('capture:finish', { roomId: room.id });
  }

  const showPreview = roundStatus === 'previewing' && (currentSlot?.leftPhotoUrl || currentSlot?.rightPhotoUrl);
  const previewUrl = currentSlot?.leftPhotoUrl || currentSlot?.rightPhotoUrl;
  const showPostKeep = roundStatus === 'locked';

  return (
    <div style={{ minHeight: 'calc(100dvh - 80px)', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0 16px 24px', gap: '14px', maxWidth: '860px', margin: '0 auto', width: '100%' }}>
      {showFlash && <div className="camera-flash" />}

      {/* Header bar */}
      <div style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 18px', background: 'var(--bg-card)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <CameraIcon size={18} color="var(--accent-pink)" />
          <span style={{ fontWeight: 800, fontSize: '15px' }}>
            {isSolo ? `Foto Solo #${slotIndex + 1}` : `Pengambilan Foto #${slotIndex + 1}`}
          </span>
          <span className="badge badge-neutral" style={{ fontSize: '11px' }}>
            {lockedSlots.length}/{MAX_SHOTS} Tersimpan
          </span>
        </div>

        {/* Status indicator */}
        <div>
          {roundStatus === 'waiting_ready' && (
            <span className="badge badge-violet"><ClockIcon size={12} /> Siap Mengambil Foto</span>
          )}
          {roundStatus === 'counting_down' && (
            <span className="badge badge-pink"><SparklesIcon size={12} /> Senyum! Hitungan Mundur…</span>
          )}
          {roundStatus === 'previewing' && (
            <span className="badge badge-neutral">Review Hasil Foto</span>
          )}
          {roundStatus === 'locked' && (
            <span className="badge badge-green"><CheckIcon size={12} /> Foto Tersimpan!</span>
          )}
        </div>
      </div>

      {camError && (
        <div style={{ width: '100%', padding: '12px 16px', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 'var(--radius-md)', color: '#f87171', fontSize: '13px', textAlign: 'center' }}>
          {camError}
        </div>
      )}

      {/* Camera Viewfinder Box: Single Viewfinder for Solo, Dual Viewfinder for Duo */}
      {isSolo ? (
        // ─── SOLO CAMERA VIEW (Centered single camera) ──────────────────────────
        <div
          style={{
            width: '100%',
            maxWidth: '640px',
            aspectRatio: cameraAspect,
            borderRadius: 'var(--radius-lg)',
            overflow: 'hidden',
            background: '#090a10',
            border: '1px solid var(--border-subtle)',
            boxShadow: '0 12px 36px rgba(0,0,0,0.6)',
            position: 'relative',
          }}
        >
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            onLoadedMetadata={handleVideoMetadata}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              filter: FILTER_CSS[filter],
              display: showPreview ? 'none' : 'block',
            }}
          />
          {showPreview && previewUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewUrl} alt="Preview Foto Solo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          )}

          {/* Label tag */}
          <div style={{ position: 'absolute', bottom: '12px', left: '12px', zIndex: 10 }}>
            <span className="badge badge-pink" style={{ fontSize: '11px', backdropFilter: 'blur(8px)', background: 'rgba(255,94,151,0.3)' }}>
              <UserIcon size={11} /> {me?.displayName} (Kamera Solo)
            </span>
          </div>

          {/* Countdown Overlay */}
          {countdown !== null && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)', zIndex: 20 }}>
              <div key={countdownKey} className="countdown-number" style={{ fontSize: '90px', fontWeight: 900, color: 'white', textShadow: '0 0 36px rgba(255,94,151,0.9)' }}>
                {countdown}
              </div>
            </div>
          )}
        </div>
      ) : (
        // ─── DUO CAMERA VIEW (Split Dual Camera) ────────────────────────────────
        <div
          style={{
            width: '100%',
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            borderRadius: 'var(--radius-lg)',
            overflow: 'hidden',
            background: '#090a10',
            border: '1px solid var(--border-subtle)',
            boxShadow: '0 12px 36px rgba(0,0,0,0.6)',
            aspectRatio: '16/10',
            maxHeight: '480px',
            position: 'relative',
          }}
        >
          {/* Left panel */}
          <div style={{ position: 'relative', height: '100%', overflow: 'hidden', borderRight: '1px solid rgba(255,255,255,0.08)' }}>
            {me?.side === 'left' ? (
              <>
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  style={{ width: '100%', height: '100%', objectFit: 'cover', filter: FILTER_CSS[filter], display: showPreview ? 'none' : 'block' }}
                />
                {showPreview && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={currentSlot?.leftPhotoUrl} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                )}
              </>
            ) : (
              <>
                <video
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: showPreview ? 'none' : 'block' }}
                />
                {!remoteConnected && !showPreview && (
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(10,11,18,0.85)', gap: '8px', padding: '16px', textAlign: 'center' }}>
                    <span className="spinner" />
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Menghubungkan ke partner…</span>
                  </div>
                )}
                {showPreview && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={currentSlot?.leftPhotoUrl} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                )}
              </>
            )}

            {/* Label tag */}
            <div style={{ position: 'absolute', bottom: '10px', left: '10px', zIndex: 10 }}>
              <span className="badge badge-pink" style={{ fontSize: '11px', backdropFilter: 'blur(8px)', background: 'rgba(255,94,151,0.25)' }}>
                {me?.side === 'left' ? `${me?.displayName} (Kamu)` : (partner?.displayName ?? 'Partner')}
              </span>
            </div>

            {/* Countdown Overlay */}
            {countdown !== null && (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)', zIndex: 20 }}>
                <div key={countdownKey} className="countdown-number" style={{ fontSize: '76px', fontWeight: 900, color: 'white', textShadow: '0 0 32px rgba(255,94,151,0.85)' }}>
                  {countdown}
                </div>
              </div>
            )}
          </div>

          {/* Right panel */}
          <div style={{ position: 'relative', height: '100%', overflow: 'hidden' }}>
            {me?.side === 'right' ? (
              <>
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  style={{ width: '100%', height: '100%', objectFit: 'cover', filter: FILTER_CSS[filter], display: showPreview ? 'none' : 'block' }}
                />
                {showPreview && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={currentSlot?.rightPhotoUrl} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                )}
              </>
            ) : (
              <>
                <video
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: showPreview ? 'none' : 'block' }}
                />
                {!remoteConnected && !showPreview && (
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(10,11,18,0.85)', gap: '8px', padding: '16px', textAlign: 'center' }}>
                    <span className="spinner" />
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Menghubungkan ke partner…</span>
                  </div>
                )}
                {showPreview && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={currentSlot?.rightPhotoUrl} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                )}
              </>
            )}

            {/* Label tag */}
            <div style={{ position: 'absolute', bottom: '10px', right: '10px', zIndex: 10 }}>
              <span className="badge badge-violet" style={{ fontSize: '11px', backdropFilter: 'blur(8px)', background: 'rgba(139,92,246,0.25)' }}>
                {me?.side === 'right' ? `${me?.displayName} (Kamu)` : (partner?.displayName ?? 'Partner')}
              </span>
            </div>

            {/* Countdown Overlay */}
            {countdown !== null && (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)', zIndex: 20 }}>
                <div key={countdownKey} className="countdown-number" style={{ fontSize: '76px', fontWeight: 900, color: 'white', textShadow: '0 0 32px rgba(139,92,246,0.85)' }}>
                  {countdown}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Controls Card */}
      <div className="glass-card" style={{ width: '100%', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
        
        {/* Filter Bar (waiting state) */}
        {roundStatus === 'waiting_ready' && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px', marginRight: '4px' }}>
              <SlidersIcon size={14} /> Filter Kamera:
            </span>
            {FILTERS.map((f) => (
              <button
                key={f.id}
                className={`btn btn-sm ${filter === f.id ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setFilter(f.id)}
                id={`filter-${f.id}-btn`}
                style={{ padding: '5px 12px', fontSize: '12px' }}
              >
                {f.label}
              </button>
            ))}
          </div>
        )}

        {/* Action Area */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
          
          {/* 1. WAITING_READY */}
          {roundStatus === 'waiting_ready' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', width: '100%' }}>
              <button
                className="btn btn-primary btn-lg"
                onClick={handleTakePhoto}
                disabled={iAmReady}
                id="take-photo-btn"
                style={{ width: '100%', maxWidth: '320px', fontSize: '15px' }}
              >
                {iAmReady ? (
                  <><span className="spinner" /> {isSolo ? 'Menyiapkan…' : `Menunggu ${partner?.displayName || 'Partner'}…`}</>
                ) : (
                  <><CameraIcon size={18} /> Ambil Foto</>
                )}
              </button>

              {!isSolo && (
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap' }}>
                  {participants.map((p) => {
                    const ready = readyParticipantIds.includes(p.id);
                    return (
                      <span key={p.id} className={`badge ${ready ? 'badge-green' : 'badge-neutral'}`} style={{ fontSize: '11.5px' }}>
                        {ready ? <CheckIcon size={11} /> : <ClockIcon size={11} />}
                        {p.displayName} {p.id === myParticipantId ? '(Kamu)' : ''}: {ready ? 'Siap' : 'Menunggu'}
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* 2. COUNTING_DOWN */}
          {roundStatus === 'counting_down' && (
            <p style={{ color: 'var(--accent-pink)', fontSize: '15px', fontWeight: 700 }}>
              {isSolo ? 'Senyum! Mengambil foto dalam 3 detik…' : 'Mengambil foto bersama dalam 3 detik…'}
            </p>
          )}

          {/* 3. PREVIEWING */}
          {roundStatus === 'previewing' && showPreview && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%', alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center', width: '100%' }}>
                <button className="btn btn-secondary btn-lg" onClick={handleRetake} id="retake-btn">
                  <RefreshCwIcon size={16} /> Foto Ulang (Retake)
                </button>
                <button
                  className="btn btn-primary btn-lg"
                  onClick={handleKeep}
                  disabled={iHaveKept}
                  id="keep-btn"
                  style={{ flex: 1, maxWidth: '260px' }}
                >
                  {iHaveKept ? (
                    <><span className="spinner" /> {isSolo ? 'Menyimpan…' : 'Menunggu Partner…'}</>
                  ) : (
                    <><CheckIcon size={16} /> Simpan Foto Ini</>
                  )}
                </button>
              </div>

              {!isSolo && (
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap' }}>
                  {participants.map((p) => {
                    const kept = keepStatus.includes(p.id);
                    return (
                      <span key={p.id} className={`badge ${kept ? 'badge-green' : 'badge-neutral'}`} style={{ fontSize: '11.5px' }}>
                        {kept ? <CheckIcon size={11} /> : <ClockIcon size={11} />} {p.displayName}: {kept ? 'Sudah Simpan' : 'Sedang Review'}
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* 4. POST-KEEP / LOCKED */}
          {showPostKeep && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%', alignItems: 'center' }}>
              <span className="badge badge-green" style={{ fontSize: '12px', padding: '4px 12px' }}>
                <CheckIcon size={12} /> Foto #{lockedSlots.length} Berhasil Disimpan
              </span>

              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center', width: '100%' }}>
                {canTakeMore && (
                  <button
                    className="btn btn-secondary btn-lg"
                    onClick={handleTakeAnother}
                    id="take-another-btn"
                    style={{ flex: 1, maxWidth: '240px' }}
                  >
                    <PlusIcon size={16} /> Ambil Foto Lagi
                  </button>
                )}

                <button
                  className="btn btn-primary btn-lg"
                  onClick={handleDone}
                  disabled={iFinished}
                  id="done-btn"
                  style={{ flex: 1, maxWidth: '260px' }}
                >
                  {iFinished ? (
                    <><span className="spinner" /> {isSolo ? 'Memproses…' : 'Menunggu Partner…'}</>
                  ) : (
                    <>Lanjut Pilih Frame <ArrowRightIcon size={16} /></>
                  )}
                </button>
              </div>

              {!isSolo && finishedParticipantIds.length > 0 && (
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap' }}>
                  {participants.map((p) => {
                    const fin = finishedParticipantIds.includes(p.id);
                    return (
                      <span key={p.id} className={`badge ${fin ? 'badge-green' : 'badge-neutral'}`} style={{ fontSize: '11.5px' }}>
                        {fin ? <CheckIcon size={11} /> : <CameraIcon size={11} />} {p.displayName}: {fin ? 'Siap Lanjut' : 'Masih Foto'}
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Captured shots filmstrip at bottom (un-mirrored natural orientation) */}
      {lockedSlots.length > 0 && (
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <span style={{ fontSize: '11.5px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Galeri Hasil Foto Sesi Ini ({lockedSlots.length})
          </span>
          <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
            {lockedSlots.map((slot) => (
              <div
                key={slot.slotIndex}
                style={{
                  flexShrink: 0,
                  width: isSolo ? '64px' : '96px',
                  aspectRatio: isSolo ? '3/4' : '2/1',
                  borderRadius: 'var(--radius-sm)',
                  overflow: 'hidden',
                  border: '1px solid var(--accent-pink)',
                  position: 'relative',
                  background: '#090a10',
                }}
              >
                {isSolo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={slot.leftPhotoUrl || slot.rightPhotoUrl} alt={`Foto ${slot.slotIndex + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', height: '100%' }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={slot.leftPhotoUrl} alt="L" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={slot.rightPhotoUrl} alt="R" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                )}
                <div style={{ position: 'absolute', top: '2px', left: '2px', background: 'rgba(0,0,0,0.75)', borderRadius: '3px', padding: '1px 4px', fontSize: '9px', fontWeight: 800, color: 'var(--accent-pink)' }}>
                  #{slot.slotIndex + 1}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
