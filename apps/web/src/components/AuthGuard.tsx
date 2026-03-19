'use client';

import { usePathname } from 'next/navigation';
import { useAuth } from './AuthProvider';
import LoginPage from '@/app/login/LoginPage';

// Public pages that don't require authentication
const PUBLIC_PATHS = ['/login', '/forgot-password', '/reset-password'];

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const pathname = usePathname();

  // Skip auth check for public pages
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'))) {
    return <>{children}</>;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  // superadmin can access all pages regardless of org assignment

  return <>{children}</>;
}
