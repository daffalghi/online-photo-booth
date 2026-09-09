'use client';

import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { Participant, Room } from '@/types';
import { CameraIcon, CopyIcon, CheckIcon, CrownIcon, UserIcon, ArrowRightIcon, ClockIcon, LayoutIcon, UsersIcon, SparklesIcon, PaletteIcon } from './Icons';
import { getServerUrl } from '@/lib/config';
import { getSocket } from '@/lib/socket';

interface LobbyProps {
  room: Room;
  participants: Participant[];
  myParticipantId: string;
  onStart: () => void;
}

export default function Lobby({ room, participants, myParticipantId, onStart }: LobbyProps) {
  const qrCanvasRef = useRef<HTMLCanvasElement>(null);
  const [copyDone, setCopyDone] = useState(false);
  const [starting, setStarting] = useState(false);
  const [joinUrl, setJoinUrl] = useState('');

  const isSolo = room.capacity === 1 || room.settings?.mode === 'solo';
  const me = participants.find((p) => p.id === myParticipantId);
  const isHost = me?.isHost ?? false;
  const canStart = isSolo ? (participants.length >= 1 && isHost) : (participants.length >= 2 && isHost);

  useEffect(() => {
    const base = typeof window !== 'undefined' ? `${window.location.origin}/room/${room.code}` : '';
    setJoinUrl(base);

    if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
      fetch(`${getServerUrl()}/api/rooms/info/local-ip`)
        .then((res) => res.json())
        .then((data) => {
          if (data.ip && data.ip !== 'localhost') {
            setJoinUrl(`http://${data.ip}:3000/room/${room.code}`);
          }
        })
        .catch(() => {});
    }
  }, [room.code]);

  useEffect(() => {
    if (qrCanvasRef.current && joinUrl) {
      QRCode.toCanvas(qrCanvasRef.current, joinUrl, {
        width: 170,
        margin: 1,
        color: { dark: '#f8fafc', light: '#12141d' },
      }).catch(console.error);
    }
  }, [joinUrl]);

  async function handleStart() {
    setStarting(true);
    try {
      const socket = getSocket();
      if (socket.connected) {
        socket.emit('room:start', { roomId: room.id });
      }
      const res = await fetch(`${getServerUrl()}/api/rooms/${room.code}/start`, { method: 'POST' });
      const data = await res.json();
      if (data.room && data.room.status === 'capturing') {
        onStart();
      }
    } catch (e) {
      console.error('Start error:', e);
    }
    setStarting(false);
  }

  function copyLink() {
    navigator.clipboard.writeText(joinUrl).then(() => {
      setCopyDone(true);
      setTimeout(() => setCopyDone(false), 2000);
    });
  }

  return (
    <main style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 16px', position: 'relative' }}>
      <div style={{ width: '100%', maxWidth: isSolo ? '520px' : '780px', display: 'flex', flexDirection: 'column', gap: '20px', position: 'relative', zIndex: 1 }}>
        
        {/* Header */}
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--accent-pink)', marginBottom: '4px' }}>
            <CameraIcon size={18} />
            <span style={{ fontFamily: 'var(--font-display)', fontSize: '15px', fontWeight: 800, letterSpacing: '0.05em' }}>
              {isSolo ? 'SOLO PHOTOBOOTH' : 'SNAPSYNC LOBBY'}
            </span>
          </div>
          <h1 style={{ fontSize: '26px', fontWeight: 800 }}>
            {isSolo ? 'Sesi Foto Sendiri' : 'Ruang Tunggu Photobooth'}
          </h1>
          
          <div style={{ marginTop: '8px', display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.04)', padding: '6px 14px', borderRadius: 'var(--radius-full)', border: '1px solid var(--border-subtle)' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>Kode Room:</span>
            <span style={{ fontFamily: 'monospace', fontSize: '19px', fontWeight: 800, letterSpacing: '0.14em', color: 'var(--accent-pink)' }}>{room.code}</span>
            {!isSolo && (
              <button className="btn btn-ghost btn-sm" onClick={copyLink} id="copy-link-btn" style={{ padding: '3px 8px', fontSize: '11px' }}>
                {copyDone ? <CheckIcon size={13} color="var(--accent-emerald)" /> : <CopyIcon size={13} />}
                <span>{copyDone ? 'Tersalin' : 'Salin'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Layout: Single Card for Solo, 2-Column for Duo */}
        <div style={{ display: 'grid', gridTemplateColumns: isSolo ? '1fr' : 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px', alignItems: 'stretch' }}>
          
          {/* Left Column: QR Code & Link Sharing (Only for Duo mode) */}
          {!isSolo && (
            <div className="glass-card" style={{ padding: '22px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '14px', textAlign: 'center' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                Undang Teman / Buka di HP
              </span>
              
              <div style={{ padding: '10px', background: '#12141d', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', boxShadow: '0 4px 20px rgba(0,0,0,0.45)' }}>
                <canvas ref={qrCanvasRef} style={{ display: 'block' }} />
              </div>

              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', maxWidth: '280px' }}>
                Scan QR code dengan kamera HP untuk masuk sebagai partner secara instan.
              </p>

              <div
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  background: 'rgba(255,255,255,0.03)', borderRadius: 'var(--radius-sm)',
                  padding: '8px 12px', border: '1px solid var(--border-subtle)',
                  cursor: 'pointer', width: '100%',
                }}
                onClick={copyLink}
                title="Klik untuk salin link"
              >
                <span style={{ flex: 1, fontSize: '12px', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{joinUrl}</span>
                {copyDone ? <CheckIcon size={15} color="var(--accent-emerald)" /> : <CopyIcon size={15} color="var(--text-muted)" />}
              </div>
            </div>
          )}

          {/* Right Column: Participants & Start Action */}
          <div className="glass-card" style={{ padding: '22px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '16px' }}>
            
            {/* Participants list */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                  Peserta ({participants.length}/{room.capacity})
                </span>
                <span className="badge badge-neutral" style={{ fontSize: '11px' }}>
                  {isSolo ? <><UserIcon size={11} /> Mode Solo</> : <><UsersIcon size={11} /> 2 Orang Diperlukan</>}
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {participants.map((p) => (
                  <div key={p.id} className="glass-card-compact" style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                      width: '34px', height: '34px', borderRadius: '50%',
                      background: 'linear-gradient(135deg, #ff5e97, #f43f5e)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '13px', fontWeight: 800, color: 'white', flexShrink: 0,
                    }}>
                      {p.displayName.charAt(0).toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.displayName}</span>
                        {p.id === myParticipantId && <span style={{ color: 'var(--accent-pink)', fontSize: '11px', fontWeight: 600 }}>(Kamu)</span>}
                      </div>
                      <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '1px' }}>
                        {isSolo ? <><UserIcon size={12} color="var(--accent-pink)" /> Pemain Solo</> : (p.isHost ? <><CrownIcon size={12} color="var(--accent-amber)" /> Host</> : <><UserIcon size={12} /> Guest</>)}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <div className={`connection-dot ${p.connectionStatus}`} />
                      <span style={{ fontSize: '11px', color: p.connectionStatus === 'connected' ? 'var(--accent-emerald)' : 'var(--text-muted)', textTransform: 'capitalize' }}>
                        {p.connectionStatus === 'connected' ? 'Online' : 'Menghubungkan'}
                      </span>
                    </div>
                  </div>
                ))}

                {!isSolo && participants.length < room.capacity && (
                  <div className="glass-card-compact" style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: '12px', borderStyle: 'dashed', background: 'transparent' }}>
                    <div style={{ width: '34px', height: '34px', borderRadius: '50%', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                      <UserIcon size={16} />
                    </div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '12.5px' }}>Menunggu teman kedua bergabung…</div>
                  </div>
                )}
              </div>
            </div>

            {/* Session specs */}
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              <span className="badge badge-neutral"><CameraIcon size={11} /> Hingga 10 Foto</span>
              <span className="badge badge-neutral"><ClockIcon size={11} /> {room.settings.countdownSeconds}d Timer</span>
              <span className="badge badge-neutral"><PaletteIcon size={11} /> 93+ Template</span>
            </div>

            {/* Start Button */}
            <div>
              {isHost ? (
                <button
                  className="btn btn-primary btn-lg"
                  style={{ width: '100%', fontSize: '15px' }}
                  onClick={handleStart}
                  disabled={!canStart || starting}
                  id="start-session-btn"
                >
                  {starting ? (
                    <><span className="spinner" /> Memulai Sesi…</>
                  ) : !canStart ? (
                    <><ClockIcon size={16} /> Menunggu Teman Bergabung</>
                  ) : (
                    <>{isSolo ? 'Mulai Sesi Foto Solo' : 'Mulai Photobooth'} <ArrowRightIcon size={16} /></>
                  )}
                </button>
              ) : (
                <div style={{ textAlign: 'center', padding: '12px', background: 'rgba(139,92,246,0.08)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(139,92,246,0.2)' }}>
                  <p style={{ color: 'var(--accent-violet)', fontSize: '13px', fontWeight: 600 }}>
                    Menunggu Host ({participants.find(p => p.isHost)?.displayName || 'Host'}) memulai sesi…
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
