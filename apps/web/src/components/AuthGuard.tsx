'use client';

import { useAuth } from './AuthProvider';
import LoginPage from '@/app/login/LoginPage';

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

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

  // superadmin without org → redirect to admin panel (except alerts page)
  if (user.role === 'superadmin' && !user.organizationId && typeof window !== 'undefined' 
    && !window.location.pathname.startsWith('/admin') 
    && !window.location.pathname.startsWith('/alerts')) {
    window.location.href = '/admin/organizations';
    return null;
  }

  return <>{children}</>;
}
