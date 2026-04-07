import type { Metadata, Viewport } from 'next';
import { Noto_Sans_JP } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/components/AuthProvider';
import AuthGuard from '@/components/AuthGuard';
import ThemeProvider from '@/components/ThemeProvider';
import LayoutContent from '@/components/LayoutContent';
import { ToastProvider } from '@/components/ui';
import { AnnouncementProvider } from '@/components/announcements/AnnouncementProvider';

const notoSansJP = Noto_Sans_JP({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  display: 'swap',
  variable: '--font-noto-sans-jp',
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#2563eb',
};

export const metadata: Metadata = {
  title: {
    default: 'ThreatGuard - ブランド保護ダッシュボード',
    template: '%s | ThreatGuard',
  },
  description: 'ブランドなりすまし検知・テイクダウン支援SaaS。フィッシングサイトの検知から削除申請まで、すべて自動で。',
  metadataBase: new URL('https://app.threatguard.jp'),
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
    ],
    apple: '/favicon.svg',
  },
  openGraph: {
    title: 'ThreatGuard - ブランド保護ダッシュボード',
    description: 'ブランドなりすまし検知・テイクダウン支援SaaS',
    url: 'https://app.threatguard.jp',
    siteName: 'ThreatGuard',
    locale: 'ja_JP',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'ThreatGuard - ブランド保護ダッシュボード',
    description: 'ブランドなりすまし検知・テイクダウン支援SaaS',
  },
  robots: {
    index: false,
    follow: false,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja" suppressHydrationWarning className={notoSansJP.variable}>
      <body>
        <ThemeProvider>
          <ToastProvider>
            <AuthProvider>
              <AuthGuard>
                <AnnouncementProvider>
                  <LayoutContent>{children}</LayoutContent>
                </AnnouncementProvider>
              </AuthGuard>
            </AuthProvider>
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
