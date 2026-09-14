'use client';

import { useEffect, useRef, useState } from 'react';
import { Socket } from 'socket.io-client';
import { PairedShot, Participant, Room, RoundStatus } from '@/types';
import { captureFrame, FilterType, FILTER_CONFIGS } from '@/lib/capture';
import {
  BACKGROUND_PRESETS,
  BG_CATEGORIES,
  VirtualBackground,
  VirtualBgCategory,
} from '@/lib/backgroundPresets';
import { BackgroundRenderController } from '@/lib/backgroundSegmenter';
import {
  getLocalStream,
  stopLocalStream,
  closePeerConnection,
  initiatePeerConnection,
  handleWebRTCSignal,
  subscribeRemoteStreams,
  toggleMic,
  isMicEnabled,
  toggleCamera,
  isCameraEnabled,
  getActiveLocalStream,
  flipCamera,
  subscribeMicState,
  subscribeCameraState,
} from '@/lib/webrtc';
import {
  CameraIcon,
  CameraOffIcon,
  FlipCameraIcon,
  CheckIcon,
  RefreshCwIcon,
  PlusIcon,
  SlidersIcon,
  ClockIcon,
  ArrowRightIcon,
  UserIcon,
  MicIcon,
  MicOffIcon,
  CrownIcon,
  MirrorIcon,
  ImageIcon,
  DropletIcon,
  PaletteIcon,
  MountainIcon,
  SparklesIcon,
  UploadIcon,
  TrashIcon,
} from './Icons';
import { useLanguage } from '@/lib/i18n';
import { getServerUrl } from '@/lib/config';

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

export type FilterCategory = 'all' | 'natural' | 'film' | 'bw' | 'mood';

interface FilterItem {
  id: FilterType;
  label: string;
  category: 'natural' | 'film' | 'bw' | 'mood';
  subtitle: string;
}

const FILTER_CATEGORIES: { id: FilterCategory; label: string; icon: string }[] = [
  { id: 'all', label: 'Semua', icon: '✨' },
  { id: 'natural', label: 'Natural & Glow', icon: '🌟' },
  { id: 'film', label: 'Film & Retro', icon: '🎞️' },
  { id: 'bw', label: 'Hitam Putih', icon: '🖤' },
  { id: 'mood', label: 'Mood & Sinematik', icon: '🎨' },
];

const FILTERS: FilterItem[] = [
  // Natural & Clean
  { id: 'none', label: 'Original', category: 'natural', subtitle: 'Kamera asli' },
  { id: 'clean', label: 'Clean Glow', category: 'natural', subtitle: 'Kulit cerah segar' },
  { id: 'vivid', label: 'Vivid Pop', category: 'natural', subtitle: 'Warna cerah kontras' },
  { id: 'matte', label: 'Matte Soft', category: 'natural', subtitle: 'Gaya majalah lembut' },
  { id: 'soft_blush', label: 'Soft Blush', category: 'natural', subtitle: 'Rona pipi hangat' },

  // Film & Analog
  { id: 'warm', label: 'Warm Glow', category: 'film', subtitle: 'Hangat sore hari' },
  { id: 'vintage', label: 'Vintage 90s', category: 'film', subtitle: 'Analog 90-an autentik' },
  { id: 'polaroid', label: 'Polaroid', category: 'film', subtitle: 'Cahaya instan retro' },
  { id: 'kodak', label: 'Kodak Gold', category: 'film', subtitle: 'Emas rol film ikonik' },
  { id: 'fuji', label: 'Fuji Provia', category: 'film', subtitle: 'Tone sejuk sinematik' },
  { id: 'nostalgia', label: 'Nostalgia', category: 'film', subtitle: 'Memori klasik pudar' },

  // Monokrom & Noir
  { id: 'bw', label: 'Classic B&W', category: 'bw', subtitle: 'Hitam putih seimbang' },
  { id: 'noir', label: 'Deep Noir', category: 'bw', subtitle: 'Kontras film bioskop' },
  { id: 'silver', label: 'Silver Halide', category: 'bw', subtitle: 'Perak monokrom halus' },
  { id: 'sepia', label: 'Sepia Antique', category: 'bw', subtitle: 'Cokelat klasik antik' },

  // Mood & Sinematik
  { id: 'cool', label: 'Cool Breeze', category: 'mood', subtitle: 'Sejuk segar modern' },
  { id: 'golden', label: 'Golden Hour', category: 'mood', subtitle: 'Sinar mentari magis' },
  { id: 'cyber', label: 'Cyberpunk', category: 'mood', subtitle: 'Neon futuristik' },
  { id: 'emerald', label: 'Emerald Teal', category: 'mood', subtitle: 'Film Wong Kar-wai' },
  { id: 'dramatic', label: 'Moody Drama', category: 'mood', subtitle: 'Tegas & misterius' },
  { id: 'pastel', label: 'Dreamy Pastel', category: 'mood', subtitle: 'Nuansa mimpi pastel' },
];

