'use client';

import { useEffect, useState, useMemo } from 'react';
import { Socket } from 'socket.io-client';
import { PairedShot, Participant, Room } from '@/types';
import { FRAME_TEMPLATES, ExtendedFrameTemplate, getCanvasLayout, CanvasLayoutConfig } from '@/lib/frameTemplates';
import { stopVideoOnly, isMicEnabled, toggleMic, subscribeMicState } from '@/lib/webrtc';
import {
  CheckIcon,
  CloseIcon,
  ClockIcon,
  LayoutIcon,
  RefreshCwIcon,
  MoveIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  ZoomInIcon,
  ZoomOutIcon,
  SlidersIcon,
  MicIcon,
  MicOffIcon,
} from './Icons';
import { resolveMediaUrl } from '@/lib/config';

interface PhotoSelectionProps {
  room: Room;
  participants: Participant[];
  myParticipantId: string;
  slots: PairedShot[];
  socket: Socket;
  frameTemplateId?: string;
  customization?: { accentColor?: string; captionText?: string };
}

export interface IndividualPhoto {
  id: string; // e.g. "0_left" or "0_right" or "0_p1"
  slotIndex: number;
  side: 'left' | 'right' | string;
  url: string;
  participantName: string;
  isMe: boolean;
}

export interface PhotoOffset {
  x: number; // -50 to +50 (% shift)
  y: number; // -50 to +50 (% shift)
  scale: number; // 0.6 to 2.5
}

