'use client';

import { useRef, useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { Socket } from 'socket.io-client';
import { PairedShot, Participant, Room } from '@/types';
import { FRAME_TEMPLATES } from '@/lib/frameTemplates';
import { compositePreview } from '@/lib/composite';
import { DownloadIcon, CopyIcon, CheckIcon, SparklesIcon, PlusIcon, HomeIcon, PaletteIcon, ArrowLeftIcon } from './Icons';
import { getServerUrl } from '@/lib/config';

interface ResultPageProps {
  room: Room;
  participants: Participant[];
  slots: PairedShot[];
  downloadUrlPng?: string;
  frameTemplateId?: string;
  customization?: { accentColor?: string; captionText?: string };
  socket?: Socket;
}

export default function ResultPage({
  room,
  participants,
  slots,
  downloadUrlPng,
  frameTemplateId,
  customization,
  socket,
}: ResultPageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const qrCanvasRef = useRef<HTMLCanvasElement>(null);
  const [compositing, setCompositing] = useState(true);
  const [copied, setCopied] = useState(false);

  const template = FRAME_TEMPLATES.find((t) => t.id === frameTemplateId) ?? FRAME_TEMPLATES[0];
  const accentColor = customization?.accentColor || template.accent_color;
  const captionText = customization?.captionText || '';

  const isSolo = room.capacity === 1 || room.settings?.mode === 'solo';

  // Local canvas preview fallback
  useEffect(() => {
    if (!canvasRef.current || downloadUrlPng) {
      setCompositing(false);
      return;
    }
    setCompositing(true);
    compositePreview(
      canvasRef.current,
      slots,
      template,
      captionText,
      accentColor,
      room.settings.selectedPhotoOrder,
      room.settings.photoOffsets,
      isSolo,
    )
      .then(() => setCompositing(false))
      .catch((e) => {
        console.error(e);
        setCompositing(false);
      });
  }, [slots, template, captionText, accentColor, room.settings.selectedPhotoOrder, room.settings.photoOffsets, downloadUrlPng, isSolo]);

  // QR code generation
  useEffect(() => {
    if (!qrCanvasRef.current) return;
    const url = downloadUrlPng || (typeof window !== 'undefined' ? window.location.href : '');

    const renderQr = (targetUrl: string) => {
      if (!qrCanvasRef.current) return;
      QRCode.toCanvas(qrCanvasRef.current, targetUrl, {
        width: 130,
        margin: 1,
        color: { dark: '#f8fafc', light: '#12141d' },
      }).catch(console.error);
    };

    if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
      fetch(`${getServerUrl()}/api/rooms/info/local-ip`)
        .then((res) => res.json())
        .then((data) => {
          if (data.ip && data.ip !== 'localhost') {
            const lanUrl = url.replace(/localhost/g, data.ip).replace(/127\.0\.0\.1/g, data.ip);
            renderQr(lanUrl);
          } else {
            renderQr(url);
          }
        })
        .catch(() => renderQr(url));
    } else {
      renderQr(url);
    }
  }, [downloadUrlPng]);

  function handleDownload() {
    if (downloadUrlPng) {
      const a = document.createElement('a');
      a.href = downloadUrlPng;
      a.download = `snapsync-${room.code}.png`;
      a.click();
    } else if (canvasRef.current) {
      const a = document.createElement('a');
      a.href = canvasRef.current.toDataURL('image/png');
      a.download = `snapsync-${room.code}.png`;
      a.click();
    }
  }

  function copyLink() {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '16px 20px', gap: '20px', maxWidth: '1080px', margin: '0 auto', width: '100%' }}>
      {/* Header Banner */}
      <div style={{ textAlign: 'center', width: '100%' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--accent-pink)', marginBottom: '4px' }}>
          <SparklesIcon size={16} />
          <span style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '0.05em' }}>HASIL PHOTO STRIP SELESAI</span>
        </div>
        <h1 style={{ fontSize: '28px', fontWeight: 800 }}>Photobooth Strip Kamu Sudah Siap!</h1>
        <p style={{ color: 'var(--text-secondary)', marginTop: '4px', fontSize: '13.5px' }}>
          Dirender dalam resolusi tinggi dengan template <strong style={{ color: 'var(--text-primary)' }}>{template.name}</strong>
        </p>

        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginTop: '10px' }}>
          {participants.map((p) => (
            <span key={p.id} className="badge badge-green" style={{ fontSize: '11px' }}>
              <CheckIcon size={11} /> {p.displayName}
            </span>
          ))}
        </div>
      </div>

      {/* Main 2-Column Content */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
          gap: '24px',
          width: '100%',
          alignItems: 'start',
        }}
      >
        {/* Left: Photobooth Preview Image Card */}
        <div
          className="glass-card"
          style={{
            padding: '18px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            background: 'rgba(12, 14, 22, 0.75)',
          }}
        >
          {compositing && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 10,
                background: 'rgba(9,10,15,0.85)',
                borderRadius: 'var(--radius-lg)',
                gap: '10px',
              }}
            >
              <div className="spinner" style={{ width: '28px', height: '28px' }} />
              <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Merender Photobooth HD…</span>
            </div>
          )}

          {downloadUrlPng ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={downloadUrlPng}
              alt="Final Photobooth Strip"
              style={{
                width: '100%',
                maxHeight: '600px',
                objectFit: 'contain',
                borderRadius: 'var(--radius-md)',
                boxShadow: '0 10px 36px rgba(0,0,0,0.65)',
              }}
            />
          ) : (
            <canvas
              ref={canvasRef}
              style={{
                width: '100%',
                maxHeight: '600px',
                objectFit: 'contain',
                display: 'block',
                borderRadius: 'var(--radius-md)',
              }}
            />
          )}
        </div>

        {/* Right: Actions, Mobile QR & Sharing */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          {/* Action Card */}
          <div className="glass-card" style={{ padding: '22px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 800 }}>Simpan & Bagikan Hasil Foto</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '12.5px' }}>
              Unduh gambar photo strip PNG resolusi tinggi ke perangkatmu atau bagikan ke media sosial.
            </p>

            <button
              className="btn btn-primary btn-lg"
              style={{ width: '100%', marginTop: '4px', fontSize: '15px' }}
              onClick={handleDownload}
              disabled={compositing}
              id="download-btn"
            >
              <DownloadIcon size={18} /> Unduh Foto HD (PNG)
            </button>

            <button
              className="btn btn-secondary btn-md"
              style={{ width: '100%' }}
              onClick={copyLink}
              id="copy-share-link-btn"
            >
              {copied ? <CheckIcon size={15} color="var(--accent-emerald)" /> : <CopyIcon size={15} />}
              <span>{copied ? 'Link Berhasil Disalin!' : 'Salin Link Halaman Ini'}</span>
            </button>
          </div>

          {/* QR Code Card for Mobile */}
          <div className="glass-card" style={{ padding: '18px 20px', display: 'flex', gap: '16px', alignItems: 'center' }}>
            <div style={{ padding: '8px', background: '#12141d', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', flexShrink: 0 }}>
              <canvas ref={qrCanvasRef} style={{ display: 'block' }} />
            </div>
            <div>
              <p style={{ fontWeight: 700, fontSize: '14px', marginBottom: '4px' }}>Simpan Langsung ke HP</p>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                Arahkan kamera smartphone ke QR code di samping untuk membuka dan menyimpan gambar strip foto secara langsung.
              </p>
            </div>
          </div>

          {/* Navigation Options */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
            {socket && (
              <button
                className="btn btn-secondary btn-md"
                onClick={() => socket.emit('frame:changeTemplate', { roomId: room.id })}
                id="reselect-frame-btn"
                style={{ width: '100%', fontWeight: 700 }}
              >
                <PaletteIcon size={15} /> Pilih Ulang Frame / Ganti Template
              </button>
            )}
            <div style={{ display: 'flex', gap: '10px' }}>
              <a href="/" className="btn btn-secondary btn-md" style={{ flex: 1 }} id="new-session-btn">
                <PlusIcon size={15} /> Buat Sesi Baru
              </a>
              <a href="/" className="btn btn-ghost btn-md" id="home-btn">
                <HomeIcon size={15} /> Beranda
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


