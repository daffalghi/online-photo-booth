'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { connectSocket, disconnectSocket, getSocket } from '@/lib/socket';
import { stopLocalStream, closePeerConnection } from '@/lib/webrtc';
import {
  FrameLockedPayload, PairedShot, Participant, Room,
  RoomStatePayload, RenderReadyPayload, VoteStatus, VoteStatusPayload
} from '@/types';
import Lobby from './Lobby';
import CapturePhase from './CapturePhase';
import PhotoSelection from './PhotoSelection';
import FrameSelection from './FrameSelection';
import ResultPage from './ResultPage';
import StepHeader from './StepHeader';
import { CameraIcon, UserIcon, ArrowRightIcon, InfoIcon, HomeIcon } from './Icons';
import { resolveMediaUrl } from '@/lib/config';

interface RoomPageProps {
  code: string;
}

type AppPhase = 'loading' | 'name_entry' | 'lobby' | 'capturing' | 'photo_selection' | 'frame_selection' | 'rendering' | 'completed' | 'error';

export default function RoomPage({ code }: RoomPageProps) {
  const router = useRouter();
  const [phase, setPhase] = useState<AppPhase>('loading');
  const [room, setRoom] = useState<Room | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [slots, setSlots] = useState<PairedShot[]>([]);
  const [myParticipantId, setMyParticipantId] = useState('');
  const [sessionToken, setSessionToken] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [votes, setVotes] = useState<VoteStatus[]>([]);
  const [downloadUrlPng, setDownloadUrlPng] = useState('');
  const [lockedFrameId, setLockedFrameId] = useState('');
  const [lockedCustomization, setLockedCustomization] = useState<{ accentColor?: string; captionText?: string }>({});
  const [error, setError] = useState('');
  const joinedRef = useRef(false);

  // Initialize socket connection
  useEffect(() => {
    const socket = connectSocket();

    socket.on('connect', () => {
      const token = localStorage.getItem(`token_${code}`);
      const name = localStorage.getItem(`name_${code}`);
      if (name && !joinedRef.current) {
        joinedRef.current = true;
        socket.emit('room:join', { roomCode: code, displayName: name, sessionToken: token || undefined });
      }
    });


    socket.on('room:state', (payload: RoomStatePayload) => {
      if (!payload.room) return;
      setRoom(payload.room);
      setParticipants(payload.participants);

      const normalizedSlots = (payload.slots || []).map((s) => ({
        ...s,
        leftPhotoUrl: resolveMediaUrl(s.leftPhotoUrl),
        rightPhotoUrl: resolveMediaUrl(s.rightPhotoUrl),
      }));
      setSlots(normalizedSlots);

      if (payload.votes && payload.votes.length > 0) {
        setVotes(payload.votes);
      }
      if (payload.downloadUrlPng) {
        setDownloadUrlPng(resolveMediaUrl(payload.downloadUrlPng));
      }

      const selectedFrame = payload.room.settings?.selectedFrameTemplateId;
      if (selectedFrame) {
        setLockedFrameId(selectedFrame);
      }
      if (payload.room.settings?.customization) {
        setLockedCustomization(payload.room.settings.customization);
      }

      if (payload.myParticipantId) {
        setMyParticipantId(payload.myParticipantId);
      }
      if (payload.sessionToken) {
        setSessionToken(payload.sessionToken);
        localStorage.setItem(`token_${code}`, payload.sessionToken);
      }

      const status = payload.room.status;
      if (status === 'lobby') setPhase('lobby');
      else if (status === 'capturing') setPhase('capturing');
      else if (status === 'photo_selection') setPhase('photo_selection');
      else if (status === 'frame_selection') setPhase('frame_selection');
      else if (status === 'rendering') setPhase('rendering');
      else if (status === 'completed') setPhase('completed');
    });

    socket.on('frame:voteStatus', (payload: VoteStatusPayload) => {
      setVotes(payload.votes);
    });

    socket.on('frame:locked', (payload: FrameLockedPayload) => {
      setLockedFrameId(payload.frameTemplateId);
      setLockedCustomization(payload.customization);
      setPhase('photo_selection');
    });

    socket.on('render:ready', (payload: RenderReadyPayload) => {
      setDownloadUrlPng(resolveMediaUrl(payload.downloadUrlPng));
      setPhase('completed');
    });


    socket.on('error', ({ message }: { message: string }) => {
      setError(message);
    });

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('room:state');
      socket.off('frame:voteStatus');
      socket.off('frame:locked');
      socket.off('render:ready');
      socket.off('error');
      disconnectSocket();
      stopLocalStream();
      closePeerConnection();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  // Returning user check
  useEffect(() => {
    const existingToken = localStorage.getItem(`token_${code}`);
    const existingName = localStorage.getItem(`name_${code}`);
    if (existingToken && existingName) {
      setDisplayName(existingName);
      setNameInput(existingName);
    } else {
      setPhase('name_entry');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleJoin() {
    const name = nameInput.trim();
    if (!name) { setError('Please enter your name'); return; }
    setDisplayName(name);
    localStorage.setItem(`name_${code}`, name);
    setError('');
    setPhase('loading');

    const socket = connectSocket();
    const token = localStorage.getItem(`token_${code}`) || undefined;

    const emitJoin = () => {
      joinedRef.current = true;
      socket.emit('room:join', { roomCode: code, displayName: name, sessionToken: token });
    };

    if (socket.connected) {
      emitJoin();
    } else {
      socket.once('connect', emitJoin);
    }
  }


  // Ordered slots based on selection
  const selectedOrder = room?.settings?.selectedPhotoOrder;
  const orderedSlots: PairedShot[] = (selectedOrder && selectedOrder.length > 0)
    ? selectedOrder
        .map((val: number | string, newIdx: number) => {
          const numIdx = typeof val === 'number' ? val : parseInt(String(val).split('_')[0], 10);
          const match = !isNaN(numIdx) ? slots.find((s) => s.slotIndex === numIdx) : null;
          return match ? { ...match, slotIndex: newIdx } : null;
        })
        .filter(Boolean) as PairedShot[]
    : slots;

  // ─── Render Phases ────────────────────────────────────────────────────
  if (phase === 'name_entry') {
    return (
      <main style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 16px' }}>
        <div style={{ width: '100%', maxWidth: '400px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{
              width: '48px', height: '48px', borderRadius: '14px',
              background: 'rgba(255,94,151,0.15)', border: '1px solid rgba(255,94,151,0.3)',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--accent-pink)', marginBottom: '12px',
            }}>
              <UserIcon size={24} />
            </div>
            <h1 style={{ fontSize: '26px', fontWeight: 800 }}>
              Masuk Photobooth
            </h1>
            <p style={{ color: 'var(--text-secondary)', marginTop: '4px', fontSize: '13px' }}>
              Kode Room: <span style={{ fontFamily: 'monospace', fontWeight: 800, color: 'var(--accent-pink)', fontSize: '16px' }}>{code}</span>
            </p>
          </div>

          <div className="glass-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ fontSize: '12.5px', color: 'var(--text-muted)', display: 'block', marginBottom: '6px', fontWeight: 600 }}>Nama Panggilanmu</label>
              <input
                className="input"
                id="display-name-input"
                placeholder="Masukkan nama kamu…"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
                maxLength={24}
                autoFocus
                style={{ fontSize: '15px', textAlign: 'center', fontWeight: 600 }}
              />
            </div>
            {error && (
              <div style={{ color: '#f87171', fontSize: '12.5px', textAlign: 'center' }}>{error}</div>
            )}
            <button
              className="btn btn-primary btn-lg"
              style={{ width: '100%', fontSize: '15px' }}
              onClick={handleJoin}
              id="join-room-confirm-btn"
            >
              <CameraIcon size={18} /> Masuk ke Ruangan
            </button>
          </div>
        </div>
      </main>
    );
  }

  if (phase === 'loading') {
    return (
      <main style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
        <div className="spinner" style={{ width: '32px', height: '32px', borderWidth: '3px' }} />
        <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Menghubungkan ke room {code}…</p>
      </main>
    );
  }

  if (phase === 'error' || !room) {
    return (
      <main style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '14px', padding: '24px' }}>
        <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(239,68,68,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f87171' }}>
          <InfoIcon size={24} />
        </div>
        <h2 style={{ fontSize: '20px', fontWeight: 800 }}>Room Tidak Ditemukan</h2>
        <p style={{ color: 'var(--text-secondary)', textAlign: 'center', fontSize: '13px', maxWidth: '320px' }}>
          {error || `Room "${code}" tidak ditemukan atau masa berlakunya telah berakhir.`}
        </p>
        <a href="/" className="btn btn-secondary btn-sm" id="home-btn">
          <HomeIcon size={14} /> Kembali ke Beranda
        </a>
      </main>
    );
  }

  if (phase === 'lobby') {
    return (
      <Lobby
        room={room}
        participants={participants}
        myParticipantId={myParticipantId}
        onStart={() => setPhase('capturing')}
      />
    );
  }


  if (phase === 'capturing') {
    return (
      <>
        <StepHeader roomCode={code} status={room.status} participants={participants} myParticipantId={myParticipantId} />
        <CapturePhase
          room={room}
          participants={participants}
          myParticipantId={myParticipantId}
          slots={slots}
          socket={getSocket()}
        />
      </>
    );
  }

  if (phase === 'frame_selection') {
    return (
      <>
        <StepHeader roomCode={code} status={room.status} participants={participants} myParticipantId={myParticipantId} />
        <FrameSelection
          room={room}
          participants={participants}
          myParticipantId={myParticipantId}
          slots={orderedSlots}
          votes={votes}
          socket={getSocket()}
        />
      </>
    );
  }

  if (phase === 'photo_selection') {
    return (
      <>
        <StepHeader roomCode={code} status={room.status} participants={participants} myParticipantId={myParticipantId} />
        <PhotoSelection
          room={room}
          participants={participants}
          myParticipantId={myParticipantId}
          slots={slots}
          socket={getSocket()}
          frameTemplateId={lockedFrameId || room.settings?.selectedFrameTemplateId || room.settings?.layout}
          customization={lockedCustomization}
        />
      </>
    );
  }

  if (phase === 'rendering') {
    return (
      <main style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
        <div className="spinner" style={{ width: '32px', height: '32px', borderWidth: '3px' }} />
        <h2 style={{ fontSize: '20px', fontWeight: 700 }}>
          <span className="gradient-text">Generating Final Photo Strip…</span>
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Compositing split camera frames into high-resolution layout</p>
      </main>
    );
  }

  if (phase === 'completed') {
    return (
      <>
        <StepHeader roomCode={code} status={room.status} participants={participants} myParticipantId={myParticipantId} />
        <ResultPage
          room={room}
          participants={participants}
          slots={orderedSlots}
          downloadUrlPng={downloadUrlPng}
          frameTemplateId={lockedFrameId || room.settings?.selectedFrameTemplateId || room.settings?.layout}
          customization={lockedCustomization}
          socket={getSocket()}
        />
      </>
    );
  }

  return null;
}
