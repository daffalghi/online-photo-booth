import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'SnapSync',
  description: 'Online photobooth studio interaktif dengan beragam frame estetik. Ambil foto sendiri, berdua, atau rame-rame dalam grup!',
  keywords: ['photobooth', 'online photobooth', 'synchronized photos', 'virtual photobooth', 'snapsync'],
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
    ],
    apple: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
    ],
  },
  openGraph: {
    title: 'SnapSync',
    description: 'Online photobooth studio interaktif dengan beragam frame estetik.',
    type: 'website',
  },
  manifest: '/manifest.json',
};

export const viewport: Viewport = {
  themeColor: '#080812',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
};

import { LanguageProvider } from '@/lib/i18n';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <head />
      <body>
        <LanguageProvider>{children}</LanguageProvider>
      </body>
    </html>
  );
}
