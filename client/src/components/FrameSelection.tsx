'use client';

import { useState, useMemo, useEffect } from 'react';
import { Socket } from 'socket.io-client';
import { PairedShot, Participant, Room, VoteStatus } from '@/types';
import { FRAME_TEMPLATES, ExtendedFrameTemplate, fetchAllFrameTemplates } from '@/lib/frameTemplates';
import { CheckIcon, PaletteIcon, ClockIcon, UploadIcon } from './Icons';
import UploadFrameModal from './UploadFrameModal';

interface FrameSelectionProps {
  room: Room;
  participants: Participant[];
  myParticipantId: string;
  slots: PairedShot[];
  votes: VoteStatus[];
  socket: Socket;
}

const ACCENT_COLORS = [
  { value: '#ff5e97', label: 'Pink' },
  { value: '#8b5cf6', label: 'Violet' },
  { value: '#06b6d4', label: 'Cyan' },
  { value: '#10b981', label: 'Green' },
  { value: '#f59e0b', label: 'Amber' },
  { value: '#ef4444', label: 'Red' },
  { value: '#ffffff', label: 'White' },
];

export default function FrameSelection({ room, participants, myParticipantId, slots, votes, socket }: FrameSelectionProps) {
  const [allTemplates, setAllTemplates] = useState<ExtendedFrameTemplate[]>(FRAME_TEMPLATES);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [accentColor, setAccentColor] = useState('#ff5e97');
  const [captionText, setCaptionText] = useState('');
  const [activeCategory, setActiveCategory] = useState<'all' | 'custom' | '1x3' | '1x4' | '2x2' | '2x3'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isUploadOpen, setIsUploadOpen] = useState(false);

  // Dynamically fetch all shared custom frames and merge with built-ins
  useEffect(() => {
    let mounted = true;
    fetchAllFrameTemplates().then((templates) => {
      if (mounted && templates.length > 0) {
        setAllTemplates(templates);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  const me = participants.find((p) => p.id === myParticipantId);
  const partner = participants.find((p) => p.id !== myParticipantId);

  const myVote = votes.find((v) => v.participantId === myParticipantId);
  const partnerVote = votes.find((v) => v.participantId !== myParticipantId);

  function handleVote(templateId: string) {
    setSelectedTemplateId(templateId);
    socket.emit('vote:cast', {
      roomId: room.id,
      frameTemplateId: templateId,
      customization: { accentColor, captionText },
    });
  }

  function handleCustomizationChange(newColor?: string, newCaption?: string) {
    const color = newColor ?? accentColor;
    const caption = newCaption ?? captionText;
    if (newColor) setAccentColor(newColor);
    if (newCaption !== undefined) setCaptionText(newCaption);
    if (selectedTemplateId) {
      socket.emit('vote:cast', {
        roomId: room.id,
        frameTemplateId: selectedTemplateId,
        customization: { accentColor: color, captionText: caption },
      });
    }
  }

  function handleFrameCreated(newFrame: ExtendedFrameTemplate) {
    setAllTemplates((prev) => [newFrame, ...prev.filter((t) => t.id !== newFrame.id)]);
    setActiveCategory('custom');
    handleVote(newFrame.id);
  }

  const isSolo = room.capacity === 1 || room.settings?.mode === 'solo';
  const unanimousTemplateId = isSolo
    ? (votes.length >= 1 ? votes[0].frameTemplateId : null)
    : (votes.length >= 2 && votes.every((v) => v.frameTemplateId === votes[0].frameTemplateId) ? votes[0].frameTemplateId : null);

  // Filter templates by category and search
  const filteredTemplates = useMemo(() => {
    return allTemplates.filter((t) => {
      const isCustom = t.isCustom || t.id.startsWith('custom_');
      const matchCat =
        activeCategory === 'all' ||
        (activeCategory === 'custom' && isCustom) ||
        (activeCategory !== 'custom' && (t.category === activeCategory || t.layout_type?.includes(activeCategory)));
      const matchQuery = !searchQuery || t.name.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCat && matchQuery;
    });
  }, [allTemplates, activeCategory, searchQuery]);

  const countCustom = allTemplates.filter((t) => t.isCustom || t.id.startsWith('custom_')).length;
  const count1x3 = allTemplates.filter((t) => t.category === '1x3' || t.layout_type?.includes('1x3')).length;
  const count1x4 = allTemplates.filter((t) => t.category === '1x4' || t.layout_type?.includes('1x4')).length;
  const count2x2 = allTemplates.filter((t) => t.category === '2x2' || t.layout_type?.includes('2x2')).length;
  const count2x3 = allTemplates.filter((t) => t.category === '2x3' || t.layout_type?.includes('2x3')).length;

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', padding: '16px', gap: '16px', maxWidth: '1120px', margin: '0 auto', width: '100%' }}>
      {/* Upload Frame Modal */}
      <UploadFrameModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onFrameCreated={handleFrameCreated}
      />

      {/* Header */}
      <div style={{ textAlign: 'center' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--accent-pink)', marginBottom: '4px' }}>
          <PaletteIcon size={16} />
          <span style={{ fontSize: '13px', fontWeight: 700, letterSpacing: '0.05em' }}>PILIH TEMPLATE FRAME</span>
        </div>
        <h1 style={{ fontSize: '24px', fontWeight: 800 }}>
          {isSolo ? 'Pilih Frame Favorit Kamu' : 'Pilih Frame Favorit Kamu & Partner'}
        </h1>
        <p style={{ color: 'var(--text-secondary)', marginTop: '4px', fontSize: '13px' }}>
          {isSolo
            ? `Pilih salah satu template atau unggah desainmu sendiri (${allTemplates.length} Frame Tersedia).`
            : `Pilih template yang sama bersama partnermu untuk lanjut ke penataan posisi foto (${allTemplates.length} Frame Tersedia).`}
        </p>
      </div>

      {/* Vote Status Bar */}
      <div className="glass-card" style={{ padding: '10px 18px', display: 'flex', gap: '12px', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap' }}>
        {participants.map((p) => {
          const vote = votes.find((v) => v.participantId === p.id);
          const template = vote ? allTemplates.find((t) => t.id === vote.frameTemplateId) : null;
          const isMe = p.id === myParticipantId;
          return (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: 'var(--radius-full)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: p.side === 'left' ? 'linear-gradient(135deg, #ff5e97, #f43f5e)' : 'linear-gradient(135deg, #8b5cf6, #6366f1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, color: 'white' }}>
                {p.displayName.charAt(0)}
              </div>
              <span style={{ fontSize: '12.5px', fontWeight: 600 }}>{p.displayName} {isMe ? '(Kamu)' : ''}:</span>
              {vote ? (
                <span className="badge badge-green" style={{ fontSize: '11px' }}>
                  <CheckIcon size={11} /> {template?.name ?? vote.frameTemplateId}
                </span>
              ) : (
                <span className="badge badge-neutral" style={{ fontSize: '11px' }}>
                  <ClockIcon size={11} /> Sedang Memilih…
                </span>
              )}
            </div>
          );
        })}

        {unanimousTemplateId && (
          <span className="badge badge-green" style={{ fontSize: '12px', padding: '5px 14px' }}>
            <CheckIcon size={13} /> {isSolo ? 'Frame Terpilih! Membuka Penataan Foto…' : 'Pilihan Sepakat! Membuka Penataan Foto…'}
          </span>
        )}
      </div>

      {/* Category Tabs & Search Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        <div className="filter-tabs touch-scroll" style={{ display: 'flex', flexWrap: 'nowrap', gap: '6px', maxWidth: '100%', overflowX: 'auto', paddingBottom: '4px' }}>
          <button
            className={`filter-tab ${activeCategory === 'all' ? 'active' : ''}`}
            onClick={() => setActiveCategory('all')}
          >
            Semua ({allTemplates.length})
          </button>
          <button
            className={`filter-tab ${activeCategory === 'custom' ? 'active' : ''}`}
            onClick={() => setActiveCategory('custom')}
          >
            Kustom ({countCustom})
          </button>
          <button
            className={`filter-tab ${activeCategory === '1x3' ? 'active' : ''}`}
            onClick={() => setActiveCategory('1x3')}
          >
            1×3 Strips ({count1x3})
          </button>
          <button
            className={`filter-tab ${activeCategory === '1x4' ? 'active' : ''}`}
            onClick={() => setActiveCategory('1x4')}
          >
            1×4 Strips ({count1x4})
          </button>
          <button
            className={`filter-tab ${activeCategory === '2x3' ? 'active' : ''}`}
            onClick={() => setActiveCategory('2x3')}
          >
            2×3 Dual ({count2x3})
          </button>
          <button
            className={`filter-tab ${activeCategory === '2x2' ? 'active' : ''}`}
            onClick={() => setActiveCategory('2x2')}
          >
            2×2 Grid ({count2x2})
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <button
            className="btn btn-primary"
            onClick={() => setIsUploadOpen(true)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '7px 14px', fontSize: '12px', background: 'linear-gradient(135deg, #ff5e97, #8b5cf6)', border: 'none' }}
          >
            <UploadIcon size={15} /> Unggah Frame
          </button>

          <input
            className="input"
            placeholder="Cari frame…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ width: '100%', maxWidth: '180px', padding: '7px 12px', fontSize: '12px' }}
          />
        </div>
      </div>

      {/* Frame Gallery Grid */}
      <div className="frame-gallery-grid">
        {/* Upload Own Frame Card */}
        {(activeCategory === 'all' || activeCategory === 'custom') && !searchQuery && (
          <div
            onClick={() => setIsUploadOpen(true)}
            style={{
              padding: '20px 14px',
              border: '2px dashed rgba(255, 94, 151, 0.4)',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(255, 94, 151, 0.04)',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              minHeight: '210px',
              transition: 'all 200ms ease',
            }}
          >
            <div style={{ width: '42px', height: '42px', borderRadius: '50%', background: 'rgba(255,94,151,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-pink)', marginBottom: '10px' }}>
              <UploadIcon size={22} />
            </div>
            <p style={{ fontWeight: 700, fontSize: '13px', color: 'white', marginBottom: '4px' }}>Unggah Frame Sendiri</p>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: '1.4' }}>Deteksi otomatis lubang foto & jadikan aset bersama</p>
          </div>
        )}

        {filteredTemplates.map((template) => {
          const isMyVote = myVote?.frameTemplateId === template.id;
          const isPartnerVote = partnerVote?.frameTemplateId === template.id;
          const isUnanimous = unanimousTemplateId === template.id;
          const isCustom = template.isCustom || template.id.startsWith('custom_');

          return (
            <button
              key={template.id}
              id={`frame-${template.id}-btn`}
              onClick={() => handleVote(template.id)}
              style={{
                padding: 0,
                border: isMyVote ? `2px solid ${template.accent_color || template.accentColor || '#ff5e97'}` : '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                overflow: 'hidden',
                cursor: 'pointer',
                background: 'var(--bg-card)',
                position: 'relative',
                transform: isMyVote ? 'scale(1.02)' : 'scale(1)',
                transition: 'all 200ms ease',
                boxShadow: isMyVote ? `0 0 16px ${template.accent_color || template.accentColor || '#ff5e97'}33` : 'none',
                textAlign: 'left',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              {/* Thumbnail Container */}
              <div style={{ height: '145px', background: '#0a0c12', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                <FrameThumbnail template={template} shots={slots} accentColor={template.accent_color || template.accentColor || '#ff5e97'} />

                {isCustom && (
                  <div style={{ position: 'absolute', top: '6px', left: '6px', background: 'rgba(255,94,151,0.85)', borderRadius: 'var(--radius-full)', padding: '2px 8px', fontSize: '10px', fontWeight: 700, color: 'white', zIndex: 5 }}>
                    Kustom
                  </div>
                )}

                {isMyVote && (
                  <div style={{ position: 'absolute', top: '6px', right: '6px', background: 'rgba(0,0,0,0.85)', borderRadius: 'var(--radius-full)', padding: '2px 8px', fontSize: '10.5px', fontWeight: 700, color: template.accent_color || template.accentColor || '#ff5e97', display: 'flex', alignItems: 'center', gap: '4px', zIndex: 5 }}>
                    <CheckIcon size={11} /> Pilihanmu
                  </div>
                )}
                {isPartnerVote && !isMyVote && (
                  <div style={{ position: 'absolute', top: '6px', left: isCustom ? '60px' : '6px', background: 'rgba(0,0,0,0.85)', borderRadius: 'var(--radius-full)', padding: '2px 8px', fontSize: '10.5px', color: 'var(--accent-violet)', zIndex: 5 }}>
                    {partner?.displayName} Memilih
                  </div>
                )}
                {isUnanimous && (
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.65)', zIndex: 6 }}>
                    <span className="badge badge-green"><CheckIcon size={14} /> Terpilih</span>
                  </div>
                )}
              </div>

              {/* Info */}
              <div style={{ padding: '8px 10px', background: 'var(--bg-card)' }}>
                <div style={{ fontWeight: 700, fontSize: '13px', marginBottom: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {template.name}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="badge badge-neutral" style={{ fontSize: '10px', padding: '1px 6px' }}>
                    {template.category || template.layout_type}
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Customization Details Panel */}
      {selectedTemplateId && (
        <div className="glass-card" style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }} id="customization-panel">
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, fontSize: '14px' }}>
            <PaletteIcon size={16} color="var(--accent-pink)" /> Kustomisasi Tambahan
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
            <div>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: 600 }}>Warna Aksen Border</p>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {ACCENT_COLORS.map((c) => (
                  <button
                    key={c.value}
                    onClick={() => handleCustomizationChange(c.value)}
                    title={c.label}
                    style={{
                      width: '26px', height: '26px', borderRadius: '50%',
                      background: c.value,
                      border: accentColor === c.value ? '2px solid white' : '2px solid transparent',
                      boxShadow: accentColor === c.value ? `0 0 0 2px ${c.value}` : 'none',
                      cursor: 'pointer',
                      transition: 'all 150ms ease',
                    }}
                  />
                ))}
              </div>
            </div>

            <div>
              <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '6px', fontWeight: 600 }}>Teks Catatan Footer (Opsional)</label>
              <input
                className="input"
                id="caption-input"
                placeholder="Contoh: Best Memories · 2026"
                value={captionText}
                onChange={(e) => handleCustomizationChange(undefined, e.target.value)}
                maxLength={50}
                style={{ padding: '8px 12px', fontSize: '13px' }}
              />
            </div>
          </div>
        </div>
      )}

      {!myVote && (
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
          Klik salah satu frame di atas untuk memberikan pilihanmu
        </div>
      )}
    </div>
  );
}

function FrameThumbnail({ template, shots, accentColor }: { template: ExtendedFrameTemplate; shots: PairedShot[]; accentColor: string }) {
  if (template.overlay_url) {
    const fW = template.frameWidth || (template.category === '1x4' ? 600 : template.category === '2x3' ? 1120 : 1180);
    const fH = template.frameHeight || (template.category === '1x4' ? 1800 : template.category === '2x3' ? 1368 : 1750);
    const boxes = template.cutoutBoxes && template.cutoutBoxes.length > 0 ? template.cutoutBoxes : [];

    return (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '6px' }}>
        <div style={{
          height: '132px',
          aspectRatio: `${fW} / ${fH}`,
          position: 'relative',
          borderRadius: '4px',
          overflow: 'hidden',
          boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
          background: '#090a10',
        }}>
          {/* Exact Photo Cutouts */}
          {boxes.map((box, i) => {
            const shot = shots[i % Math.max(1, shots.length)];
            const photoUrl = shot ? (i % 2 === 0 ? shot.leftPhotoUrl : shot.rightPhotoUrl) : undefined;
            return (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  left: `${(box.x / fW) * 100}%`,
                  top: `${(box.y / fH) * 100}%`,
                  width: `${(box.width / fW) * 100}%`,
                  height: `${(box.height / fH) * 100}%`,
                  background: photoUrl ? `url(${photoUrl}) center/cover no-repeat` : '#181a24',
                  borderRadius: '1px',
                }}
              />
            );
          })}

          {/* PNG Frame Overlay */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={template.overlay_url}
            alt={template.name}
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'fill',
              zIndex: 2,
              pointerEvents: 'none',
            }}
          />
        </div>
      </div>
    );
  }

  // Built-in vector thumbnail fallback
  return (
    <div style={{ display: 'flex', gap: '4px', padding: '6px', width: '80px', height: '100px', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ flex: 1, height: '100%', background: 'rgba(0,0,0,0.6)', border: `1px solid ${accentColor}`, borderRadius: '4px', padding: '2px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} style={{ flex: 1, background: shots[i]?.leftPhotoUrl ? `url(${shots[i]?.leftPhotoUrl}) center/cover` : 'rgba(255,255,255,0.1)', borderRadius: '1px' }} />
        ))}
      </div>
      <div style={{ flex: 1, height: '100%', background: 'rgba(0,0,0,0.6)', border: `1px solid ${accentColor}`, borderRadius: '4px', padding: '2px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} style={{ flex: 1, background: shots[i]?.rightPhotoUrl ? `url(${shots[i]?.rightPhotoUrl}) center/cover` : 'rgba(255,255,255,0.1)', borderRadius: '1px' }} />
        ))}
      </div>
    </div>
  );
}

