'use client';

import { useState, useRef, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from './AuthProvider';
import ThemeToggle from './ThemeToggle';
import { Icon } from '@/components/ui';
import WhatsNewTrigger from '@/components/announcements/WhatsNewTrigger';

interface NavItem {
  href: string;
  label: string;
  match?: string[];
}

/** メイン: 日常のワークフロー（検知→対応） */
const MAIN_NAV_ITEMS: NavItem[] = [
  { href: '/', label: '脅威ダッシュボード', match: ['/', '/threats'] },
  { href: '/social-monitor', label: 'SNS監視' },
  { href: '/takedowns', label: '削除申請', match: ['/takedowns', '/takedown-request'] },
  { href: '/reports', label: 'レポート' },
];

/** 管理: 仕組みを整える */
const SETTINGS_NAV_ITEMS: NavItem[] = [
  { href: '/brands', label: 'ブランド' },
  { href: '/alerts', label: 'アラート通知' },
  { href: '/phishing-patterns', label: '検知ルール' },
];

function isActive(pathname: string, item: NavItem): boolean {
  const paths = item.match || [item.href];
  return paths.some((p) =>
    p === '/' ? pathname === '/' : pathname === p || pathname.startsWith(p + '/')
  );
}

export default function NavBar() {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);
  const isSuperAdmin = user?.role === 'superadmin';

  const isSettingsActive = SETTINGS_NAV_ITEMS.some((item) => isActive(pathname, item))
    || (isSuperAdmin && (
      isActive(pathname, { href: '/admin/organizations', label: '' })
      || isActive(pathname, { href: '/admin/activity-logs', label: '' })
    ));

  // 外側クリックでドロップダウンを閉じる
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setSettingsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const desktopLinkClass = (item: NavItem) =>
    isActive(pathname, item)
      ? 'text-brand-600 dark:text-brand-400 font-semibold text-sm transition-colors'
      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] font-medium text-sm transition-colors';

  const mobileLinkClass = (item: NavItem) =>
    isActive(pathname, item)
      ? 'block py-2 text-brand-600 dark:text-brand-400 font-semibold text-sm transition-colors'
      : 'block py-2 text-[var(--text-primary)] hover:text-brand-600 font-medium text-sm transition-colors';

  const dropdownLinkClass = (item: NavItem) =>
    isActive(pathname, item)
      ? 'block px-3 py-2 text-sm font-semibold text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-900/20 rounded-md'
      : 'block px-3 py-2 text-sm text-[var(--text-primary)] hover:bg-surface-elevated rounded-md transition-colors';

  return (
    <nav className="bg-surface-card border-b border-[var(--border-default)] px-4 sm:px-6 py-3 sm:py-4">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <a href="/" className="flex items-center gap-2">
          <Icon name="shield" size={28} className="text-brand-600" />
          <span className="text-xl font-bold text-[var(--text-primary)]">ThreatGuard</span>
        </a>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-6">
          {MAIN_NAV_ITEMS.map((item) => (
            <a key={item.href} href={item.href} className={desktopLinkClass(item)}>
              {item.label}
            </a>
          ))}

          <WhatsNewTrigger />

          {/* 管理ドロップダウン */}
          <div className="relative" ref={settingsRef}>
            <button
              onClick={() => setSettingsOpen(!settingsOpen)}
              className={`flex items-center gap-1 text-sm font-medium transition-colors ${
                isSettingsActive
                  ? 'text-brand-600 dark:text-brand-400 font-semibold'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              管理
              <svg className={`w-3 h-3 transition-transform ${settingsOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {settingsOpen && (
              <div className="absolute right-0 mt-2 w-52 bg-surface-card border border-[var(--border-default)] rounded-lg shadow-lg py-1 z-50 animate-slide-down">
                {/* 設定系 */}
                {SETTINGS_NAV_ITEMS.map((item) => (
                  <a key={item.href} href={item.href} className={dropdownLinkClass(item)} onClick={() => setSettingsOpen(false)}>
                    {item.label}
                  </a>
                ))}
                {isSuperAdmin && (
                  <>
                    <div className="my-1 border-t border-[var(--border-subtle)]" />
                    <a
                      href="/admin/organizations"
                      className={dropdownLinkClass({ href: '/admin/organizations', label: '組織管理' })}
                      onClick={() => setSettingsOpen(false)}
                    >
                      組織管理
                    </a>
                    <a
                      href="/admin/activity-logs"
                      className={dropdownLinkClass({ href: '/admin/activity-logs', label: 'アクティビティログ' })}
                      onClick={() => setSettingsOpen(false)}
                    >
                      アクティビティログ
                    </a>
                  </>
                )}

                {/* 表示 */}
                <div className="my-1 border-t border-[var(--border-subtle)]" />
                <div className="px-3 py-2">
                  <p className="text-xs text-[var(--text-tertiary)] mb-1.5">テーマ</p>
                  <ThemeToggle />
                </div>

                {/* アカウント */}
                {user && (
                  <>
                    <div className="my-1 border-t border-[var(--border-subtle)]" />
                    <div className="px-3 py-2">
                      <p className="text-sm text-[var(--text-primary)] font-medium">{user.name || user.email}</p>
                      {user.organizationName && (
                        <p className="text-xs text-[var(--text-tertiary)] mt-0.5">{user.organizationName}</p>
                      )}
                    </div>
                    <button
                      onClick={() => { setSettingsOpen(false); logout(); }}
                      className="block w-full text-left px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-surface-elevated rounded-md transition-colors"
                    >
                      ログアウト
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Mobile hamburger */}
        <button
          className="md:hidden p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="メニュー"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {mobileOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden mt-3 pt-3 border-t border-[var(--border-default)] space-y-2 animate-slide-down overflow-hidden">
          {MAIN_NAV_ITEMS.map((item) => (
            <a key={item.href} href={item.href} className={mobileLinkClass(item)}>
              {item.label}
            </a>
          ))}

          {/* お知らせ */}
          <div className="pt-2 mt-2 border-t border-[var(--border-subtle)]">
            <WhatsNewTrigger />
          </div>

          {/* 管理 */}
          <div className="pt-2 mt-2 border-t border-[var(--border-subtle)] space-y-2">
            <p className="text-xs text-[var(--text-tertiary)] font-medium uppercase tracking-wide">管理</p>
            {SETTINGS_NAV_ITEMS.map((item) => (
              <a key={item.href} href={item.href} className={mobileLinkClass(item)}>
                {item.label}
              </a>
            ))}
            {isSuperAdmin && (
              <>
                <a
                  href="/admin/organizations"
                  className={mobileLinkClass({ href: '/admin/organizations', label: '組織管理' })}
                >
                  組織管理
                </a>
                <a
                  href="/admin/activity-logs"
                  className={mobileLinkClass({ href: '/admin/activity-logs', label: 'アクティビティログ' })}
                >
                  アクティビティログ
                </a>
              </>
            )}
          </div>

          {/* テーマ */}
          <div className="pt-2 mt-2 border-t border-[var(--border-subtle)]">
            <p className="text-xs text-[var(--text-tertiary)] font-medium uppercase tracking-wide mb-2">テーマ</p>
            <ThemeToggle />
          </div>

          {/* アカウント */}
          {user && (
            <div className="pt-2 mt-2 border-t border-[var(--border-subtle)] space-y-1">
              <div>
                <p className="text-sm text-[var(--text-primary)] font-medium">{user.name || user.email}</p>
                {user.organizationName && (
                  <p className="text-xs text-[var(--text-tertiary)] mt-0.5">{user.organizationName}</p>
                )}
              </div>
              <button onClick={logout} className="block py-2 text-sm text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 font-medium">
                ログアウト
              </button>
            </div>
          )}
        </div>
      )}
    </nav>
  );
}
