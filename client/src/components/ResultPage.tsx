'use client';

import { useRef, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import QRCode from 'qrcode';
import { Socket } from 'socket.io-client';
import { PairedShot, Participant, Room } from '@/types';
import { FRAME_TEMPLATES } from '@/lib/frameTemplates';
import { compositePreview } from '@/lib/composite';
import { DownloadIcon, CopyIcon, CheckIcon, PlusIcon, HomeIcon, PaletteIcon, TrashIcon, ShieldCheckIcon } from './Icons';
import { getServerUrl } from '@/lib/config';
import CreatorCard from './CreatorCard';

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
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const qrCanvasRef = useRef<HTMLCanvasElement>(null);
  const [compositing, setCompositing] = useState(true);
  const [copied, setCopied] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [isDeletedSuccess, setIsDeletedSuccess] = useState(false);
  const [deleteError, setDeleteError] = useState('');

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
      .catch((err) => {
        console.error('Local compositing error:', err);
        setCompositing(false);
      });
  }, [slots, template, captionText, accentColor, downloadUrlPng, room.settings.selectedPhotoOrder, isSolo]);

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

  async function handleDestroySession() {
    setIsDeleting(true);
    setDeleteError('');
    try {
      if (socket) {
        socket.emit('room:destroy', { roomId: room.id });
      }
      await fetch(`${getServerUrl()}/api/rooms/${room.code}/destroy`, {
        method: 'POST',
      });
      setIsDeleting(false);
      setShowConfirmDelete(false);
      setIsDeletedSuccess(true);
      setTimeout(() => {
        router.push('/');
      }, 2200);
    } catch (err) {
      console.error(err);
      setIsDeleting(false);
      setShowConfirmDelete(false);
      setDeleteError('Gagal memusnahkan data sesi. Namun file akan otomatis terhapus dalam 2 jam.');
    }
  }

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '16px 20px', gap: '20px', maxWidth: '1080px', margin: '0 auto', width: '100%' }}>
      {/* Header Banner */}
      <div style={{ textAlign: 'center', width: '100%' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--accent-pink)', marginBottom: '4px' }}>
          <CheckIcon size={16} />
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
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '20px',
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

          {/* Privacy & Instant Hard Deletion Card */}
          <div className="glass-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px', border: '1px solid rgba(16, 185, 129, 0.3)', background: 'rgba(16, 185, 129, 0.04)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-emerald)' }}>
              <ShieldCheckIcon size={20} />
              <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0 }}>Jaminan Keamanan & Privasi Data</h3>
            </div>
            <ul style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.6, paddingLeft: '16px', margin: 0 }}>
              <li><strong>Penghapusan Otomatis (30 Menit):</strong> Foto dan data sesi otomatis dimusnahkan secara permanen dari server dalam 30 menit setelah sesi selesai demi menjaga privasi.</li>
              <li><strong>Tanpa Data Pribadi:</strong> Sistem tidak meminta email, nama lengkap, nomor telepon, atau akun pribadi apa pun.</li>
              <li><strong>Enkripsi P2P Langsung:</strong> Panggilan video dan audio mengalir langsung antar perangkat (WebRTC) tanpa direkam server.</li>
            </ul>

            {/* Instant Hard Deletion Button */}
            <div style={{ marginTop: '4px', paddingTop: '10px', borderTop: '1px solid var(--border-subtle)' }}>
              {!showConfirmDelete ? (
                <button
                  type="button"
                  className="btn btn-danger btn-md"
                  onClick={() => setShowConfirmDelete(true)}
                  id="instant-wipe-btn"
                  style={{ width: '100%', fontSize: '13px', fontWeight: 700 }}
                >
                  <TrashIcon size={16} /> Hapus Seluruh Data Sesi Sekarang
                </button>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', background: 'rgba(239, 68, 68, 0.1)', padding: '12px', borderRadius: 'var(--radius-md)', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                  <p style={{ fontSize: '12px', color: '#fca5a5', margin: 0, fontWeight: 600 }}>
                    Apakah Anda yakin ingin memusnahkan semua foto dan riwayat sesi ini dari server sekarang?
                  </p>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      onClick={handleDestroySession}
                      disabled={isDeleting}
                      id="confirm-wipe-btn"
                      style={{ flex: 1 }}
                    >
                      {isDeleting ? 'Menghapus…' : 'Ya, Hapus Permanen Sekarang'}
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => setShowConfirmDelete(false)}
                      disabled={isDeleting}
                    >
                      Batal
                    </button>
                  </div>
                </div>
              )}
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

      {/* Creator & Support Card */}
      <div style={{ width: '100%', maxWidth: '680px', marginTop: '12px' }}>
        <CreatorCard />
      </div>

      {/* In-App Deletion Error Banner */}
      {deleteError && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(239, 68, 68, 0.95)',
          color: 'white',
          padding: '12px 20px',
          borderRadius: 'var(--radius-md)',
          boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
          zIndex: 9999,
          fontSize: '13px',
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
        }}>
          <span>{deleteError}</span>
          <button
            onClick={() => setDeleteError('')}
            style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', fontWeight: 800 }}
          >
            ✕
          </button>
        </div>
      )}

      {/* In-App Deletion Success Modal (No ugly localhost alert!) */}
      {isDeletedSuccess && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(5, 7, 15, 0.88)',
          backdropFilter: 'blur(10px)',
          zIndex: 99999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
          animation: 'fadeIn 200ms ease',
        }}>
          <div style={{
            background: '#0d111c',
            border: '1px solid rgba(16, 185, 129, 0.4)',
            boxShadow: '0 24px 60px rgba(0, 0, 0, 0.85), 0 0 35px rgba(16, 185, 129, 0.25)',
            borderRadius: 'var(--radius-lg)',
            padding: '32px 26px',
            maxWidth: '440px',
            width: '100%',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}>
            <div style={{
              width: '60px',
              height: '60px',
              borderRadius: '50%',
              background: 'rgba(16, 185, 129, 0.15)',
              border: '2px solid var(--accent-green)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--accent-green)',
              marginBottom: '16px',
            }}>
              <CheckIcon size={30} />
            </div>
            <h3 style={{ fontSize: '20px', fontWeight: 800, color: 'white', marginBottom: '8px' }}>
              Data Sesi Telah Dihapus!
            </h3>
            <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', lineHeight: '1.6', marginBottom: '22px' }}>
              Seluruh foto, file capture, dan histori ruangan photobooth Anda telah dimusnahkan secara permanen dari server.
            </p>
            <button
              className="btn btn-primary"
              onClick={() => router.push('/')}
              style={{
                width: '100%',
                padding: '10px 18px',
                fontWeight: 700,
                background: 'linear-gradient(135deg, #10b981, #059669)',
                border: 'none',
              }}
            >
              Kembali ke Beranda Sekarang
            </button>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '12px' }}>
              Mengalihkan otomatis ke beranda…
            </p>
          </div>
        </div>
      )}
    </div>
  );
}


