'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Socket } from 'socket.io-client';
import { Participant, Room } from '@/types';
import { ChatIcon, SendIcon, XIcon, UserIcon } from './Icons';

export interface ChatMessage {
  id: string;
  roomId: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: number;
}

interface RoomChatProps {
  room: Room;
  participants: Participant[];
  myParticipantId: string;
  socket: Socket | null;
}

const QUICK_EMOJIS = ['❤️', '📸', '😂', '✌️', '🎉', '🔥'];

export default function RoomChat({ room, participants, myParticipantId, socket }: RoomChatProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const isSolo = room.capacity === 1 || room.settings?.mode === 'solo';
  const partner = participants.find((p) => p.id !== myParticipantId);

  // Auto scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
      setUnreadCount(0);
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages]);

  // Socket listener for chat
  useEffect(() => {
    if (!socket) return;

    // Request chat history on mount
    socket.emit('chat:getHistory', { roomId: room.id });

    const handleHistory = ({ history }: { history: ChatMessage[] }) => {
      if (Array.isArray(history)) {
        setMessages(history);
      }
    };

    const handleNewMessage = (msg: ChatMessage) => {
      if (!msg || msg.roomId !== room.id) return;
      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });

      if (!isOpen && msg.senderId !== myParticipantId) {
        setUnreadCount((c) => c + 1);
      }
    };

    socket.on('chat:history', handleHistory);
    socket.on('chat:message', handleNewMessage);

    return () => {
      socket.off('chat:history', handleHistory);
      socket.off('chat:message', handleNewMessage);
    };
  }, [socket, room.id, isOpen, myParticipantId]);

  function sendMessage(textToSend?: string) {
    const text = (textToSend || input).trim();
    if (!text || !socket) return;

    socket.emit('chat:send', { roomId: room.id, text });
    setInput('');
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  function formatTime(ts: number) {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  if (isSolo) return null;

  return (
    <aside aria-label="Room Chat" style={{ position: 'fixed', bottom: 'calc(16px + var(--sab, 0px))', right: 'calc(16px + var(--sar, 0px))', zIndex: 1000 }}>
      {/* Floating Chat Button (When Closed) */}
      {!isOpen && (
        <button
          className="btn"
          onClick={() => setIsOpen(true)}
          id="open-chat-btn"
          style={{
            width: '50px',
            height: '50px',
            borderRadius: '50%',
            padding: 0,
            background: 'linear-gradient(135deg, #ff5e97, #f43f5e)',
            color: '#fff',
            boxShadow: '0 8px 24px rgba(255, 94, 151, 0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            border: 'none',
            cursor: 'pointer',
            transition: 'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
          }}
          title="Buka Chat Room"
        >
          <ChatIcon size={22} />
          {unreadCount > 0 && (
            <span
              style={{
                position: 'absolute',
                top: '-4px',
                right: '-4px',
                background: '#10b981',
                color: '#fff',
                fontSize: '11px',
                fontWeight: 800,
                width: '20px',
                height: '20px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 8px rgba(16, 185, 129, 0.6)',
                border: '2px solid #090a10',
              }}
            >
              {unreadCount}
            </span>
          )}
        </button>
      )}

      {/* Expanded Chat Drawer / Card */}
      {isOpen && (
        <div
          className="glass-card"
          style={{
            width: '320px',
            maxWidth: 'calc(100vw - 32px)',
            height: '420px',
            maxHeight: 'calc(100dvh - 120px)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            borderRadius: 'var(--radius-lg)',
            boxShadow: '0 16px 40px rgba(0, 0, 0, 0.75)',
            background: 'rgba(12, 14, 22, 0.95)',
            backdropFilter: 'blur(16px)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          {/* Chat Header */}
          <div
            style={{
              padding: '12px 14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
              background: 'rgba(255, 255, 255, 0.03)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div
                style={{
                  width: '26px',
                  height: '26px',
                  borderRadius: '50%',
                  background: 'rgba(255, 94, 151, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--accent-pink)',
                }}
              >
                <ChatIcon size={14} />
              </div>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 700, lineHeight: 1.2 }}>
                  Obrolan Sesi
                </div>
                <div style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>
                  {isSolo ? 'Mode Solo' : (partner ? partner.displayName : 'Menunggu partner…')}
                </div>
              </div>
            </div>

            <button
              onClick={() => setIsOpen(false)}
              className="btn btn-ghost btn-sm"
              style={{ padding: '4px', width: '26px', height: '26px', borderRadius: '50%' }}
              title="Tutup Chat"
            >
              <XIcon size={14} />
            </button>
          </div>

          {/* Messages Scroll Area */}
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '12px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            {messages.length === 0 ? (
              <div
                style={{
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  color: 'var(--text-muted)',
                  textAlign: 'center',
                  padding: '16px',
                }}
              >
                <span style={{ fontSize: '24px' }}>💬</span>
                <span style={{ fontSize: '12px' }}>Belum ada pesan. Sapa temanmu di sini!</span>
              </div>
            ) : (
              messages.map((m) => {
                const isMe = m.senderId === myParticipantId;
                return (
                  <div
                    key={m.id}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: isMe ? 'flex-end' : 'flex-start',
                      maxWidth: '85%',
                      alignSelf: isMe ? 'flex-end' : 'flex-start',
                    }}
                  >
                    {!isMe && (
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '2px', paddingLeft: '4px' }}>
                        {m.senderName}
                      </span>
                    )}
                    <div
                      style={{
                        padding: '7px 11px',
                        borderRadius: isMe ? '14px 14px 2px 14px' : '14px 14px 14px 2px',
                        background: isMe ? 'linear-gradient(135deg, #ff5e97, #f43f5e)' : 'rgba(255, 255, 255, 0.07)',
                        color: '#fff',
                        fontSize: '12.5px',
                        wordBreak: 'break-word',
                        boxShadow: isMe ? '0 2px 8px rgba(255, 94, 151, 0.3)' : 'none',
                        border: isMe ? 'none' : '1px solid rgba(255, 255, 255, 0.08)',
                      }}
                    >
                      {m.text}
                    </div>
                    <span style={{ fontSize: '9.5px', color: 'var(--text-muted)', marginTop: '2px', padding: '0 4px' }}>
                      {formatTime(m.timestamp)}
                    </span>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Reaction Emojis */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '6px 10px',
              borderTop: '1px solid rgba(255, 255, 255, 0.06)',
              background: 'rgba(255, 255, 255, 0.02)',
            }}
          >
            {QUICK_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => sendMessage(emoji)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '16px',
                  cursor: 'pointer',
                  padding: '2px 4px',
                  borderRadius: '4px',
                  transition: 'transform 0.1s ease',
                }}
                title={`Kirim ${emoji}`}
              >
                {emoji}
              </button>
            ))}
          </div>

          {/* Chat Input Field */}
          <div
            style={{
              padding: '8px 10px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              borderTop: '1px solid rgba(255, 255, 255, 0.08)',
              background: 'rgba(9, 10, 16, 0.8)',
            }}
          >
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Tulis pesan…"
              maxLength={300}
              style={{
                flex: 1,
                padding: '7px 10px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                background: 'rgba(255, 255, 255, 0.05)',
                color: 'var(--text-primary)',
                fontSize: '12px',
                outline: 'none',
              }}
            />
            <button
              onClick={() => sendMessage()}
              disabled={!input.trim()}
              className="btn btn-primary"
              style={{
                padding: '7px 10px',
                minWidth: 'auto',
                height: '32px',
                borderRadius: 'var(--radius-sm)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              title="Kirim Pesan"
            >
              <SendIcon size={13} />
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}
