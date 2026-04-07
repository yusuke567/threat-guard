'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from './AuthProvider';
import ThemeToggle from './ThemeToggle';
import { Icon } from './ui';

interface NavItem {
  href: string;
  label: string;
  match?: string[];
}

const NAV_ITEMS: NavItem[] = [
  { href: '/', label: '脅威一覧', match: ['/', '/threats'] },
  { href: '/social-monitor', label: 'SNS監視' },
  { href: '/takedowns', label: '削除申請', match: ['/takedowns', '/takedown-request'] },
  { href: '/brands', label: 'ブランド管理' },
  { href: '/reports', label: 'レポート' },
  { href: '/alerts', label: '設定' },
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
  const [open, setOpen] = useState(false);
  const isSuperAdmin = user?.role === 'superadmin';

  const desktopLinkClass = (item: NavItem) =>
    isActive(pathname, item)
      ? 'text-brand-600 dark:text-brand-400 font-semibold text-sm transition-colors'
      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] font-medium text-sm transition-colors';

  const mobileLinkClass = (item: NavItem) =>
    isActive(pathname, item)
      ? 'block py-2 text-brand-600 dark:text-brand-400 font-semibold text-sm transition-colors'
      : 'block py-2 text-[var(--text-primary)] hover:text-brand-600 font-medium text-sm transition-colors';

  return (
    <nav className="bg-surface-card border-b border-[var(--border-default)] px-4 sm:px-6 py-3 sm:py-4">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <a href="/" className="flex items-center gap-2">
          <Icon name="shield" size={28} className="text-brand-600" />
          <span className="text-xl font-bold text-[var(--text-primary)]">ThreatGuard</span>
        </a>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-6">
          {NAV_ITEMS.map((item) => (
            <a key={item.href} href={item.href} className={desktopLinkClass(item)}>
              {item.label}
            </a>
          ))}
          {isSuperAdmin && (
            <>
              <span className="text-[var(--border-default)]">|</span>
              <a
                href="/admin/organizations"
                className={isActive(pathname, { href: '/admin/organizations', label: '' })
                  ? 'text-brand-600 dark:text-brand-400 font-semibold text-sm transition-colors'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] font-medium text-sm transition-colors'}
              >
                組織管理
              </a>
            </>
          )}
          <ThemeToggle />
          {user && (
            <div className="flex items-center gap-3 ml-4 pl-4 border-l border-[var(--border-default)]">
              {user.organizationName && (
                <span className="text-xs text-[var(--text-tertiary)] bg-surface-elevated px-2 py-0.5 rounded">{user.organizationName}</span>
              )}
              <span className="text-sm text-[var(--text-secondary)]">{user.name || user.email}</span>
              <button onClick={logout} className="text-sm text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 font-medium">
                ログアウト
              </button>
            </div>
          )}
        </div>

        {/* Mobile hamburger */}
        <button
          className="md:hidden p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
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
        <div className="md:hidden mt-3 pt-3 border-t border-[var(--border-default)] space-y-2 animate-slide-down overflow-hidden">
          {NAV_ITEMS.map((item) => (
            <a key={item.href} href={item.href} className={mobileLinkClass(item)}>
              {item.label}
            </a>
          ))}
          {isSuperAdmin && (
            <div className="pt-2 mt-2 border-t border-[var(--border-subtle)] space-y-2">
              <p className="text-xs text-[var(--text-tertiary)] font-medium uppercase tracking-wide">管理者メニュー</p>
              <a
                href="/admin/organizations"
                className={mobileLinkClass({ href: '/admin/organizations', label: '組織管理' })}
              >
                組織管理
              </a>
            </div>
          )}
          <div className="pt-2 mt-2 border-t border-[var(--border-subtle)]">
            <ThemeToggle />
          </div>
          {user && (
            <div className="pt-2 mt-2 border-t border-[var(--border-subtle)] space-y-1">
              {user.organizationName && (
                <span className="text-xs text-[var(--text-tertiary)] bg-surface-elevated px-2 py-0.5 rounded">{user.organizationName}</span>
              )}
              <div className="flex items-center justify-between">
                <span className="text-sm text-[var(--text-secondary)]">{user.name || user.email}</span>
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
