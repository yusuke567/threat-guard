import type { Metadata, Viewport } from 'next';
import './globals.css';
import { AuthProvider } from '@/components/AuthProvider';
import AuthGuard from '@/components/AuthGuard';
import ThemeProvider from '@/components/ThemeProvider';
import LayoutContent from '@/components/LayoutContent';

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
    <html lang="ja" suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <AuthProvider>
            <AuthGuard>
              <LayoutContent>{children}</LayoutContent>
            </AuthGuard>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
