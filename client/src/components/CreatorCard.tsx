'use client';

import React, { useState } from 'react';
import { MailIcon, GithubIcon, LinkedinIcon, CoffeeIcon, CloseIcon, CheckIcon, CopyIcon } from './Icons';
import { useLanguage } from '@/lib/i18n';

export default function CreatorCard() {
  const { t } = useLanguage();
  const [showSupportModal, setShowSupportModal] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState(false);

  const email = 'daffaserangbanten@gmail.com';
  const githubUrl = 'https://github.com/daffalghi';
  const linkedinUrl = 'https://linkedin.com/in/daffa-al-ghifari';
  const buyMeCoffeeUrl = 'https://buymeacoffee.com/daffalghi';
  const saweriaUrl = 'https://saweria.co/daffalghi';

  function handleCopyEmail() {
    navigator.clipboard.writeText(email);
    setCopiedEmail(true);
    setTimeout(() => setCopiedEmail(false), 2500);
  }

  return (
    <>
      {/* Footer Creator & Support Card */}
      <footer
        className="glass-card"
        style={{
          width: '100%',
          padding: '20px 24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          background: 'rgba(18, 20, 29, 0.65)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '16px',
          }}
        >
          {/* Creator Profile */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, var(--accent-pink), #8b5cf6)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
                fontWeight: 800,
                fontSize: '17px',
                boxShadow: '0 4px 16px rgba(255, 94, 151, 0.3)',
              }}
            >
              D
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-primary)' }}>
                  Daffa Al Ghifari
                </span>
                <span
                  style={{
                    fontSize: '10px',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: 'var(--radius-full)',
                    background: 'rgba(255, 94, 151, 0.15)',
                    color: 'var(--accent-pink)',
                    border: '1px solid rgba(255, 94, 151, 0.25)',
                  }}
                >
                  Creator
                </span>
              </div>
              <p style={{ margin: '2px 0 0', fontSize: '11.5px', color: 'var(--text-secondary)' }}>
                {t('developedBy')} Daffa Al Ghifari · Free & Open Photobooth
              </p>
            </div>
          </div>

          {/* Social & Contact Links */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {/* Email Link */}
            <a
              href={`mailto:${email}`}
              className="btn btn-secondary btn-sm"
              title={`Kirim email ke ${email}`}
              style={{ padding: '6px 12px', fontSize: '12px', gap: '6px' }}
            >
              <MailIcon size={14} />
              <span>Email</span>
            </a>

            {/* GitHub Link */}
            <a
              href={githubUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary btn-sm"
              title="GitHub daffalghi"
              style={{ padding: '6px 12px', fontSize: '12px', gap: '6px' }}
            >
              <GithubIcon size={14} />
              <span>GitHub</span>
            </a>

            {/* LinkedIn Link */}
            <a
              href={linkedinUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary btn-sm"
              title="LinkedIn daffa-al-ghifari"
              style={{ padding: '6px 12px', fontSize: '12px', gap: '6px' }}
            >
              <LinkedinIcon size={14} />
              <span>LinkedIn</span>
            </a>

            {/* Buy Me a Coffee Action Button */}
            <button
              type="button"
              onClick={() => setShowSupportModal(true)}
              className="btn btn-sm"
              id="support-donate-btn"
              style={{
                padding: '6px 14px',
                fontSize: '12px',
                fontWeight: 800,
                background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                color: '#ffffff',
                border: '1px solid rgba(245, 158, 11, 0.4)',
                boxShadow: '0 4px 16px rgba(245, 158, 11, 0.3)',
                gap: '6px',
              }}
            >
              <CoffeeIcon size={15} />
              <span>{t('buyMeCoffeeBtn')}</span>
            </button>
          </div>
        </div>
      </footer>

      {/* ─── SUPPORT & DONATION MODAL ────────────────────────────────────── */}
      {showSupportModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 10000,
            background: 'rgba(0, 0, 0, 0.8)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
          onClick={() => setShowSupportModal(false)}
        >
          <div
            className="glass-card"
            style={{
              width: '100%',
              maxWidth: '460px',
              padding: '26px',
              display: 'flex',
              flexDirection: 'column',
              gap: '18px',
              border: '1px solid rgba(245, 158, 11, 0.35)',
              boxShadow: '0 24px 64px rgba(0, 0, 0, 0.9), 0 0 32px rgba(245, 158, 11, 0.15)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '10px',
                    background: 'rgba(245, 158, 11, 0.18)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#f59e0b',
                  }}
                >
                  <CoffeeIcon size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: '17px', fontWeight: 800, margin: 0 }}>
                    {t('supportTitle')}
                  </h3>
                  <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                    by Daffa Al Ghifari
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowSupportModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '4px',
                }}
              >
                <CloseIcon size={18} />
              </button>
            </div>

            {/* Description */}
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
              {t('supportDesc')}
            </p>

            {/* Donation Options */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.04em' }}>
                {t('supportDonateVia')}
              </span>

              {/* Buy Me a Coffee Direct */}
              <a
                href={buyMeCoffeeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn"
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  background: 'linear-gradient(135deg, #f59e0b, #b45309)',
                  color: '#ffffff',
                  fontWeight: 800,
                  fontSize: '13.5px',
                  borderRadius: 'var(--radius-sm)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  border: '1px solid rgba(245, 158, 11, 0.4)',
                }}
              >
                <CoffeeIcon size={18} />
                <span>Buy Me a Coffee (International)</span>
              </a>

              {/* Saweria / Trakteer (Indonesia) */}
              <a
                href={saweriaUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-secondary"
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  fontWeight: 700,
                  fontSize: '13.5px',
                  borderRadius: 'var(--radius-sm)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                }}
              >
                <span>🇮🇩 Saweria / QRIS / GoPay / OVO</span>
              </a>
            </div>

            {/* Contact Email Section */}
            <div
              style={{
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-sm)',
                padding: '12px 14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '10px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                <MailIcon size={16} color="var(--accent-pink)" />
                <span
                  style={{
                    fontSize: '12.5px',
                    fontFamily: 'monospace',
                    color: 'var(--text-primary)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {email}
                </span>
              </div>
              <button
                type="button"
                onClick={handleCopyEmail}
                className="btn btn-secondary btn-sm"
                style={{ flexShrink: 0, padding: '4px 10px', fontSize: '11px', gap: '4px' }}
              >
                {copiedEmail ? (
                  <>
                    <CheckIcon size={12} color="var(--accent-emerald)" />
                    <span>{t('emailCopied')}</span>
                  </>
                ) : (
                  <>
                    <CopyIcon size={12} />
                    <span>{t('supportCopyEmail')}</span>
                  </>
                )}
              </button>
            </div>

            {/* Close Button */}
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setShowSupportModal(false)}
              style={{ width: '100%', marginTop: '4px' }}
            >
              {t('supportClose')}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
