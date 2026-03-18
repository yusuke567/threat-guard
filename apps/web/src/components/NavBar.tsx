'use client';

import { useState } from 'react';
import { useAuth } from './AuthProvider';
import ThemeToggle from './ThemeToggle';

export default function NavBar() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const isSuperAdmin = user?.role === 'superadmin';

  return (
    <nav className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 sm:px-6 py-3 sm:py-4">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <a href="/" className="flex items-center gap-2">
          <span className="text-2xl">🛡️</span>
          <span className="text-xl font-bold text-gray-900 dark:text-gray-100">ThreatGuard</span>
        </a>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-6">
          <a href="/" className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white font-medium text-sm">脅威一覧</a>
          <a href="/social-monitor" className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white font-medium text-sm">SNS監視</a>
          <a href="/takedowns" className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white font-medium text-sm">削除申請</a>
          <a href="/brands" className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white font-medium text-sm">ブランド管理</a>
          <a href="/reports" className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white font-medium text-sm">レポート</a>
          <a href="/alerts" className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white font-medium text-sm">設定</a>
          {isSuperAdmin && (
            <>
              <span className="text-gray-300 dark:text-gray-600">|</span>
              <a href="/admin/organizations" className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white font-medium text-sm">組織管理</a>
              <a href="/phishing-patterns" className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white font-medium text-sm">検知ルール</a>
            </>
          )}
          <ThemeToggle />
          {user && (
            <div className="flex items-center gap-3 ml-4 pl-4 border-l border-gray-200 dark:border-gray-600">
              {user.organizationName && (
                <span className="text-xs text-gray-400 bg-gray-100 dark:bg-gray-700 dark:text-gray-300 px-2 py-0.5 rounded">{user.organizationName}</span>
              )}
              <span className="text-sm text-gray-500 dark:text-gray-400">{user.name || user.email}</span>
              <button onClick={logout} className="text-sm text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 font-medium">
                ログアウト
              </button>
            </div>
          )}
        </div>

        {/* Mobile hamburger */}
        <button
          className="md:hidden p-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
          onClick={() => setOpen(!open)}
          aria-label="メニュー"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {open ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 space-y-2">
          <a href="/" className="block py-2 text-gray-700 dark:text-gray-200 hover:text-gray-900 dark:hover:text-white font-medium text-sm">脅威一覧</a>
          <a href="/social-monitor" className="block py-2 text-gray-700 dark:text-gray-200 hover:text-gray-900 dark:hover:text-white font-medium text-sm">SNS監視</a>
          <a href="/takedowns" className="block py-2 text-gray-700 dark:text-gray-200 hover:text-gray-900 dark:hover:text-white font-medium text-sm">削除申請</a>
          <a href="/brands" className="block py-2 text-gray-700 dark:text-gray-200 hover:text-gray-900 dark:hover:text-white font-medium text-sm">ブランド管理</a>
          <a href="/reports" className="block py-2 text-gray-700 dark:text-gray-200 hover:text-gray-900 dark:hover:text-white font-medium text-sm">レポート</a>
          <a href="/alerts" className="block py-2 text-gray-700 dark:text-gray-200 hover:text-gray-900 dark:hover:text-white font-medium text-sm">設定</a>
          {isSuperAdmin && (
            <div className="pt-2 mt-2 border-t border-gray-100 dark:border-gray-700 space-y-2">
              <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">管理者メニュー</p>
              <a href="/admin/organizations" className="block py-2 text-gray-700 dark:text-gray-200 hover:text-gray-900 dark:hover:text-white font-medium text-sm">組織管理</a>
              <a href="/phishing-patterns" className="block py-2 text-gray-700 dark:text-gray-200 hover:text-gray-900 dark:hover:text-white font-medium text-sm">検知ルール</a>
            </div>
          )}
          <div className="pt-2 mt-2 border-t border-gray-100 dark:border-gray-700">
            <ThemeToggle />
          </div>
          {user && (
            <div className="pt-2 mt-2 border-t border-gray-100 dark:border-gray-700 space-y-1">
              {user.organizationName && (
                <span className="text-xs text-gray-400 bg-gray-100 dark:bg-gray-700 dark:text-gray-300 px-2 py-0.5 rounded">{user.organizationName}</span>
              )}
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500 dark:text-gray-400">{user.name || user.email}</span>
                <button onClick={logout} className="text-sm text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 font-medium">
                  ログアウト
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </nav>
  );
}
