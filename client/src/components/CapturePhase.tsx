'use client';

import { useEffect, useRef, useState } from 'react';
import { Socket } from 'socket.io-client';
import { PairedShot, Participant, Room, RoundStatus } from '@/types';
import { captureFrame, FilterType } from '@/lib/capture';
import {
  getLocalStream,
  stopLocalStream,
  closePeerConnection,
  initiatePeerConnection,
  handleWebRTCSignal,
  subscribeRemoteStreams,
  toggleMic,
  isMicEnabled,
} from '@/lib/webrtc';
import { CameraIcon, CheckIcon, RefreshCwIcon, PlusIcon, SlidersIcon, ClockIcon, ArrowRightIcon, UserIcon, MicIcon, MicOffIcon, CrownIcon } from './Icons';
import { useLanguage } from '@/lib/i18n';

function RemoteVideoTile({
  stream,
  previewUrl,
  showPreview,
  displayName,
  isHost,
}: {
  stream?: MediaStream;
  previewUrl?: string;
  showPreview: boolean;
  displayName: string;
  isHost: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(() => {});
    }
  }, [stream]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', minHeight: '160px', overflow: 'hidden', background: '#0b0c13', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {showPreview && previewUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={previewUrl} alt={displayName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : stream ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          onLoadedMetadata={(e) => e.currentTarget.play().catch(() => {})}
          style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'translateZ(0)', backfaceVisibility: 'hidden' }}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', padding: '12px', textAlign: 'center' }}>
          <span className="spinner" style={{ width: '20px', height: '20px' }} />
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Menghubungkan {displayName}…</span>
        </div>
      )}

      <div style={{ position: 'absolute', bottom: '8px', left: '8px', zIndex: 10 }}>
        <span className="badge badge-neutral" style={{ fontSize: '10.5px', backdropFilter: 'blur(8px)', background: 'rgba(0,0,0,0.6)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
          {isHost && <CrownIcon size={11} color="var(--accent-amber)" />}
          {displayName}
        </span>
      </div>
    </div>
  );
}

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
  const { t } = useLanguage();
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
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());
  const [cameraAspect, setCameraAspect] = useState<string>('16/9');
  const [micOn, setMicOn] = useState(true);
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const captureTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isSolo = room.capacity === 1 || room.settings?.mode === 'solo';
  const isGroup = room.settings?.mode === 'group' || room.capacity > 2;
  const me = participants.find((p) => p.id === myParticipantId);
  const partner = participants.find((p) => p.id !== myParticipantId);
  const partnerStream = partner ? remoteStreams.get(partner.id) : Array.from(remoteStreams.values())[0];
  const slotIndex = room.currentRoundIndex;
  const roundStatus: RoundStatus = room.currentRoundStatus;

  // Bind remote stream to remoteVideoRef in Duo mode
  useEffect(() => {
    if (remoteVideoRef.current && partnerStream) {
      remoteVideoRef.current.srcObject = partnerStream;
      remoteVideoRef.current.play().catch(() => {});
    }
  }, [partnerStream, me?.side, roundStatus]);

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
        setMicOn(isMicEnabled());
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
    return () => {
      mounted = false;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = null;
      }
      stopLocalStream();
      closePeerConnection();
    };
  }, []);

  // ─── WebRTC (Multi-Peer Mesh for Duo and Group mode) ───────────────────────
  useEffect(() => {
    if (isSolo) return;

    const unsubscribe = subscribeRemoteStreams((streams) => {
      setRemoteStreams(new Map(streams));
      if (streams.size > 0) setRemoteConnected(true);
    });

    getLocalStream().then((stream) => {
      if (stream) {
        participants.forEach((p) => {
          if (p.id !== myParticipantId) {
            // Deterministic initiator (lower ID initiates)
            if (myParticipantId < p.id) {
              initiatePeerConnection(room.id, myParticipantId, p.id);
            }
          }
        });
      }
    }).catch(console.error);

    const handleSignal = ({
      signal,
      fromParticipantId,
      targetParticipantId,
    }: {
      signal: RTCSessionDescriptionInit | RTCIceCandidateInit;
      fromParticipantId: string;
      targetParticipantId?: string;
    }) => {
      if (fromParticipantId !== myParticipantId) {
        handleWebRTCSignal(room.id, myParticipantId, signal, fromParticipantId, targetParticipantId);
      }
    };

    socket.on('webrtc:signal', handleSignal);
    return () => {
      socket.off('webrtc:signal', handleSignal);
      unsubscribe();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSolo, participants.length]);

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

  const showPreview = Boolean(roundStatus === 'previewing' && (currentSlot?.leftPhotoUrl || currentSlot?.rightPhotoUrl || (currentSlot?.photos && currentSlot.photos.length > 0)));
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
            {isSolo ? t('captureShotSoloNum', { num: slotIndex + 1 }) : t('captureShotNum', { num: slotIndex + 1 })}
          </span>
          <span className="badge badge-neutral" style={{ fontSize: '11px' }}>
            {t('capturePhotosSaved', { count: lockedSlots.length, max: MAX_SHOTS })}
          </span>
        </div>

        {/* Actions & Status indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {!isSolo && (
            <button
              className={`btn btn-sm ${micOn ? 'btn-secondary' : 'btn-danger'}`}
              onClick={async () => {
                const nextState = await toggleMic();
                setMicOn(nextState);
              }}
              id="mic-toggle-btn"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '4px 10px',
                fontSize: '11px',
                borderRadius: 'var(--radius-full)',
                fontWeight: 600,
              }}
              title={micOn ? 'Mute Microphone' : 'Unmute Microphone'}
            >
              {micOn ? <MicIcon size={13} color="var(--accent-emerald)" /> : <MicOffIcon size={13} color="#f87171" />}
              <span>{micOn ? t('micOn') : t('micOff')}</span>
            </button>
          )}

          {roundStatus === 'waiting_ready' && (
            <span className="badge badge-violet"><ClockIcon size={12} /> {t('captureReadyBadge')}</span>
          )}
          {roundStatus === 'counting_down' && (
            <span className="badge badge-pink"><CameraIcon size={12} /> {t('captureSmileCountdown')}</span>
          )}
          {roundStatus === 'previewing' && (
            <span className="badge badge-neutral">{t('captureReviewBadge')}</span>
          )}
          {roundStatus === 'locked' && (
            <span className="badge badge-green"><CheckIcon size={12} /> {t('captureSavedBadge')}</span>
          )}
        </div>
      </div>

      {camError && (
        <div style={{ width: '100%', padding: '12px 16px', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 'var(--radius-md)', color: '#f87171', fontSize: '13px', textAlign: 'center' }}>
          {camError}
        </div>
      )}

      {/* Camera Viewfinder Box: Single for Solo, Grid for Group, Dual for Duo */}
      {isSolo ? (
        // ─── SOLO CAMERA VIEW (Centered single camera) ──────────────────────────
        <div
          style={{
            width: '100%',
            maxWidth: '640px',
            maxHeight: '52dvh',
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
              transform: 'scaleX(-1) translateZ(0)',
              backfaceVisibility: 'hidden',
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
      ) : isGroup ? (
        // ─── GROUP CAMERA VIEW (Multi-camera grid for up to 6 participants) ─────
        <div
          className="camera-view-group"
          style={{
            gridTemplateColumns: participants.length <= 2 ? '1fr 1fr' : participants.length <= 4 ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)',
          }}
        >
          {participants.map((p) => {
            const isMe = p.id === myParticipantId;
            const pPhoto = currentSlot?.photos?.find((sp) => sp.participantId === p.id)?.url || (p.side === 'left' ? currentSlot?.leftPhotoUrl : currentSlot?.rightPhotoUrl);

            return (
              <div
                key={p.id}
                style={{
                  position: 'relative',
                  aspectRatio: '4/3',
                  borderRadius: 'var(--radius-md)',
                  overflow: 'hidden',
                  background: '#10121b',
                  border: isMe ? '1.5px solid rgba(255,94,151,0.4)' : '1px solid rgba(255,255,255,0.08)',
                }}
              >
                {isMe ? (
                  <>
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
                        transform: 'scaleX(-1) translateZ(0)',
                        backfaceVisibility: 'hidden',
                      }}
                    />
                    {showPreview && pPhoto && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={pPhoto} alt={p.displayName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    )}
                  </>
                ) : (
                  <RemoteVideoTile
                    stream={remoteStreams.get(p.id)}
                    previewUrl={pPhoto}
                    showPreview={showPreview}
                    displayName={p.displayName}
                    isHost={p.isHost}
                  />
                )}

                {/* Name Badge */}
                <div style={{ position: 'absolute', bottom: '8px', left: '8px', zIndex: 10 }}>
                  <span className={`badge ${isMe ? 'badge-pink' : 'badge-neutral'}`} style={{ fontSize: '10.5px', backdropFilter: 'blur(8px)', background: isMe ? 'rgba(255,94,151,0.35)' : 'rgba(0,0,0,0.65)' }}>
                    {p.isHost && <CrownIcon size={11} color="var(--accent-amber)" />}
                    {p.displayName} {isMe && '(Kamu)'}
                  </span>
                </div>
              </div>
            );
          })}

          {/* Countdown Overlay over the entire group grid */}
          {countdown !== null && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)', zIndex: 30, borderRadius: 'var(--radius-lg)' }}>
              <div key={countdownKey} className="countdown-number" style={{ fontSize: '96px', fontWeight: 900, color: 'white', textShadow: '0 0 40px rgba(255,94,151,0.95)' }}>
                {countdown}
              </div>
            </div>
          )}
        </div>
      ) : (
        // ─── DUO CAMERA VIEW (Split Dual Camera) ────────────────────────────────
        <div className="camera-view-duo">
          {/* Left panel */}
          <div style={{ position: 'relative', height: '100%', overflow: 'hidden', borderRight: '1px solid rgba(255,255,255,0.08)' }}>
            {me?.side === 'left' ? (
              <>
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  style={{ width: '100%', height: '100%', objectFit: 'cover', filter: FILTER_CSS[filter], display: showPreview ? 'none' : 'block', transform: 'scaleX(-1) translateZ(0)', backfaceVisibility: 'hidden' }}
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
                  onLoadedMetadata={(e) => e.currentTarget.play().catch(() => {})}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: showPreview ? 'none' : 'block', transform: 'translateZ(0)', backfaceVisibility: 'hidden' }}
                />
                {!partnerStream && !showPreview && (
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
                  style={{ width: '100%', height: '100%', objectFit: 'cover', filter: FILTER_CSS[filter], display: showPreview ? 'none' : 'block', transform: 'scaleX(-1) translateZ(0)', backfaceVisibility: 'hidden' }}
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
                  onLoadedMetadata={(e) => e.currentTarget.play().catch(() => {})}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: showPreview ? 'none' : 'block', transform: 'translateZ(0)', backfaceVisibility: 'hidden' }}
                />
                {!partnerStream && !showPreview && (
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
                  <><CameraIcon size={18} /> {t('captureTakePhotoBtn')}</>
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
                  <RefreshCwIcon size={16} /> {t('captureRetakeBtn')}
                </button>
                <button
                  className="btn btn-primary btn-lg"
                  onClick={handleKeep}
                  disabled={iHaveKept}
                  id="keep-btn"
                  style={{ flex: 1, maxWidth: '260px' }}
                >
                  {iHaveKept ? (
                    <><span className="spinner" /> {isSolo ? 'Menyimpan…' : t('captureWaitingPartner')}</>
                  ) : (
                    <><CheckIcon size={16} /> {t('captureKeepBtn')}</>
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
                    <PlusIcon size={16} /> {t('captureNextShotBtn')}
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
