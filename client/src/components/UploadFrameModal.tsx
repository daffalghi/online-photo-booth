'use client';

import { useState, useRef, ChangeEvent } from 'react';
import { ExtendedFrameTemplate, CutoutBox } from '@/lib/frameTemplates';
import { UploadIcon, CheckIcon, CloseIcon } from './Icons';

interface UploadFrameModalProps {
  isOpen: boolean;
  onClose: () => void;
  onFrameCreated: (frame: ExtendedFrameTemplate) => void;
}

interface DetectionInfo {
  detectedHolesCount: number;
  hasAlphaCutouts: boolean;
  layoutType: string;
  category: string;
}

export default function UploadFrameModal({ isOpen, onClose, onFrameCreated }: UploadFrameModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [frameName, setFrameName] = useState('');
  const [accentColor, setAccentColor] = useState('#ff5e97');
  const [isUploading, setIsUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [detectedBoxes, setDetectedBoxes] = useState<CutoutBox[]>([]);
  const [detectionInfo, setDetectionInfo] = useState<DetectionInfo | null>(null);
  const [detectedFrame, setDetectedFrame] = useState<ExtendedFrameTemplate | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  function resetState() {
    setFile(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl('');
    setFrameName('');
    setIsUploading(false);
    setErrorMsg('');
    setDetectedBoxes([]);
    setDetectionInfo(null);
    setDetectedFrame(null);
  }

  function handleClose() {
    resetState();
    onClose();
  }

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0];
    if (!selected) return;

    const isPngOrWebp = selected.type.includes('png') || selected.type.includes('webp') || selected.name.toLowerCase().endsWith('.png') || selected.name.toLowerCase().endsWith('.webp');
    if (!isPngOrWebp) {
      setErrorMsg('Harap unggah file PNG atau WebP dengan transparansi untuk deteksi lubang foto optimal.');
    } else {
      setErrorMsg('');
    }

    setFile(selected);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(selected));
    setDetectedBoxes([]);
    setDetectionInfo(null);
    setDetectedFrame(null);
    if (!frameName) {
      const cleanName = selected.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
      setFrameName(cleanName.slice(0, 30));
    }
  }

  async function handleAnalyzeAndUpload() {
    if (!file) {
      setErrorMsg('Pilih file gambar frame terlebih dahulu.');
      return;
    }

    setIsUploading(true);
    setErrorMsg('');

    try {
      const formData = new FormData();
      formData.append('frame', file);
      formData.append('name', frameName.trim() || 'Frame Kustom');
      formData.append('accentColor', accentColor);

      const res = await fetch('/api/frames/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Gagal menganalisis dan mengunggah frame.');
      }

      const created: ExtendedFrameTemplate = data.frame;
      setDetectedFrame(created);
      setDetectedBoxes(created.cutoutBoxes || []);
      setDetectionInfo(data.detection || null);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Terjadi kesalahan saat mengunggah frame.');
    } finally {
      setIsUploading(false);
    }
  }

  function handleApplyFrame() {
    if (detectedFrame) {
      onFrameCreated(detectedFrame);
      handleClose();
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(5, 6, 10, 0.85)',
        backdropFilter: 'blur(12px)',
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '560px',
          maxHeight: '90vh',
          overflowY: 'auto',
          background: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-xl)',
          padding: '24px',
          boxShadow: '0 24px 48px rgba(0,0,0,0.7)',
          display: 'flex',
          flexDirection: 'column',
          gap: '18px',
          position: 'relative',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(255,94,151,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-pink)' }}>
              <UploadIcon size={20} />
            </div>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: 800 }}>Unggah Frame Sendiri</h2>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Otomatis mendeteksi lubang foto & menjadi aset bersama</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '6px' }}
          >
            <CloseIcon size={20} />
          </button>
        </div>

        {/* Upload Drop Zone / Picker */}
        {!file && (
          <div
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: '2px dashed rgba(255, 94, 151, 0.35)',
              borderRadius: 'var(--radius-lg)',
              padding: '36px 20px',
              textAlign: 'center',
              cursor: 'pointer',
              background: 'rgba(255, 94, 151, 0.03)',
              transition: 'all 0.2s ease',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '12px',
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/webp,image/*"
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />
            <div style={{ width: '52px', height: '52px', borderRadius: '50%', background: 'rgba(255,94,151,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-pink)' }}>
              <UploadIcon size={26} />
            </div>
            <div>
              <p style={{ fontWeight: 700, fontSize: '14px', color: 'white' }}>Pilih atau Seret File Frame (PNG / WebP)</p>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                Disarankan file PNG atau WebP transparan pada area foto (Canva / Photoshop)
              </p>
            </div>
          </div>
        )}

        {/* Error message */}
        {errorMsg && (
          <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 'var(--radius-md)', color: '#fca5a5', fontSize: '12.5px' }}>
            {errorMsg}
          </div>
        )}

        {/* Preview with Cutout Highlights */}
        {file && previewUrl && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ position: 'relative', width: '100%', maxHeight: '280px', background: '#07080e', borderRadius: 'var(--radius-md)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border-subtle)', padding: '12px' }}>
              <div style={{ position: 'relative', display: 'inline-block', maxHeight: '256px' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={previewUrl}
                  alt="Preview Frame"
                  style={{ maxHeight: '256px', width: 'auto', display: 'block', borderRadius: '6px' }}
                />

                {/* Detected Cutout Overlays */}
                {detectedFrame && detectedBoxes.length > 0 && (
                  <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
                    {detectedBoxes.map((box, idx) => {
                      const fW = detectedFrame.frameWidth || 1200;
                      const fH = detectedFrame.frameHeight || 1800;
                      const leftPct = (box.x / fW) * 100;
                      const topPct = (box.y / fH) * 100;
                      const widthPct = (box.width / fW) * 100;
                      const heightPct = (box.height / fH) * 100;

                      return (
                        <div
                          key={idx}
                          style={{
                            position: 'absolute',
                            left: `${leftPct}%`,
                            top: `${topPct}%`,
                            width: `${widthPct}%`,
                            height: `${heightPct}%`,
                            border: '1.5px solid #38bdf8',
                            background: 'rgba(56, 189, 248, 0.25)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'white',
                            fontSize: '11px',
                            fontWeight: 800,
                            borderRadius: '4px',
                            boxShadow: '0 0 10px rgba(56, 189, 248, 0.4)',
                          }}
                        >
                          Slot {idx + 1}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Detection Summary Badge */}
            {detectedFrame && detectionInfo && (
              <div style={{ padding: '10px 14px', background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <CheckIcon size={16} color="var(--accent-green)" />
                  <span style={{ fontSize: '12.5px', color: '#6ee7b7', fontWeight: 600 }}>
                    Terdeteksi {detectedBoxes.length} lubang foto ({detectionInfo.category.toUpperCase()})
                  </span>
                </div>
                <span className="badge badge-pink" style={{ fontSize: '10.5px' }}>
                  Aset Bersama
                </span>
              </div>
            )}

            {/* Frame Metadata Inputs */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                  Nama Frame
                </label>
                <input
                  type="text"
                  value={frameName}
                  onChange={(e) => setFrameName(e.target.value.slice(0, 40))}
                  placeholder="Contoh: Sweet Valentine 4-Cut"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--bg-input)',
                    border: '1px solid var(--border-subtle)',
                    color: 'white',
                    fontSize: '13px',
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                  Warna Tema Frame
                </label>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  {['#ff5e97', '#8b5cf6', '#38bdf8', '#10b981', '#f59e0b', '#ffffff'].map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setAccentColor(c)}
                      style={{
                        width: '26px',
                        height: '26px',
                        borderRadius: '50%',
                        background: c,
                        border: accentColor === c ? '2.5px solid white' : '1px solid rgba(255,255,255,0.2)',
                        cursor: 'pointer',
                        transform: accentColor === c ? 'scale(1.15)' : 'scale(1)',
                        transition: 'transform 0.15s ease',
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setFile(null);
                  if (previewUrl) URL.revokeObjectURL(previewUrl);
                  setPreviewUrl('');
                  setDetectedFrame(null);
                  setDetectedBoxes([]);
                }}
                style={{ flex: 1 }}
              >
                Ganti File
              </button>

              {!detectedFrame ? (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleAnalyzeAndUpload}
                  disabled={isUploading}
                  style={{ flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                >
                  {isUploading ? (
                    <>
                      <span className="spinner" style={{ width: '16px', height: '16px' }} />
                      Mendeteksi Lubang Foto…
                    </>
                  ) : (
                    <>
                      <UploadIcon size={16} />
                      Deteksi & Simpan Frame
                    </>
                  )}
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleApplyFrame}
                  style={{ flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', background: 'linear-gradient(135deg, #10b981, #059669)' }}
                >
                  <CheckIcon size={16} />
                  Gunakan Frame Ini Sekarang
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
