'use client';

import React, { useEffect, useState } from 'react';
import { getSocket } from '@/lib/socket';
import { WifiIcon, WifiOffIcon, RefreshCwIcon } from './Icons';
import { useLanguage } from '@/lib/i18n';

export type ConnectionStatus = 'connected' | 'connecting' | 'disconnected';

interface ConnectionBannerProps {
  status?: ConnectionStatus;
  onReconnect?: () => void;
}

export default function ConnectionBanner({ status: externalStatus, onReconnect }: ConnectionBannerProps) {
  const { t } = useLanguage();
  const [internalStatus, setInternalStatus] = useState<ConnectionStatus>('connected');
  const [showRestoredNotice, setShowRestoredNotice] = useState(false);

  const status = externalStatus ?? internalStatus;

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleConnect = () => {
      setInternalStatus('connected');
      setShowRestoredNotice(true);
      const timer = setTimeout(() => setShowRestoredNotice(false), 2500);
      return () => clearTimeout(timer);
    };

    const handleDisconnect = () => {
      setInternalStatus('disconnected');
      setShowRestoredNotice(false);
    };

    const handleReconnectAttempt = () => {
      setInternalStatus('connecting');
    };

    const handleOnline = () => {
      if (!socket.connected) {
        setInternalStatus('connecting');
        socket.connect();
      }
    };

    const handleOffline = () => {
      setInternalStatus('disconnected');
    };

    if (socket.connected) {
      setInternalStatus('connected');
    } else {
      setInternalStatus('connecting');
    }

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.io.on('reconnect_attempt', handleReconnectAttempt);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.io.off('reconnect_attempt', handleReconnectAttempt);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  function handleManualReconnect() {
    if (onReconnect) {
      onReconnect();
    } else {
      const socket = getSocket();
      if (socket) {
        socket.connect();
      }
    }
  }

  if (status === 'connected' && !showRestoredNotice) {
    return null;
  }

  if (showRestoredNotice) {
    return (
      <div
        style={{
          position: 'fixed',
          top: 'calc(14px + var(--sat, 0px))',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 9998,
          background: 'rgba(16, 185, 129, 0.92)',
          backdropFilter: 'blur(8px)',
          color: '#ffffff',
          borderRadius: 'var(--radius-full)',
          padding: '7px 18px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: '12.5px',
          fontWeight: 700,
          boxShadow: '0 8px 24px rgba(16, 185, 129, 0.35)',
          animation: 'fadeInDown 0.25s ease-out',
        }}
      >
        <WifiIcon size={15} />
        <span>{t('connConnected')}</span>
      </div>
    );
  }

  const isDisconnected = status === 'disconnected';

  return (
    <div
      style={{
        position: 'fixed',
        top: 'calc(14px + var(--sat, 0px))',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 9998,
        maxWidth: '92vw',
        background: isDisconnected ? 'rgba(239, 68, 68, 0.92)' : 'rgba(245, 158, 11, 0.92)',
        backdropFilter: 'blur(8px)',
        color: '#ffffff',
        borderRadius: 'var(--radius-full)',
        padding: '8px 18px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        fontSize: '12.5px',
        fontWeight: 700,
        boxShadow: isDisconnected
          ? '0 8px 32px rgba(239, 68, 68, 0.4)'
          : '0 8px 32px rgba(245, 158, 11, 0.4)',
        animation: 'fadeInDown 0.25s ease-out',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {isDisconnected ? (
          <WifiOffIcon size={16} />
        ) : (
          <div className="spinner" style={{ width: '14px', height: '14px', borderWidth: '2px' }} />
        )}
        <span>{isDisconnected ? t('connDisconnected') : t('connConnecting')}</span>
      </div>

      {isDisconnected && (
        <button
          type="button"
          onClick={handleManualReconnect}
          style={{
            background: 'rgba(255, 255, 255, 0.25)',
            border: 'none',
            borderRadius: 'var(--radius-full)',
            padding: '4px 10px',
            color: '#ffffff',
            fontSize: '11.5px',
            fontWeight: 800,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          <RefreshCwIcon size={12} /> {t('connReconnectBtn')}
        </button>
      )}
    </div>
  );
}
