import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/components/AuthProvider';
import AuthGuard from '@/components/AuthGuard';
import NavBar from '@/components/NavBar';

export const metadata: Metadata = {
  title: 'ThreatGuard - Brand Protection Dashboard',
  description: 'Detect and take down brand impersonation threats',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>
        <AuthProvider>
          <AuthGuard>
            <div className="min-h-screen">
              <NavBar />
              <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
                {children}
              </main>
            </div>
          </AuthGuard>
        </AuthProvider>
      </body>
    </html>
  );
}