export default function PhotoSelection({
  room,
  participants,
  myParticipantId,
  slots,
  socket,
  frameTemplateId,
  customization,
}: PhotoSelectionProps) {
  const isSolo = room.capacity === 1 || room.settings?.mode === 'solo';

  // Determine chosen template
  const currentTemplateId = frameTemplateId || room.settings?.selectedFrameTemplateId || room.settings?.layout || 'frame_1x4_01';
  const template: ExtendedFrameTemplate = useMemo(() => {
    return FRAME_TEMPLATES.find((t) => t.id === currentTemplateId) || FRAME_TEMPLATES[0];
  }, [currentTemplateId]);

  const layout: CanvasLayoutConfig = useMemo(() => {
    return getCanvasLayout(template, isSolo);
  }, [template, isSolo]);

  const allCutoutBoxes = useMemo(() => {
    return [...layout.leftBoxes, ...layout.rightBoxes];
  }, [layout]);

  const totalSlots = allCutoutBoxes.length;

  const [slotAssignments, setSlotAssignments] = useState<(string | null)[]>(() => Array(totalSlots).fill(null));
  const [photoOffsets, setPhotoOffsets] = useState<Record<number, PhotoOffset>>({});
  const [confirmedIds, setConfirmedIds] = useState<string[]>([]);
  const [iConfirmed, setIConfirmed] = useState(false);
  const [activeSlotIndex, setActiveSlotIndex] = useState<number | null>(null);
  const [draggedPhotoId, setDraggedPhotoId] = useState<string | null>(null);
  const [dragOverSlotIndex, setDragOverSlotIndex] = useState<number | null>(null);
  const [micOn, setMicOn] = useState(isMicEnabled());

  useEffect(() => {
    stopVideoOnly();
    const unsub = subscribeMicState(setMicOn);
    return () => unsub();
  }, []);

  const handleToggleMic = async () => {
    const next = await toggleMic();
    setMicOn(next);
  };

  const me = participants.find((p) => p.id === myParticipantId);
  const partner = participants.find((p) => p.id !== myParticipantId);

  const availableSlots = slots.filter(
    (s) => s.status === 'locked' || Boolean(s.leftPhotoUrl || s.rightPhotoUrl || (s.photos && s.photos.length > 0))
  );

  // Flatten all taken shots into individual photos (Left & Right separate for Duo; single list for Solo; all participant photos for Group)
  const allIndividualPhotos = useMemo<IndividualPhoto[]>(() => {
    const list: IndividualPhoto[] = [];
    availableSlots.forEach((slot) => {
      if (slot.photos && slot.photos.length > 0) {
        slot.photos.forEach((sp, pIdx) => {
          const participant = participants.find((p) => p.id === sp.participantId);
          list.push({
            id: `${slot.slotIndex}_${sp.participantId || sp.side || pIdx}`,
            slotIndex: slot.slotIndex,
            side: sp.side || 'left',
            url: resolveMediaUrl(sp.url),
            participantName: sp.displayName || participant?.displayName || `Peserta ${pIdx + 1}`,
            isMe: sp.participantId === myParticipantId,
          });
        });
      } else if (isSolo) {
        const photoUrl = slot.leftPhotoUrl || slot.rightPhotoUrl;
        if (photoUrl) {
          list.push({
            id: `${slot.slotIndex}_left`,
            slotIndex: slot.slotIndex,
            side: 'left',
            url: resolveMediaUrl(photoUrl),
            participantName: me?.displayName || 'Foto Saya',
            isMe: true,
          });
        }
      } else {
        const leftP = participants.find((p) => p.side === 'left');
        const rightP = participants.find((p) => p.side === 'right');

        if (slot.leftPhotoUrl) {
          list.push({
            id: `${slot.slotIndex}_left`,
            slotIndex: slot.slotIndex,
            side: 'left',
            url: resolveMediaUrl(slot.leftPhotoUrl),
            participantName: leftP?.displayName || 'Person 1',
            isMe: leftP?.id === myParticipantId,
          });
        }
        if (slot.rightPhotoUrl) {
          list.push({
            id: `${slot.slotIndex}_right`,
            slotIndex: slot.slotIndex,
            side: 'right',
            url: resolveMediaUrl(slot.rightPhotoUrl),
            participantName: rightP?.displayName || 'Person 2',
            isMe: rightP?.id === myParticipantId,
          });
        }
      }
    });
    return list;
  }, [availableSlots, participants, myParticipantId, isSolo, me?.displayName]);

  // Ensure slot assignments size matches totalSlots when template changes
  useEffect(() => {
    setSlotAssignments((prev) => {
      const next = Array(totalSlots).fill(null);
      for (let i = 0; i < Math.min(prev.length, totalSlots); i++) {
        next[i] = prev[i];
      }
      return next;
    });
  }, [totalSlots]);


  // ─── Socket Sync ────────────────────────────────────────────────────────────
  useEffect(() => {
    const onSelectionUpdate = ({
      selectedOrder,
      photoOffsets: serverOffsets,
    }: {
      selectedOrder: (number | string)[];
      photoOffsets?: Record<number, PhotoOffset>;
    }) => {
      if (Array.isArray(selectedOrder)) {
        setSlotAssignments((prev) => {
          const next = Array(totalSlots).fill(null);
          selectedOrder.forEach((val, i) => {
            if (i < totalSlots && val) {
              next[i] = String(val);
            }
          });
          return next;
        });
      }
      if (serverOffsets && typeof serverOffsets === 'object') {
        setPhotoOffsets(serverOffsets);
      }
    };

    const onConfirmStatus = ({ confirmedParticipantIds }: { confirmedParticipantIds: string[] }) => {
      setConfirmedIds(confirmedParticipantIds);
      if (confirmedParticipantIds.includes(myParticipantId)) {
        setIConfirmed(true);
      } else {
        setIConfirmed(false);
      }
    };

    socket.on('photoSelection:update', onSelectionUpdate);
    socket.on('photoSelection:confirmStatus', onConfirmStatus);
    socket.emit('photoSelection:getState', { roomId: room.id });

    return () => {
      socket.off('photoSelection:update', onSelectionUpdate);
      socket.off('photoSelection:confirmStatus', onConfirmStatus);
    };
  }, [socket, room.id, totalSlots, myParticipantId]);

  // ─── Selection & Panning Actions ────────────────────────────────────────────
  function emitUpdate(newAssignments: (string | null)[], newOffsets = photoOffsets) {
    setSlotAssignments(newAssignments);
    setPhotoOffsets(newOffsets);
    socket.emit('photoSelection:update', {
      roomId: room.id,
      selectedOrder: newAssignments,
      photoOffsets: newOffsets,
    });
    setIConfirmed(false);
    socket.emit('photoSelection:resetConfirm', { roomId: room.id });
  }

  function handleAssignPhotoToSlot(slotIdx: number, photoId: string) {
    const next = [...slotAssignments];
    next[slotIdx] = photoId;
    emitUpdate(next);
    setActiveSlotIndex(slotIdx);
  }

  function handleClearSlot(slotIdx: number) {
    const next = [...slotAssignments];
    next[slotIdx] = null;
    const nextOffsets = { ...photoOffsets };
    delete nextOffsets[slotIdx];
    emitUpdate(next, nextOffsets);
    if (activeSlotIndex === slotIdx) {
      setActiveSlotIndex(null);
    }
  }

  function handleSwapSlots(fromSlotIdx: number, toSlotIdx: number) {
    if (fromSlotIdx === toSlotIdx) return;
    const next = [...slotAssignments];
    const temp = next[fromSlotIdx];
    next[fromSlotIdx] = next[toSlotIdx];
    next[toSlotIdx] = temp;

    const nextOffsets = { ...photoOffsets };
    const tempOff = nextOffsets[fromSlotIdx];
    nextOffsets[fromSlotIdx] = nextOffsets[toSlotIdx];
    nextOffsets[toSlotIdx] = tempOff;

    emitUpdate(next, nextOffsets);
  }

  function handleUpdateOffset(
    slotIdx: number,
    delta: { x?: number; y?: number; scale?: number },
    absolute = false,
  ) {
    const current = photoOffsets[slotIdx] || { x: 0, y: 0, scale: 1.0 };
    const nextX = absolute && delta.x !== undefined ? delta.x : Math.max(-50, Math.min(50, current.x + (delta.x || 0)));
    const nextY = absolute && delta.y !== undefined ? delta.y : Math.max(-50, Math.min(50, current.y + (delta.y || 0)));
    const nextScale = absolute && delta.scale !== undefined ? delta.scale : Math.max(0.6, Math.min(2.5, current.scale + (delta.scale || 0)));

    const nextOffsets = {
      ...photoOffsets,
      [slotIdx]: {
        x: Math.round(nextX),
        y: Math.round(nextY),
        scale: Number(nextScale.toFixed(2)),
      },
    };
    emitUpdate(slotAssignments, nextOffsets);
  }

  function handleResetOffset(slotIdx: number) {
    const nextOffsets = { ...photoOffsets };
    delete nextOffsets[slotIdx];
    emitUpdate(slotAssignments, nextOffsets);
  }

  function handleAutoFill() {
    const next = Array(totalSlots).fill(null);
    if (layout.isTwinStrip && layout.leftBoxes.length > 0 && layout.rightBoxes.length > 0) {
      const leftPhotos = allIndividualPhotos.filter((p) => p.side === 'left');
      const rightPhotos = allIndividualPhotos.filter((p) => p.side === 'right');
      const leftBoxCount = layout.leftBoxes.length;

      layout.leftBoxes.forEach((_, idx) => {
        if (leftPhotos[idx]) {
          next[idx] = leftPhotos[idx].id;
        } else if (allIndividualPhotos[idx]) {
          next[idx] = allIndividualPhotos[idx].id;
        }
      });

      layout.rightBoxes.forEach((_, idx) => {
        const slotIdx = leftBoxCount + idx;
        if (rightPhotos[idx]) {
          next[slotIdx] = rightPhotos[idx].id;
        } else if (allIndividualPhotos[idx]) {
          next[slotIdx] = allIndividualPhotos[idx].id;
        }
      });
    } else {
      allIndividualPhotos.forEach((photo, idx) => {
        if (idx < totalSlots) {
          next[idx] = photo.id;
        }
      });
    }
    emitUpdate(next);
  }

  function handleClearAll() {
    const next = Array(totalSlots).fill(null);
    emitUpdate(next, {});
    setActiveSlotIndex(null);
  }

  function handleConfirm() {
    setIConfirmed(true);
    socket.emit('photoSelection:confirm', { roomId: room.id });
  }

  function handleChangeTemplate() {
    socket.emit('frame:changeTemplate', { roomId: room.id });
  }

  // ─── Drag & Drop Handlers ──────────────────────────────────────────────────
  function handleDragStartGallery(e: React.DragEvent, photoId: string) {
    setDraggedPhotoId(photoId);
    e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'gallery', photoId }));
    e.dataTransfer.effectAllowed = 'copyMove';
  }

  function handleDragStartSlot(e: React.DragEvent, slotIdx: number, photoId: string) {
    setDraggedPhotoId(photoId);
    e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'slot', slotIdx, photoId }));
    e.dataTransfer.effectAllowed = 'move';
  }

  function handleDragOver(e: React.DragEvent, slotIdx: number) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverSlotIndex !== slotIdx) {
      setDragOverSlotIndex(slotIdx);
    }
  }

  function handleDragLeave(e: React.DragEvent, slotIdx: number) {
    if (dragOverSlotIndex === slotIdx) {
      setDragOverSlotIndex(null);
    }
  }

  function handleDropOnSlot(e: React.DragEvent, targetSlotIdx: number) {
    e.preventDefault();
    setDragOverSlotIndex(null);
    try {
      const dataStr = e.dataTransfer.getData('text/plain');
      const data = dataStr ? JSON.parse(dataStr) : { type: 'gallery', photoId: draggedPhotoId };

      if (data.type === 'slot' && typeof data.slotIdx === 'number') {
        handleSwapSlots(data.slotIdx, targetSlotIdx);
      } else if (data.photoId) {
        handleAssignPhotoToSlot(targetSlotIdx, data.photoId);
      }
    } catch {
      if (draggedPhotoId) {
        handleAssignPhotoToSlot(targetSlotIdx, draggedPhotoId);
      }
    }
    setDraggedPhotoId(null);
  }

  const assignedCount = slotAssignments.filter(Boolean).length;
  const activeAssignedPhotoId = activeSlotIndex !== null ? slotAssignments[activeSlotIndex] : null;
  const activePhoto = activeAssignedPhotoId ? allIndividualPhotos.find((p) => p.id === activeAssignedPhotoId) : null;
  const currentSlotOffset = activeSlotIndex !== null ? photoOffsets[activeSlotIndex] || { x: 0, y: 0, scale: 1.0 } : { x: 0, y: 0, scale: 1.0 };

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', padding: '16px', gap: '16px', maxWidth: '1280px', margin: '0 auto', width: '100%' }}>
      {/* Voice Call Bar (Duo & Group mode communication) */}
      {!isSolo && (
        <div className="voice-call-bar">
          <div className="voice-call-info">
            <span className="badge badge-green" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <span className="audio-wave-dot" />
              Obrolan Suara Aktif
            </span>
            <span style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>
              Kamera dimatikan. Mikrofon aktif untuk berkoordinasi menata foto.
            </span>
          </div>
          <button
            type="button"
            onClick={handleToggleMic}
            className={`subcam-btn ${micOn ? 'subcam-btn-active' : 'subcam-btn-muted'}`}
            id="photo-selection-mic-toggle-btn"
          >
            {micOn ? (
              <>
                <MicIcon size={16} />
                <span>Mic Nyala</span>
              </>
            ) : (
              <>
                <MicOffIcon size={16} />
                <span>Mic Mati</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--accent-pink)', marginBottom: '4px' }}>
            <LayoutIcon size={16} />
            <span style={{ fontSize: '13px', fontWeight: 700, letterSpacing: '0.05em' }}>PENATAAN FOTO & POSISI</span>
          </div>
          <h1 style={{ fontSize: '24px', fontWeight: 800 }}>Atur Posisi & Geser Foto ke Frame</h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: '2px', fontSize: '13px' }}>
            Template: <strong style={{ color: 'white' }}>{template.name}</strong> — Klik slot foto untuk menggeser kiri/kanan/atas/bawah dan menyesuaikan zoom objek.
          </p>
        </div>

        {/* Quick Toolbar */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button className="btn btn-secondary btn-sm" onClick={handleChangeTemplate} id="back-to-frame-btn" style={{ fontWeight: 700 }}>
            <ArrowLeftIcon size={14} /> Kembali / Ganti Frame
          </button>
          <button className="btn btn-secondary btn-sm" onClick={handleAutoFill} id="auto-fill-btn" title="Otomatis isi semua slot berurutan">
            <LayoutIcon size={14} /> Auto-Fill
          </button>
          {assignedCount > 0 && (
            <button className="btn btn-secondary btn-sm" onClick={handleClearAll} id="clear-all-btn">
              <RefreshCwIcon size={14} /> Reset Semua
            </button>
          )}
        </div>
      </div>

      {/* Main Content Area: Left = Interactive Frame Board, Right = Photo Pool + Adjustment Tool */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 460px) 1fr', gap: '20px', alignItems: 'start' }} className="responsive-split">
        
        {/* ─── 1. INTERACTIVE LIVE FRAME BOARD ────────────────────────────────────── */}
        <div className="glass-card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-secondary)' }}>
              Layout Frame ({assignedCount}/{totalSlots} Terisi)
            </span>
            <span className="badge badge-neutral" style={{ fontSize: '11px' }}>
              {layout.isTwinStrip ? 'Twin Photostrips' : (template.layout_type?.includes('1x') || template.category?.includes('1x') ? `${totalSlots}-Cut Photostrip` : `${totalSlots}-Cut Grid`)}
            </span>
          </div>

          {/* Scaled Frame Canvas Box */}
          <div
            style={{
              position: 'relative',
              width: '100%',
              maxWidth: layout.isTwinStrip ? '420px' : (template.layout_type?.includes('1x') || template.category?.includes('1x')) ? '260px' : '380px',
              aspectRatio: `${layout.width} / ${layout.height}`,
              margin: '0 auto',
              backgroundColor: '#0c0d14',
              borderRadius: '12px',
              overflow: 'hidden',
              boxShadow: '0 10px 36px rgba(0,0,0,0.6)',
              border: '1px solid rgba(255,255,255,0.1)',
            }}
          >
            {/* Cutout Slot Drop Zones */}
            {allCutoutBoxes.map((box, idx) => {
              const assignedPhotoId = slotAssignments[idx];
              const photo = assignedPhotoId ? allIndividualPhotos.find((p) => p.id === assignedPhotoId) : null;
              const isOver = dragOverSlotIndex === idx;
              const isSelected = activeSlotIndex === idx;
              const off = photoOffsets[idx] || { x: 0, y: 0, scale: 1.0 };

              // Percentage coordinates on canvas
              const leftPct = (box.x / layout.width) * 100;
              const topPct = (box.y / layout.height) * 100;
              const widthPct = (box.width / layout.width) * 100;
              const heightPct = (box.height / layout.height) * 100;

              return (
                <div
                  key={`cutout-${idx}`}
                  onDragOver={(e) => handleDragOver(e, idx)}
                  onDragLeave={(e) => handleDragLeave(e, idx)}
                  onDrop={(e) => handleDropOnSlot(e, idx)}
                  onClick={() => {
                    if (activeSlotIndex !== null && activeSlotIndex !== idx && !slotAssignments[idx] && !slotAssignments[activeSlotIndex]) {
                      setActiveSlotIndex(idx);
                    } else if (activeSlotIndex !== null && activeSlotIndex !== idx && slotAssignments[activeSlotIndex] && !slotAssignments[idx]) {
                      handleSwapSlots(activeSlotIndex, idx);
                      setActiveSlotIndex(idx);
                    } else {
                      setActiveSlotIndex(isSelected ? null : idx);
                    }
                  }}
                  draggable={!!photo}
                  onDragStart={(e) => {
                    if (photo) handleDragStartSlot(e, idx, photo.id);
                  }}
                  style={{
                    position: 'absolute',
                    left: `${leftPct}%`,
                    top: `${topPct}%`,
                    width: `${widthPct}%`,
                    height: `${heightPct}%`,
                    backgroundColor: photo ? 'transparent' : 'rgba(255,255,255,0.04)',
                    border: isOver
                      ? '2.5px dashed var(--accent-pink)'
                      : isSelected
                      ? '2.5px solid #a855f7'
                      : photo
                      ? 'none'
                      : '1.5px dashed rgba(255,255,255,0.25)',
                    boxShadow: isSelected ? '0 0 12px rgba(168,85,247,0.8)' : 'none',
                    borderRadius: photo ? 0 : '4px',
                    overflow: 'hidden',
                    cursor: photo ? 'pointer' : 'pointer',
                    zIndex: isSelected ? 3 : 2,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'border 0.15s ease, box-shadow 0.15s ease',
                  }}
                >
                  {photo ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={photo.url}
                        alt={photo.participantName}
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                          objectPosition: `${50 + (off.x || 0)}% ${50 + (off.y || 0)}%`,
                          transform: `scale(${off.scale || 1})`,
                          transformOrigin: `${50 + (off.x || 0)}% ${50 + (off.y || 0)}%`,
                          display: 'block',
                          pointerEvents: 'none',
                          transition: 'object-position 0.05s ease-out, transform 0.05s ease-out',
                        }}
                      />
                      {/* Slot info badge */}
                      <div
                        style={{
                          position: 'absolute',
                          top: '4px',
                          left: '4px',
                          background: isSelected ? 'rgba(168,85,247,0.9)' : 'rgba(0,0,0,0.7)',
                          borderRadius: '4px',
                          padding: '2px 5px',
                          fontSize: '10px',
                          fontWeight: 700,
                          color: 'white',
                          backdropFilter: 'blur(4px)',
                        }}
                      >
                        #{idx + 1} {photo.participantName.split(' ')[0]}
                      </div>

                      {/* Remove button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleClearSlot(idx);
                        }}
                        style={{
                          position: 'absolute',
                          top: '4px',
                          right: '4px',
                          background: 'rgba(239, 68, 68, 0.9)',
                          border: 'none',
                          borderRadius: '50%',
                          width: '18px',
                          height: '18px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'white',
                          cursor: 'pointer',
                          padding: 0,
                          zIndex: 5,
                        }}
                        title="Hapus foto dari slot ini"
                      >
                        <CloseIcon size={11} />
                      </button>
                    </>
                  ) : (
                    <div style={{ textAlign: 'center', padding: '4px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)' }}>Slot #{idx + 1}</span>
                      <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>+ Drop / Klik</span>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Top Transparent PNG Frame Overlay (Layer 3 - strictly sitting on top) */}
            {layout.overlayUrl && (
              <>
                {layout.isTwinStrip && layout.singleStripWidth ? (
                  <>
                    {/* Left Twin Strip Frame */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={layout.overlayUrl}
                      alt="Left Frame Overlay"
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: `${(layout.singleStripWidth / layout.width) * 100}%`,
                        height: '100%',
                        objectFit: 'fill',
                        pointerEvents: 'none',
                        zIndex: 4,
                      }}
                    />
                    {/* Right Twin Strip Frame */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={layout.overlayUrl}
                      alt="Right Frame Overlay"
                      style={{
                        position: 'absolute',
                        top: 0,
                        right: 0,
                        width: `${(layout.singleStripWidth / layout.width) * 100}%`,
                        height: '100%',
                        objectFit: 'fill',
                        pointerEvents: 'none',
                        zIndex: 4,
                      }}
                    />
                  </>
                ) : (
                  // Grid Frame Overlay
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={layout.overlayUrl}
                    alt="Frame Overlay"
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: '100%',
                      objectFit: 'fill',
                      pointerEvents: 'none',
                      zIndex: 4,
                    }}
                  />
                )}
              </>
            )}
          </div>
        </div>

        {/* ─── 2. RIGHT COLUMN: PHOTO POOL & POSITION ADJUSTMENT TOOL ────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* ── 2A. ACTIVE PHOTO POSITION ADJUSTER PANEL (Appears when a slot with a photo is selected) ── */}
          {activeSlotIndex !== null && activePhoto && (
            <div
              className="glass-card"
              style={{
                padding: '16px 20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px',
                border: '1.5px solid rgba(168,85,247,0.5)',
                background: 'rgba(24, 18, 38, 0.75)',
                boxShadow: '0 8px 30px rgba(168,85,247,0.15)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div
                    style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '8px',
                      background: '#a855f7',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'white',
                    }}
                  >
                    <SlidersIcon size={16} />
                  </div>
                  <div>
                    <h2 style={{ fontSize: '15px', fontWeight: 800 }}>
                      Atur Posisi Foto Slot #{activeSlotIndex + 1}
                    </h2>
                    <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                      {activePhoto.participantName} (Foto {activePhoto.slotIndex + 1}) — Geser agar wajah pas di dalam cutout
                    </p>
                  </div>
                </div>

                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => setActiveSlotIndex(null)}
                  style={{ padding: '4px 8px' }}
                >
                  <CloseIcon size={14} /> Selesai
                </button>
              </div>

              {/* Adjuster Controls Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', alignItems: 'center' }}>
                {/* Directional 4-Way Pan Buttons */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-muted)' }}>Geser Arah Cepat</span>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 38px)', gridTemplateRows: 'repeat(3, 34px)', gap: '4px', alignItems: 'center', justifyItems: 'center' }}>
                    <div />
                    <button
                      className="btn btn-secondary btn-sm"
                      style={{ width: '38px', height: '34px', padding: 0 }}
                      onClick={() => handleUpdateOffset(activeSlotIndex, { y: -5 })}
                      title="Geser Foto ke Atas"
                    >
                      <ArrowUpIcon size={15} />
                    </button>
                    <div />

                    <button
                      className="btn btn-secondary btn-sm"
                      style={{ width: '38px', height: '34px', padding: 0 }}
                      onClick={() => handleUpdateOffset(activeSlotIndex, { x: -5 })}
                      title="Geser Foto ke Kiri"
                    >
                      <ArrowLeftIcon size={15} />
                    </button>
                    <button
                      className="btn btn-secondary btn-sm"
                      style={{ width: '38px', height: '34px', padding: 0, fontSize: '11px', fontWeight: 800 }}
                      onClick={() => handleResetOffset(activeSlotIndex)}
                      title="Kembali ke Tengah"
                    >
                      •
                    </button>
                    <button
                      className="btn btn-secondary btn-sm"
                      style={{ width: '38px', height: '34px', padding: 0 }}
                      onClick={() => handleUpdateOffset(activeSlotIndex, { x: 5 })}
                      title="Geser Foto ke Kanan"
                    >
                      <ArrowRightIcon size={15} />
                    </button>

                    <div />
                    <button
                      className="btn btn-secondary btn-sm"
                      style={{ width: '38px', height: '34px', padding: 0 }}
                      onClick={() => handleUpdateOffset(activeSlotIndex, { y: 5 })}
                      title="Geser Foto ke Bawah"
                    >
                      <ArrowDownIcon size={15} />
                    </button>
                    <div />
                  </div>
                </div>

                {/* Sliders for precise pan & zoom */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {/* Horizontal Pan */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', marginBottom: '3px' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Geser Kiri / Kanan:</span>
                      <strong style={{ color: 'white' }}>{currentSlotOffset.x > 0 ? `+${currentSlotOffset.x}%` : `${currentSlotOffset.x}%`}</strong>
                    </div>
                    <input
                      type="range"
                      min="-50"
                      max="50"
                      step="1"
                      value={currentSlotOffset.x}
                      onChange={(e) => handleUpdateOffset(activeSlotIndex, { x: Number(e.target.value) }, true)}
                      style={{ width: '100%', accentColor: '#a855f7' }}
                    />
                  </div>

                  {/* Vertical Pan */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', marginBottom: '3px' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Geser Atas / Bawah:</span>
                      <strong style={{ color: 'white' }}>{currentSlotOffset.y > 0 ? `+${currentSlotOffset.y}%` : `${currentSlotOffset.y}%`}</strong>
                    </div>
                    <input
                      type="range"
                      min="-50"
                      max="50"
                      step="1"
                      value={currentSlotOffset.y}
                      onChange={(e) => handleUpdateOffset(activeSlotIndex, { y: Number(e.target.value) }, true)}
                      style={{ width: '100%', accentColor: '#a855f7' }}
                    />
                  </div>

                  {/* Zoom / Scale */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', marginBottom: '3px' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Zoom / Skala Objek:</span>
                      <strong style={{ color: 'white' }}>{currentSlotOffset.scale.toFixed(2)}x</strong>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <button
                        className="btn btn-secondary btn-sm"
                        style={{ padding: '3px 8px' }}
                        onClick={() => handleUpdateOffset(activeSlotIndex, { scale: -0.1 })}
                        title="Perkecil Objek"
                      >
                        <ZoomOutIcon size={13} />
                      </button>
                      <input
                        type="range"
                        min="0.6"
                        max="2.2"
                        step="0.05"
                        value={currentSlotOffset.scale}
                        onChange={(e) => handleUpdateOffset(activeSlotIndex, { scale: Number(e.target.value) }, true)}
                        style={{ flex: 1, accentColor: '#a855f7' }}
                      />
                      <button
                        className="btn btn-secondary btn-sm"
                        style={{ padding: '3px 8px' }}
                        onClick={() => handleUpdateOffset(activeSlotIndex, { scale: 0.1 })}
                        title="Perbesar Objek"
                      >
                        <ZoomInIcon size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── 2B. CAPTURED PHOTOS GALLERY POOL ── */}
          <div className="glass-card" style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h2 style={{ fontSize: '16px', fontWeight: 800 }}>Kumpulan Foto Sesi ({allIndividualPhotos.length})</h2>
                <span className="badge badge-neutral" style={{ fontSize: '11px' }}>
                  <MoveIcon size={12} /> Bebas Dipilih Berkali-kali
                </span>
              </div>
              {activeSlotIndex !== null ? (
                <div style={{ padding: '8px 12px', background: 'rgba(168,85,247,0.18)', border: '1px solid rgba(168,85,247,0.4)', borderRadius: 'var(--radius-sm)', color: '#e9d5ff', fontSize: '12px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px' }}>
                  <span>👉</span>
                  <span><strong>Slot #{activeSlotIndex + 1} dipilih.</strong> Sentuh foto di bawah ini untuk memasukkannya ke Slot #{activeSlotIndex + 1}.</span>
                </div>
              ) : (
                <p style={{ color: 'var(--text-secondary)', fontSize: '12px', marginTop: '4px' }}>
                  Sentuh slot foto pada frame untuk mengatur posisi/zoom, atau sentuh foto di bawah untuk memasukkan ke slot frame.
                </p>
              )}
            </div>

            <div className="photo-pool-grid">
              {allIndividualPhotos.map((photo) => {
                const placedSlots = slotAssignments
                  .map((id, idx) => (id === photo.id ? idx + 1 : null))
                  .filter((idx): idx is number => idx !== null);
                const isPlaced = placedSlots.length > 0;

                return (
                  <div
                    key={photo.id}
                    draggable
                    onDragStart={(e) => handleDragStartGallery(e, photo.id)}
                    onClick={() => {
                      if (activeSlotIndex !== null) {
                        handleAssignPhotoToSlot(activeSlotIndex, photo.id);
                      } else {
                        const firstEmpty = slotAssignments.indexOf(null);
                        if (firstEmpty !== -1) {
                          handleAssignPhotoToSlot(firstEmpty, photo.id);
                        } else {
                          handleAssignPhotoToSlot(0, photo.id);
                        }
                      }
                    }}
                    style={{
                      position: 'relative',
                      aspectRatio: '3/4',
                      borderRadius: '8px',
                      overflow: 'hidden',
                      border: isPlaced ? '2px solid var(--accent-pink, #ff5e97)' : '1px solid var(--border-subtle)',
                      cursor: 'grab',
                      backgroundColor: '#12131a',
                      transition: 'transform 0.15s ease, border-color 0.15s ease',
                    }}
                    title={isPlaced ? `Foto ini sudah dipakai di Slot #${placedSlots.join(', #')} (Klik untuk tambah ke slot lain)` : 'Klik atau drag foto ini ke slot frame'}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photo.url}
                      alt={photo.participantName}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        display: 'block',
                      }}
                    />

                    {/* Top info badge */}
                    <div
                      style={{
                        position: 'absolute',
                        top: '6px',
                        left: '6px',
                        background: 'rgba(0,0,0,0.7)',
                        borderRadius: '4px',
                        padding: '2px 6px',
                        fontSize: '10px',
                        fontWeight: 700,
                        color: 'white',
                        backdropFilter: 'blur(4px)',
                      }}
                    >
                      {photo.participantName} (Foto {photo.slotIndex + 1})
                    </div>

                    {/* Placed indicator badge */}
                    {isPlaced && (
                      <div
                        style={{
                          position: 'absolute',
                          bottom: '6px',
                          right: '6px',
                          background: placedSlots.length > 1 ? 'var(--accent-pink, #ff5e97)' : '#10b981',
                          borderRadius: '12px',
                          padding: '2px 8px',
                          fontSize: '10px',
                          fontWeight: 800,
                          color: 'white',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '3px',
                          boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
                        }}
                      >
                        <CheckIcon size={10} /> {placedSlots.length > 1 ? `${placedSlots.length}x (Slot #${placedSlots.join(', #')})` : `Slot #${placedSlots[0]}`}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Action / Ready Confirmation Area */}
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {/* Status indicators */}
              {!isSolo && (
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap' }}>
                  {participants.map((p) => {
                    const confirmed = confirmedIds.includes(p.id);
                    return (
                      <span key={p.id} className={`badge ${confirmed ? 'badge-green' : 'badge-neutral'}`} style={{ fontSize: '11.5px' }}>
                        {confirmed ? <CheckIcon size={11} /> : <ClockIcon size={11} />}
                        {p.displayName} {p.id === myParticipantId ? '(Kamu)' : ''}: {confirmed ? 'Sudah Konfirmasi' : 'Menata Foto…'}
                      </span>
                    );
                  })}
                </div>
              )}

              <div className="photo-selection-actions">
                <button
                  className="btn btn-secondary btn-lg"
                  onClick={handleChangeTemplate}
                  id="bottom-back-to-frame-btn"
                  style={{ fontWeight: 700 }}
                  title="Kembali ke pemilihan frame"
                >
                  <ArrowLeftIcon size={16} /> Pilih Ulang Frame
                </button>

                <button
                  className="btn btn-primary btn-lg"
                  onClick={handleConfirm}
                  disabled={iConfirmed}
                  id="confirm-placement-btn"
                  style={{ flex: 1, minWidth: '220px', fontSize: '15px' }}
                >
                  {iConfirmed ? (
                    <><span className="spinner" /> {isSolo ? 'Memproses & Merender HD…' : `Menunggu ${partner?.displayName || 'Partner'} Mengonfirmasi…`}</>
                  ) : (
                    <><CheckIcon size={18} /> Konfirmasi Penataan & Render Foto HD</>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
