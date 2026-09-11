import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'SnapSync — Synced Photobooth for Two',
  description: 'Take synchronized split-screen photobooth photos with anyone, anywhere. Share a QR code, strike a pose together, and download a beautiful memory.',
  keywords: ['photobooth', 'online photobooth', 'synchronized photos', 'couples photos', 'virtual photobooth'],
  openGraph: {
    title: 'SnapSync — Synced Photobooth for Two',
    description: 'Take synchronized photobooth photos with anyone, from anywhere.',
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
