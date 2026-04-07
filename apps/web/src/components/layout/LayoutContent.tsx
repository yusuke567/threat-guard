'use client';

import { usePathname } from 'next/navigation';
import NavBar from './NavBar';
import GlobalBanner from '@/components/announcements/GlobalBanner';
import PageSpotlightAlerts from '@/components/announcements/SpotlightAlert';

const PUBLIC_PATHS = ['/login', '/forgot-password', '/reset-password', '/diagnose'];

export default function LayoutContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isPublicPage = PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + '/')
  );

  if (isPublicPage) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen">
      <NavBar />
      <GlobalBanner />
      <main key={pathname} className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 animate-fade-in-up">
        <PageSpotlightAlerts />
        {children}
      </main>
    </div>
  );
}
