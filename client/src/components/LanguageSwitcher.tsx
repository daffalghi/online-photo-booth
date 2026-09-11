'use client';

import { useLanguage } from '@/lib/i18n';

export default function LanguageSwitcher({ style }: { style?: React.CSSProperties }) {
  const { language, setLanguage } = useLanguage();

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        background: 'rgba(255, 255, 255, 0.05)',
        backdropFilter: 'blur(12px)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-full)',
        padding: '3px 4px',
        gap: '2px',
        ...style,
      }}
      role="group"
      aria-label="Language selection"
    >
      <button
        type="button"
        onClick={() => setLanguage('id')}
        style={{
          border: 'none',
          background: language === 'id' ? 'var(--accent-pink)' : 'transparent',
          color: language === 'id' ? '#ffffff' : 'var(--text-muted)',
          fontSize: '11px',
          fontWeight: 700,
          padding: '3px 8px',
          borderRadius: 'var(--radius-full)',
          cursor: 'pointer',
          transition: 'all 0.15s ease',
        }}
      >
        🇮🇩 ID
      </button>
      <button
        type="button"
        onClick={() => setLanguage('en')}
        style={{
          border: 'none',
          background: language === 'en' ? 'var(--accent-pink)' : 'transparent',
          color: language === 'en' ? '#ffffff' : 'var(--text-muted)',
          fontSize: '11px',
          fontWeight: 700,
          padding: '3px 8px',
          borderRadius: 'var(--radius-full)',
          cursor: 'pointer',
          transition: 'all 0.15s ease',
        }}
      >
        🇬🇧 EN
      </button>
    </div>
  );
}