const FILTER_CSS = FILTER_CONFIGS;

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
  const [selectedCategory, setSelectedCategory] = useState<FilterCategory>('all');
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
  const [micOn, setMicOn] = useState(isMicEnabled());
  const [camOn, setCamOn] = useState(isCameraEnabled());
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [isMirrored, setIsMirrored] = useState(false);
  const filterRef = useRef<FilterType>(filter);
  filterRef.current = filter;
  const mirrorRef = useRef<boolean>(isMirrored);
  mirrorRef.current = isMirrored;
  const triggerCaptureRef = useRef<(slotIdx: number) => void>(() => {});
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const captureTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ─── Virtual Background State ──────────────────────────────────────────
  const virtualCanvasRef = useRef<HTMLCanvasElement>(null);
  const bgControllerRef = useRef<BackgroundRenderController | null>(null);
  const [activeToolTab, setActiveToolTab] = useState<'filter' | 'background'>('filter');
  const [selectedBg, setSelectedBg] = useState<VirtualBackground>(BACKGROUND_PRESETS[0]);
  const [selectedBgCategory, setSelectedBgCategory] = useState<VirtualBgCategory>('all');
  const [isUploadingBg, setIsUploadingBg] = useState(false);
  const [publicBackgrounds, setPublicBackgrounds] = useState<
    Array<{ id: string; name: string; url: string; uploadedBy: string; uploadedById: string; uploadedAt: number }>
  >([]);
  const bgRef = useRef<VirtualBackground>(selectedBg);
  bgRef.current = selectedBg;
  const customFileInputRef = useRef<HTMLInputElement>(null);
  const [bgToastMessage, setBgToastMessage] = useState<string | null>(null);
  const [confirmDeleteBgId, setConfirmDeleteBgId] = useState<string | null>(null);

  // Sync public community custom backgrounds (shared globally with all users across all rooms)
  useEffect(() => {
    // 1. Fetch initial public backgrounds via REST API
    const loadPublicBackgrounds = async () => {
      try {
        const res = await fetch(`${getServerUrl()}/api/backgrounds`);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.backgrounds)) {
            setPublicBackgrounds(data.backgrounds);
          }
        }
      } catch (err) {
        console.warn('Failed to fetch public backgrounds via REST:', err);
      }
    };
    loadPublicBackgrounds();

    // 2. Request via socket
    socket.emit('capture:getBackgrounds');

    // 3. Socket listeners for real-time synchronization with ALL users
    const onBackgroundsUpdated = ({
      backgrounds,
    }: {
      backgrounds: Array<{ id: string; name: string; url: string; uploadedBy: string; uploadedById: string; uploadedAt: number }>;
    }) => {
      if (Array.isArray(backgrounds)) {
        setPublicBackgrounds(backgrounds);
      }
    };

    const onGlobalBgAdded = ({
      background,
    }: {
      background: { id: string; name: string; url: string; uploadedBy: string; uploadedById: string; createdAt: number };
    }) => {
      if (background) {
        setPublicBackgrounds((prev) => {
          if (prev.some((b) => b.id === background.id)) return prev;
          return [
            {
              id: background.id,
              name: background.name,
              url: background.url,
              uploadedBy: background.uploadedBy,
              uploadedById: background.uploadedById || '',
              uploadedAt: background.createdAt,
            },
            ...prev,
          ];
        });
      }
    };

    const onGlobalBgRemoved = ({ bgId }: { bgId: string }) => {
      setPublicBackgrounds((prev) => prev.filter((b) => b.id !== bgId));
    };

    socket.on('capture:backgroundsUpdated', onBackgroundsUpdated);
    socket.on('capture:globalBackgroundAdded', onGlobalBgAdded);
    socket.on('capture:globalBackgroundRemoved', onGlobalBgRemoved);

    return () => {
      socket.off('capture:backgroundsUpdated', onBackgroundsUpdated);
      socket.off('capture:globalBackgroundAdded', onGlobalBgAdded);
      socket.off('capture:globalBackgroundRemoved', onGlobalBgRemoved);
    };
  }, [socket]);

  const handleSelectFilter = (newFilter: FilterType) => {
    setFilter(newFilter);
    filterRef.current = newFilter;
    bgControllerRef.current?.updateFilter(newFilter);
    socket.emit('capture:setFilter', { roomId: room.id, filter: newFilter });
  };

  const handleSelectBackground = (bg: VirtualBackground) => {
    setSelectedBg(bg);
    bgRef.current = bg;
    bgControllerRef.current?.updateBackground(bg);
  };

  const handleCustomBgUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 15 * 1024 * 1024) {
      setBgToastMessage('Ukuran gambar maksimal 15MB.');
      setTimeout(() => setBgToastMessage(null), 3500);
      return;
    }

    const myParticipant = participants.find((p) => p.id === myParticipantId);
    const uploaderName = myParticipant?.displayName || 'Pengguna';
    const bgTitle = file.name.replace(/\.[^/.]+$/, '');

    setIsUploadingBg(true);

    const reader = new FileReader();
    reader.onload = async (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) {
        // Instant camera preview locally
        const previewBg: VirtualBackground = {
          id: `local_preview_${Date.now()}`,
          name: bgTitle,
          category: 'custom',
          type: 'image',
          subtitle: `Diunggah oleh Kamu (Publik)`,
          imageUrl: dataUrl,
          previewUrl: dataUrl,
        };
        setSelectedBg(previewBg);
        bgRef.current = previewBg;
        bgControllerRef.current?.updateBackground(previewBg);

        // Upload to server REST API and broadcast to ALL users globally
        try {
          const formData = new FormData();
          formData.append('file', file);
          formData.append('name', bgTitle);
          formData.append('uploadedBy', uploaderName);
          formData.append('participantId', myParticipantId);

          const res = await fetch(`${getServerUrl()}/api/backgrounds/upload`, {
            method: 'POST',
            body: formData,
          });

          if (res.ok) {
            const result = await res.json();
            if (result.background) {
              const uploadedBg: VirtualBackground = {
                id: result.background.id,
                name: result.background.name,
                category: 'custom',
                type: 'image',
                subtitle: `Diunggah oleh Kamu (Publik)`,
                imageUrl: result.background.url,
                previewUrl: result.background.url,
              };
              setSelectedBg(uploadedBg);
              bgRef.current = uploadedBg;
              bgControllerRef.current?.updateBackground(uploadedBg);
            }
          } else {
            // Fallback to socket upload
            socket.emit('capture:uploadBackground', {
              photoDataUrl: dataUrl,
              name: bgTitle,
              displayName: uploaderName,
            });
          }
        } catch (err) {
          console.error('Error uploading background via REST, falling back to socket:', err);
          socket.emit('capture:uploadBackground', {
            photoDataUrl: dataUrl,
            name: bgTitle,
            displayName: uploaderName,
          });
        } finally {
          setIsUploadingBg(false);
        }
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleRemoveCustomBg = () => {
    const noneBg = BACKGROUND_PRESETS[0];
    setSelectedBg(noneBg);
    bgRef.current = noneBg;
    bgControllerRef.current?.updateBackground(noneBg);
  };

  const handleRemoveSharedBg = (bgId: string) => {
    setConfirmDeleteBgId(bgId);
  };

  const executeRemoveSharedBg = async () => {
    if (!confirmDeleteBgId) return;
    const bgId = confirmDeleteBgId;
    setConfirmDeleteBgId(null);

    try {
      await fetch(`${getServerUrl()}/api/backgrounds/${bgId}`, {
        method: 'DELETE',
      });
    } catch (err) {
      console.error('Error deleting background via REST:', err);
    }
    // Also emit socket event to broadcast removal
    socket.emit('capture:removeBackground', { bgId });

    if (selectedBg.id === bgId) {
      handleSelectBackground(BACKGROUND_PRESETS[0]);
    }
  };

  useEffect(() => {
    bgControllerRef.current?.updateMirror(isMirrored);
  }, [isMirrored]);

  useEffect(() => {
    bgControllerRef.current?.updateFilter(filter);
  }, [filter]);

  useEffect(() => {
    bgControllerRef.current?.updateBackground(selectedBg);
  }, [selectedBg]);

  // Virtual Background Controller Lifecycle
  useEffect(() => {
    const video = localVideoRef.current;
    const canvas = virtualCanvasRef.current;
    if (!video || !canvas) return;

    const controller = new BackgroundRenderController();
    bgControllerRef.current = controller;
    controller.updateCameraState(camOn);
    controller.start(video, canvas, bgRef.current, filterRef.current, mirrorRef.current);

    return () => {
      controller.stop();
      if (bgControllerRef.current === controller) {
        bgControllerRef.current = null;
      }
    };
  }, [camOn, facingMode]);

  useEffect(() => {
    const onFilterUpdated = ({ filter: syncedFilter }: { filter: FilterType }) => {
      if (syncedFilter) {
        setFilter(syncedFilter);
        filterRef.current = syncedFilter;
      }
    };
    socket.on('capture:filterUpdated', onFilterUpdated);
    return () => {
      socket.off('capture:filterUpdated', onFilterUpdated);
    };
  }, [socket]);

  useEffect(() => {
    const unsubMic = subscribeMicState(setMicOn);
    const unsubCam = subscribeCameraState((c, f) => {
      setCamOn(c);
      setFacingMode(f);
      bgControllerRef.current?.updateCameraState(c);
      if (localVideoRef.current) {
        const stream = getActiveLocalStream();
        if (c && stream) {
          localVideoRef.current.srcObject = stream;
          localVideoRef.current.play().catch(() => {});
        } else if (!c) {
          localVideoRef.current.srcObject = null;
        }
      }
    });
    return () => {
      unsubMic();
      unsubCam();
    };
  }, []);

  const handleToggleMic = async () => {
    if (isCaptureLocked) return;
    const next = await toggleMic();
    setMicOn(next);
  };

  const handleToggleCam = async () => {
    if (isCaptureLocked) return;
    const next = await toggleCamera();
    setCamOn(next);
    bgControllerRef.current?.updateCameraState(next);
    if (localVideoRef.current) {
      const stream = getActiveLocalStream();
      if (next && stream) {
        localVideoRef.current.srcObject = stream;
        localVideoRef.current.play().catch(() => {});
      } else if (!next) {
        localVideoRef.current.srcObject = null;
      }
    }
  };

  const handleFlipCam = async () => {
    if (isCaptureLocked) return;
    const next = await flipCamera();
    setFacingMode(next);
  };

  const isSolo = room.capacity === 1 || room.settings?.mode === 'solo';
  const isGroup = room.settings?.mode === 'group' || room.capacity > 2;
  const me = participants.find((p) => p.id === myParticipantId);
  const partner = participants.find((p) => p.id !== myParticipantId);
  const partnerStream = partner ? remoteStreams.get(partner.id) : Array.from(remoteStreams.values())[0];
  const slotIndex = room.currentRoundIndex;
  const roundStatus: RoundStatus = room.currentRoundStatus;
  const isCaptureLocked = iAmReady || countdown !== null || roundStatus === 'counting_down';

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
        triggerCaptureRef.current(si);
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
    if (isCaptureLocked) return;
    setIAmReady(true);
    socket.emit('capture:ready', { roomId: room.id, slotIndex });
  }

  async function triggerCapture(currentSlotIndex: number) {
    setCountdown(null);
    setShowFlash(true);
    setTimeout(() => setShowFlash(false), 500);

    if (!localVideoRef.current) return;
    try {
      const activeFilter = filterRef.current;
      const activeMirror = mirrorRef.current;
      let dataUrl = '';

      // If virtual background is active, capture from background controller
      if (bgRef.current.type !== 'none' && bgControllerRef.current) {
        dataUrl = bgControllerRef.current.captureFrame();
      }

      if (!dataUrl) {
        dataUrl = await captureFrame(localVideoRef.current, activeFilter, undefined, undefined, activeMirror);
      }

      socket.emit('capture:frameUpload', {
        roomId: room.id,
        slotIndex: currentSlotIndex,
        photoDataUrl: dataUrl,
        filters: activeFilter !== 'none' ? [activeFilter] : [],
      });
    } catch (e) {
      console.error('Capture error:', e);
    }
  }
  triggerCaptureRef.current = triggerCapture;

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
      <div style={{ width: '100%', maxWidth: '680px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 18px', background: 'var(--bg-card)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
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
              onClick={handleToggleMic}
              disabled={isCaptureLocked}
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
        <div style={{ width: '100%', maxWidth: '680px', margin: '0 auto', padding: '12px 16px', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 'var(--radius-md)', color: '#f87171', fontSize: '13px', textAlign: 'center' }}>
          {camError}
        </div>
      )}

      {/* Camera Viewfinder Box: Single for Solo, Grid for Group, Dual for Duo */}
      {isSolo ? (
        // ─── SOLO CAMERA VIEW (Centered single camera) ──────────────────────────
        <div className="camera-view-solo">
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
              display: (showPreview || selectedBg.type !== 'none') ? 'none' : 'block',
              transform: isMirrored ? 'scaleX(-1) translateZ(0)' : 'translateZ(0)',
              backfaceVisibility: 'hidden',
            }}
          />
          <canvas
            ref={virtualCanvasRef}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: (!showPreview && selectedBg.type !== 'none') ? 'block' : 'none',
            }}
          />
          {showPreview && previewUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewUrl} alt="Preview Foto Solo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          )}

          {/* Camera Off Feedback Overlay */}
          {!camOn && !showPreview && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#090b12', gap: '8px', zIndex: 12 }}>
              <div style={{ width: '52px', height: '52px', borderRadius: '50%', background: 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CameraOffIcon size={26} color="var(--text-muted)" />
              </div>
              <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-secondary)' }}>Kamera Dinonaktifkan</span>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Sensor & lampu indikator kamera telah mati</span>
            </div>
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
                        display: (showPreview || selectedBg.type !== 'none' || !camOn) ? 'none' : 'block',
                        transform: isMirrored ? 'scaleX(-1) translateZ(0)' : 'translateZ(0)',
                        backfaceVisibility: 'hidden',
                      }}
                    />
                    <canvas
                      ref={virtualCanvasRef}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        display: (!showPreview && selectedBg.type !== 'none' && camOn) ? 'block' : 'none',
                      }}
                    />
                    {showPreview && pPhoto && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={pPhoto} alt={p.displayName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    )}
                    {!camOn && !showPreview && (
                      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#090b12', gap: '6px', zIndex: 12 }}>
                        <CameraOffIcon size={22} color="var(--text-muted)" />
                        <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)' }}>Kamera Mati</span>
                      </div>
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
                  style={{ width: '100%', height: '100%', objectFit: 'cover', filter: FILTER_CSS[filter], display: (showPreview || selectedBg.type !== 'none' || !camOn) ? 'none' : 'block', transform: isMirrored ? 'scaleX(-1) translateZ(0)' : 'translateZ(0)', backfaceVisibility: 'hidden' }}
                />
                <canvas
                  ref={virtualCanvasRef}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    display: (!showPreview && selectedBg.type !== 'none' && camOn) ? 'block' : 'none',
                  }}
                />
                {showPreview && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={currentSlot?.leftPhotoUrl} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                )}
                {!camOn && !showPreview && (
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#090b12', gap: '8px', zIndex: 12 }}>
                    <CameraOffIcon size={26} color="var(--text-muted)" />
                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>Kamera Dimatikan</span>
                  </div>
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
                  style={{ width: '100%', height: '100%', objectFit: 'cover', filter: FILTER_CSS[filter], display: (showPreview || selectedBg.type !== 'none' || !camOn) ? 'none' : 'block', transform: isMirrored ? 'scaleX(-1) translateZ(0)' : 'translateZ(0)', backfaceVisibility: 'hidden' }}
                />
                <canvas
                  ref={virtualCanvasRef}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    display: (!showPreview && selectedBg.type !== 'none' && camOn) ? 'block' : 'none',
                  }}
                />
                {showPreview && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={currentSlot?.rightPhotoUrl} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                )}
                {!camOn && !showPreview && (
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#090b12', gap: '8px', zIndex: 12 }}>
                    <CameraOffIcon size={26} color="var(--text-muted)" />
                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>Kamera Dimatikan</span>
                  </div>
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

      {/* ── SUB-CAMERA MEDIA CONTROLS BAR (Directly below live camera) ── */}
      <div className="subcam-bar">
        <div className="subcam-toggle-group">
          {/* Mic Toggle Button */}
          {!isSolo && (
            <button
              type="button"
              onClick={handleToggleMic}
              disabled={isCaptureLocked}
              className={`subcam-btn ${micOn ? 'subcam-btn-active' : 'subcam-btn-muted'}`}
              title={micOn ? 'Matikan Mikrofon' : 'Nyalakan Mikrofon'}
              id="toggle-mic-btn"
            >
              {micOn ? (
                <>
                  <span className="audio-wave-dot" />
                  <MicIcon size={18} />
                  <span>Mic Nyala</span>
                </>
              ) : (
                <>
                  <MicOffIcon size={18} />
                  <span>Mic Mati</span>
                </>
              )}
            </button>
          )}

          {/* Camera Toggle Button */}
          <button
            type="button"
            onClick={handleToggleCam}
            disabled={isCaptureLocked}
            className={`subcam-btn ${camOn ? 'subcam-btn-active' : 'subcam-btn-muted'}`}
            title={camOn ? 'Matikan Kamera' : 'Nyalakan Kamera'}
            id="toggle-cam-btn"
          >
            {camOn ? (
              <>
                <CameraIcon size={18} />
                <span>Kamera Nyala</span>
              </>
            ) : (
              <>
                <CameraOffIcon size={18} />
                <span>Kamera Mati</span>
              </>
            )}
          </button>
        </div>

        {/* Flip Camera Button (mobile/front/rear) */}
        <div className="subcam-toggle-group">
          <button
            type="button"
            onClick={handleFlipCam}
            disabled={isCaptureLocked}
            className="subcam-btn subcam-btn-neutral"
            title="Ganti Kamera Depan/Belakang"
            id="flip-cam-btn"
          >
            <FlipCameraIcon size={18} />
            <span>Putar</span>
          </button>
        </div>

        {/* Mirror Toggle Button */}
        <div className="subcam-toggle-group">
          <button
            type="button"
            onClick={() => !isCaptureLocked && setIsMirrored((prev) => !prev)}
            disabled={isCaptureLocked}
            className={`subcam-btn ${isMirrored ? 'subcam-btn-active' : 'subcam-btn-neutral'}`}
            title={isMirrored ? 'Mirror Aktif (Kamera & foto dicerminkan)' : 'Mirror Mati (Kamera & foto orientasi asli)'}
            id="toggle-mirror-btn"
          >
            <MirrorIcon size={18} />
            <span>{isMirrored ? 'Mirror: On' : 'Mirror: Off'}</span>
          </button>
        </div>
      </div>

      {/* Controls Card */}
      <div className="glass-card" style={{ width: '100%', maxWidth: '680px', margin: '0 auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
        
        {/* Tools Switcher (Filter vs Virtual Background) */}
        {roundStatus === 'waiting_ready' && !isCaptureLocked && (
          <div className="camera-tools-tabs" role="tablist" aria-label="Alat Kamera">
            <button
              type="button"
              className={`camera-tool-tab ${activeToolTab === 'filter' ? 'active' : ''}`}
              onClick={() => setActiveToolTab('filter')}
              role="tab"
              aria-selected={activeToolTab === 'filter'}
              id="tool-tab-filter"
            >
              <SlidersIcon size={14} />
              <span>Filter Kamera</span>
              <span className="badge badge-neutral" style={{ fontSize: '10px' }}>
                {FILTERS.find((f) => f.id === filter)?.label || 'Original'}
              </span>
            </button>

            <button
              type="button"
              className={`camera-tool-tab ${activeToolTab === 'background' ? 'active' : ''}`}
              onClick={() => setActiveToolTab('background')}
              role="tab"
              aria-selected={activeToolTab === 'background'}
              id="tool-tab-bg"
            >
              <ImageIcon size={14} />
              <span>Ganti Background</span>
              <span className={`badge ${selectedBg.type !== 'none' ? 'badge-pink' : 'badge-neutral'}`} style={{ fontSize: '10px' }}>
                {selectedBg.name}
              </span>
            </button>
          </div>
        )}

        {/* ── 1. FILTER PANEL ────────────────────────────────────────────── */}
        {roundStatus === 'waiting_ready' && !isCaptureLocked && activeToolTab === 'filter' && (
          <div className="filter-bar-container">
            {/* Filter Header & Active Indicator */}
            <div className="filter-header-row">
              <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                <SlidersIcon size={14} color="var(--primary)" />
                Filter Kamera
              </span>
              <span className="badge badge-neutral" style={{ fontSize: '11px', padding: '2px 8px' }}>
                Aktif: <strong style={{ color: 'var(--primary)', marginLeft: '3px' }}>{FILTERS.find((f) => f.id === filter)?.label || 'Original'}</strong>
              </span>
            </div>

            {/* Category Tabs */}
            <div className="filter-category-tabs" role="tablist" aria-label="Kategori Filter">
              {FILTER_CATEGORIES.map((cat) => {
                const count = cat.id === 'all' ? FILTERS.length : FILTERS.filter((f) => f.category === cat.id).length;
                const active = selectedCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    className={`filter-category-btn ${active ? 'active' : ''}`}
                    onClick={() => setSelectedCategory(cat.id)}
                    role="tab"
                    aria-selected={active}
                  >
                    <span>{cat.icon}</span>
                    <span>{cat.label}</span>
                    <span style={{ opacity: 0.65, fontSize: '10px' }}>({count})</span>
                  </button>
                );
              })}
            </div>

            {/* Horizontal Filter Strip with Real-time Swatch Previews */}
            <div className="filter-scroll-strip" role="listbox" aria-label="Pilihan Filter">
              {FILTERS.filter((f) => selectedCategory === 'all' || f.category === selectedCategory).map((f) => {
                const active = filter === f.id;
                return (
                  <button
                    key={f.id}
                    type="button"
                    className={`filter-item-btn ${active ? 'active' : ''}`}
                    onClick={() => handleSelectFilter(f.id)}
                    id={`filter-${f.id}-btn`}
                    title={`${f.label} (${f.subtitle})`}
                    role="option"
                    aria-selected={active}
                  >
                    <div
                      className="filter-swatch"
                      style={{
                        filter: FILTER_CONFIGS[f.id] || 'none',
                      }}
                    />
                    <span style={{ whiteSpace: 'nowrap', lineHeight: 1.2 }}>{f.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ── 2. VIRTUAL BACKGROUND PANEL ────────────────────────────────── */}
        {roundStatus === 'waiting_ready' && !isCaptureLocked && activeToolTab === 'background' && (
          <div className="filter-bar-container">
            {/* Background Header & Active Indicator */}
            <div className="filter-header-row">
              <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                <ImageIcon size={14} color="var(--primary)" />
                Pilihan Virtual Background
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span className="badge badge-neutral" style={{ fontSize: '11px', padding: '2px 8px' }}>
                  Aktif: <strong style={{ color: 'var(--primary)', marginLeft: '3px' }}>{selectedBg.name}</strong>
                </span>
                {selectedBg.type !== 'none' && (
                  <button
                    type="button"
                    onClick={() => handleSelectBackground(BACKGROUND_PRESETS[0])}
                    className="btn btn-sm btn-ghost"
                    style={{ fontSize: '10.5px', padding: '2px 8px', color: '#f87171', height: 'auto', minHeight: 'unset' }}
                    title="Kembali ke kamera asli tanpa background"
                  >
                    ↺ Matikan BG
                  </button>
                )}
              </div>
            </div>

            {/* Notice / Information Banner about Public Community Background */}
            <div className="shared-bg-notice-box">
              <span style={{ fontSize: '18px', lineHeight: 1, flexShrink: 0 }}>🌍</span>
              <div className="shared-bg-notice-text">
                <strong style={{ color: '#f472b6' }}>Background Publik & Komunitas:</strong> Background yang kamu upload bersifat <strong>publik dan dapat digunakan oleh SEMUA ORANG</strong> di seluruh ruangan photobooth. Background tersimpan permanen di galeri publik (tidak terhapus seperti hasil foto capture).
              </div>
            </div>

            {/* Background Category Tabs */}
            <div className="filter-category-tabs" role="tablist" aria-label="Kategori Background">
              {BG_CATEGORIES.map((cat) => {
                const count = cat.id === 'all'
                  ? BACKGROUND_PRESETS.length + publicBackgrounds.length
                  : cat.id === 'custom'
                  ? publicBackgrounds.length
                  : BACKGROUND_PRESETS.filter((b) => b.category === cat.id).length;
                const active = selectedBgCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    className={`filter-category-btn ${active ? 'active' : ''}`}
                    onClick={() => setSelectedBgCategory(cat.id)}
                    role="tab"
                    aria-selected={active}
                  >
                    <span>{cat.icon}</span>
                    <span>{cat.label}</span>
                    <span style={{ opacity: 0.65, fontSize: '10px' }}>({count})</span>
                  </button>
                );
              })}
            </div>

            {/* Hidden Custom File Upload Input */}
            <input
              type="file"
              ref={customFileInputRef}
              accept="image/png, image/jpeg, image/webp"
              onChange={handleCustomBgUpload}
              style={{ display: 'none' }}
              id="hidden-custom-bg-input"
            />

            {/* Horizontal Background Strip */}
            <div className="filter-scroll-strip" role="listbox" aria-label="Pilihan Background">
              {/* Custom Upload Card (shown on 'all' or 'custom' tabs) */}
              {(selectedBgCategory === 'all' || selectedBgCategory === 'custom') && (
                <div
                  className="bg-upload-card"
                  title="Upload background sendiri untuk dibagikan ke semua orang di seluruh photobooth"
                >
                  <button
                    type="button"
                    className="bg-upload-btn-trigger"
                    onClick={() => customFileInputRef.current?.click()}
                    disabled={isUploadingBg}
                    title="Upload gambar publik dari perangkat Anda"
                  >
                    <div className="bg-upload-icon-box">
                      {isUploadingBg ? (
                        <span className="spinner" style={{ width: '16px', height: '16px' }} />
                      ) : (
                        <UploadIcon size={18} color="var(--primary)" />
                      )}
                    </div>
                    <span style={{ fontSize: '11px', fontWeight: 700, whiteSpace: 'nowrap' }}>
                      {isUploadingBg ? 'Mengunggah…' : '+ Upload'}
                    </span>
                    <span style={{ fontSize: '9px', color: 'var(--accent-pink)', fontWeight: 700, whiteSpace: 'nowrap' }}>
                      🌍 Publik
                    </span>
                  </button>
                </div>
              )}

              {/* Public Community Custom Backgrounds */}
              {(selectedBgCategory === 'all' || selectedBgCategory === 'custom') &&
                publicBackgrounds.map((sb) => {
                  const active = selectedBg.id === sb.id;
                  const isUploadedByMe = sb.uploadedById === myParticipantId;
                  return (
                    <div
                      key={sb.id}
                      className={`filter-item-btn shared-bg-item ${active ? 'active' : ''}`}
                      onClick={() => {
                        handleSelectBackground({
                          id: sb.id,
                          name: sb.name,
                          category: 'custom',
                          type: 'image',
                          subtitle: `Publik: Oleh ${isUploadedByMe ? 'Kamu' : sb.uploadedBy}`,
                          imageUrl: sb.url,
                          previewUrl: sb.url,
                        });
                      }}
                      role="option"
                      aria-selected={active}
                      title={`${sb.name} (Dibagikan ke publik oleh ${sb.uploadedBy})`}
                      style={{ position: 'relative' }}
                    >
                      <div
                        className="filter-swatch"
                        style={{
                          backgroundImage: `url(${sb.url})`,
                          backgroundSize: 'cover',
                          backgroundPosition: 'center',
                        }}
                      />
                      <span style={{ whiteSpace: 'nowrap', lineHeight: 1.2, maxWidth: '75px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {sb.name}
                      </span>
                      <span className="badge badge-pink" style={{ fontSize: '8.5px', padding: '1px 4px', lineHeight: 1.1 }}>
                        🌍 {isUploadedByMe ? 'Kamu' : sb.uploadedBy}
                      </span>
                      {isUploadedByMe && (
                        <button
                          type="button"
                          className="shared-bg-del-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveSharedBg(sb.id);
                          }}
                          title="Hapus background publik ini"
                        >
                          <TrashIcon size={10} />
                        </button>
                      )}
                    </div>
                  );
                })}

              {/* Preset Background Cards */}
              {BACKGROUND_PRESETS.filter((b) => selectedBgCategory === 'all' || b.category === selectedBgCategory).map((b) => {
                const active = selectedBg.id === b.id;
                return (
                  <button
                    key={b.id}
                    type="button"
                    className={`filter-item-btn ${active ? 'active' : ''}`}
                    onClick={() => handleSelectBackground(b)}
                    id={`bg-${b.id}-btn`}
                    title={`${b.name} (${b.subtitle})`}
                    role="option"
                    aria-selected={active}
                  >
                    {/* Swatch rendering based on type */}
                    <div
                      className="filter-swatch"
                      style={{
                        background:
                          b.type === 'color'
                            ? b.color
                            : b.type === 'image' && b.previewUrl
                            ? `url(${b.previewUrl}) center/cover no-repeat`
                            : b.type === 'blur'
                            ? 'radial-gradient(circle, rgba(99,102,241,0.5) 0%, rgba(30,41,59,0.9) 100%)'
                            : 'linear-gradient(135deg, #1e293b, #0f172a)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {b.type === 'none' && <CameraIcon size={16} color="var(--text-muted)" />}
                      {b.type === 'blur' && (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1px' }}>
                          <DropletIcon size={14} color="#60a5fa" />
                          <span style={{ fontSize: '9px', fontWeight: 800, color: '#e0f2fe' }}>{b.blurPx}px</span>
                        </div>
                      )}
                    </div>
                    <span style={{ whiteSpace: 'nowrap', lineHeight: 1.2 }}>{b.name}</span>
                  </button>
                );
              })}
            </div>
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

      {/* In-App Toast Notification */}
      {bgToastMessage && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(239, 68, 68, 0.95)',
          color: 'white',
          padding: '10px 18px',
          borderRadius: 'var(--radius-full)',
          boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
          zIndex: 99999,
          fontSize: '13px',
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
        }}>
          <span>{bgToastMessage}</span>
          <button
            onClick={() => setBgToastMessage(null)}
            style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', fontWeight: 800 }}
          >
            ✕
          </button>
        </div>
      )}

      {/* In-App Shared Background Deletion Confirmation Modal */}
      {confirmDeleteBgId && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(5, 7, 15, 0.85)',
          backdropFilter: 'blur(8px)',
          zIndex: 99999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
        }}>
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: 'var(--radius-lg)',
            padding: '26px 22px',
            maxWidth: '400px',
            width: '100%',
            textAlign: 'center',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.8)',
          }}>
            <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'white', marginBottom: '8px' }}>
              Hapus Background Publik?
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.5', marginBottom: '20px' }}>
              Background ini akan dihapus permanen dari galeri komunitas untuk semua orang.
            </p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setConfirmDeleteBgId(null)}
                style={{ flex: 1 }}
              >
                Batal
              </button>
              <button
                type="button"
                className="btn btn-danger btn-sm"
                onClick={executeRemoveSharedBg}
                style={{ flex: 1 }}
              >
                Ya, Hapus
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
