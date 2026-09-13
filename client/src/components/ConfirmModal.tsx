'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangleIcon, CloseIcon } from './Icons';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmModal({
  isOpen,
  title,
  message,
  confirmText = 'Konfirmasi',
  cancelText = 'Batal',
  isDestructive = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!isOpen || !mounted) return null;

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        background: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
      onClick={onCancel}
    >
      <div
        className="glass-card"
        style={{
          width: '100%',
          maxWidth: '420px',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          border: isDestructive
            ? '1px solid rgba(239, 68, 68, 0.35)'
            : '1px solid var(--border-subtle)',
          boxShadow: isDestructive
            ? '0 16px 48px rgba(239, 68, 68, 0.15), 0 24px 64px rgba(0,0,0,0.85)'
            : '0 24px 64px rgba(0,0,0,0.85)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                background: isDestructive ? 'rgba(239, 68, 68, 0.15)' : 'rgba(255, 94, 151, 0.15)',
                color: isDestructive ? '#f87171' : 'var(--accent-pink)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <AlertTriangleIcon size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 800, margin: 0 }}>
                {title}
              </h3>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '4px',
            }}
          >
            <CloseIcon size={16} />
          </button>
        </div>

        {/* Body */}
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.55, margin: 0 }}>
          {message}
        </p>

        {/* Actions */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '6px' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onCancel}
            style={{ fontWeight: 600 }}
          >
            {cancelText}
          </button>
          <button
            type="button"
            className={isDestructive ? 'btn btn-primary' : 'btn btn-primary'}
            onClick={onConfirm}
            style={{
              fontWeight: 700,
              background: isDestructive
                ? 'linear-gradient(135deg, #ef4444, #dc2626)'
                : undefined,
              borderColor: isDestructive ? '#ef4444' : undefined,
            }}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
