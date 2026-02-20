'use client';

import { useAuth } from './AuthProvider';

export default function NavBar() {
  const { user, logout } = useAuth();

  return (
    <nav className="bg-white border-b border-gray-200 px-6 py-4">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <a href="/" className="flex items-center gap-2">
          <span className="text-2xl">🛡️</span>
          <span className="text-xl font-bold text-gray-900">BrandShield</span>
        </a>
        <div className="flex items-center gap-6">
          <a href="/" className="text-gray-600 hover:text-gray-900 font-medium text-sm">ダッシュボード</a>
          <a href="/threats" className="text-gray-600 hover:text-gray-900 font-medium text-sm">脅威一覧</a>
          <a href="/brands" className="text-gray-600 hover:text-gray-900 font-medium text-sm">ブランド管理</a>
          {user && (
            <div className="flex items-center gap-3 ml-4 pl-4 border-l border-gray-200">
              <span className="text-sm text-gray-500">{user.name || user.email}</span>
              <button
                onClick={logout}
                className="text-sm text-red-600 hover:text-red-700 font-medium"
              >
                ログアウト
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
