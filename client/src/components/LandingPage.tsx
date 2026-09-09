'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CameraIcon, PlusIcon, ArrowRightIcon, SparklesIcon, UsersIcon, DownloadIcon, LayoutIcon, PaletteIcon, UserIcon } from './Icons';
import { getServerUrl } from '@/lib/config';

export default function LandingPage() {
  const router = useRouter();
  const [selectedMode, setSelectedMode] = useState<'solo' | 'duo'>('solo');
  const [joinCode, setJoinCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleCreateRoom(mode: 'solo' | 'duo' = selectedMode) {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${getServerUrl()}/api/rooms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode,
          shotCount: mode === 'solo' ? 4 : 3,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal membuat room');
      localStorage.setItem(`host_${data.room.code}`, '1');
      router.push(`/room/${data.room.code}`);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  function handleJoin() {
    const code = joinCode.trim().toUpperCase();
    if (code.length < 4) {
      setError('Masukkan kode room 6 karakter yang valid');
      return;
    }
    router.push(`/room/${code}`);
  }

  return (
    <main style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 16px', position: 'relative' }}>
      <div style={{ width: '100%', maxWidth: '540px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '22px', position: 'relative', zIndex: 1 }}>
        
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
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginTop: '8px', maxWidth: '420px', lineHeight: 1.5 }}>
            Online Photobooth studio interaktif dengan beragam frame estetik. Ambil foto sendiri atau bersama teman dari mana saja!
          </p>
        </div>

        {/* Feature Badges */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
          <span className="badge badge-neutral"><UserIcon size={12} /> Solo & Duo Mode</span>
          <span className="badge badge-neutral"><PaletteIcon size={12} /> Various Frame</span>
          <span className="badge badge-neutral"><DownloadIcon size={12} /> Export HD</span>
        </div>

        {/* Mode Selector & Main Action Card */}
        <div className="glass-card" style={{ width: '100%', padding: '24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
          
          {/* Mode Switcher Tabs */}
          <div>
            <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '8px', letterSpacing: '0.04em' }}>
              PILIH MODE PHOTOBOOTH:
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              {/* Solo Mode Button */}
              <button
                type="button"
                onClick={() => setSelectedMode('solo')}
                style={{
                  padding: '14px 12px',
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
                  <div style={{ fontSize: '13.5px', fontWeight: 800, color: selectedMode === 'solo' ? 'white' : 'var(--text-primary)' }}>
                    Foto Sendiri (Solo)
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                    Langsung foto 1 orang tanpa tunggu partner
                  </div>
                </div>
              </button>

              {/* Duo Mode Button */}
              <button
                type="button"
                onClick={() => setSelectedMode('duo')}
                style={{
                  padding: '14px 12px',
                  borderRadius: '12px',
                  border: selectedMode === 'duo' ? '2px solid var(--accent-violet, #8b5cf6)' : '1px solid var(--border-subtle)',
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
                  <div style={{ fontSize: '13.5px', fontWeight: 800, color: selectedMode === 'duo' ? 'white' : 'var(--text-primary)' }}>
                    Foto Berdua (Duo)
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                    Online sync berpasangan via link room
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* Launch Room Button */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <button
              className="btn btn-primary btn-lg"
              onClick={() => handleCreateRoom(selectedMode)}
              disabled={loading}
              id="create-room-btn"
              style={{ width: '100%', fontSize: '15px' }}
            >
              {loading ? (
                <>
                  <span className="spinner" /> Menyiapkan Sesi…
                </>
              ) : (
                <>
                  <CameraIcon size={18} /> {selectedMode === 'solo' ? 'Mulai Photobooth Sendiri' : 'Buat Room Berdua (Host)'}
                </>
              )}
            </button>
            <p style={{ textAlign: 'center', fontSize: '11.5px', color: 'var(--text-muted)' }}>
              {selectedMode === 'solo' ? 'Sesi photobooth solo instan tanpa pendaftaran' : 'Membuat room privat dengan link undangan dan QR code'}
            </p>
          </div>

          {/* Join with code separator (Only for Duo mode or joining existing rooms) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ flex: 1, height: '1px', background: 'var(--border-subtle)' }} />
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.06em' }}>ATAU GABUNG DENGAN KODE ROOM</span>
            <div style={{ flex: 1, height: '1px', background: 'var(--border-subtle)' }} />
          </div>

          {/* Join Room Input */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                className="input"
                id="join-code-input"
                placeholder="KODE ROOM (6 DIGIT)"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
                maxLength={6}
                style={{ letterSpacing: '0.15em', fontWeight: 800, fontSize: '15px', textAlign: 'center', textTransform: 'uppercase' }}
              />
              <button
                className="btn btn-secondary"
                onClick={handleJoin}
                id="join-room-btn"
                style={{ padding: '0 20px', flexShrink: 0 }}
              >
                Gabung <ArrowRightIcon size={16} />
              </button>
            </div>
          </div>

          {error && (
            <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 'var(--radius-sm)', color: '#f87171', fontSize: '12.5px', textAlign: 'center' }}>
              {error}
            </div>
          )}
        </div>

        {/* 4 Steps How It Works */}
        <div className="glass-card-compact" style={{ width: '100%', padding: '16px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', textAlign: 'center' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
            <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'rgba(255,94,151,0.15)', color: 'var(--accent-pink)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 800 }}>1</div>
            <span style={{ fontSize: '11px', fontWeight: 700 }}>Shoot</span>
            <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Ambil foto</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
            <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'rgba(139,92,246,0.15)', color: 'var(--accent-violet)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 800 }}>2</div>
            <span style={{ fontSize: '11px', fontWeight: 700 }}>Frame</span>
            <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Pilih template</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
            <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'rgba(6,182,212,0.15)', color: 'var(--accent-cyan)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 800 }}>3</div>
            <span style={{ fontSize: '11px', fontWeight: 700 }}>Place</span>
            <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Atur posisi</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
            <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'rgba(16,185,129,0.15)', color: 'var(--accent-emerald)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 800 }}>4</div>
            <span style={{ fontSize: '11px', fontWeight: 700 }}>Finish</span>
            <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Simpan PNG</span>
          </div>
        </div>

        {/* Footer */}
        <p style={{ color: 'var(--text-muted)', fontSize: '12px', textAlign: 'center' }}>
          Tanpa registrasi · Peer-to-Peer Encrypted · Gratis
        </p>
      </div>
    </main>
  );
}
