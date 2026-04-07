'use client';

import { useEffect } from 'react';
import { useAuth } from './AuthProvider';

export default function AdminGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && user && user.role !== 'superadmin') {
      window.location.href = '/';
    }
  }, [user, loading]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!user || user.role !== 'superadmin') {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-gray-500 dark:text-gray-400 dark:text-gray-500">アクセス権限がありません</p>
      </div>
    );
  }

  return <>{children}</>;
}
