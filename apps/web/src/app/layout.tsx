import type { Metadata, Viewport } from 'next';
import { Noto_Sans_JP } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/components/AuthProvider';
import AuthGuard from '@/components/AuthGuard';
import ThemeProvider from '@/components/ThemeProvider';
import LayoutContent from '@/components/LayoutContent';
import { ToastProvider } from '@/components/ui';

const notoSansJP = Noto_Sans_JP({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-noto-sans-jp',
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  title: 'ThreatGuard - Brand Protection Dashboard',
  description: 'Detect and take down brand impersonation threats',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja" suppressHydrationWarning className={notoSansJP.variable}>
      <body>
        <ThemeProvider>
          <ToastProvider>
            <AuthProvider>
              <AuthGuard>
                <LayoutContent>{children}</LayoutContent>
              </AuthGuard>
            </AuthProvider>
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
