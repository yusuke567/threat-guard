import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/components/AuthProvider';
import AuthGuard from '@/components/AuthGuard';
import NavBar from '@/components/NavBar';
import ThemeProvider from '@/components/ThemeProvider';

export const metadata: Metadata = {
  title: 'ThreatGuard - Brand Protection Dashboard',
  description: 'Detect and take down brand impersonation threats',
};

function LayoutContent({ children }: { children: React.ReactNode }) {
  'use client';
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const pathname = typeof window !== 'undefined' ? window.location.pathname : '';
  const isPublicPage = ['/login', '/forgot-password', '/reset-password'].some(
    (p) => pathname === p || pathname.startsWith(p + '/')
  );

  if (isPublicPage) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen">
      <NavBar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {children}
      </main>
    </div>
  );
}

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
