'use client';

import { useAnnouncements } from './AnnouncementProvider';
import { Icon } from '@/components/ui';

export default function GlobalBanner() {
  const { globalBanners, dismiss } = useAnnouncements();

  const banner = globalBanners[0];
  if (!banner) return null;

  return (
    <div className="bg-brand-50 dark:bg-brand-900/30 border-b border-brand-200 dark:border-brand-800 animate-slide-down">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-start gap-3">
        <Icon name="lightbulb" size={20} className="text-brand-600 dark:text-brand-400 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-brand-800 dark:text-brand-200">
            {banner.title}
          </p>
          <p className="text-sm text-brand-700 dark:text-brand-300 mt-0.5">
            {banner.description}
          </p>
        </div>
        <button
          onClick={() => dismiss(banner.id)}
          className="shrink-0 p-1 text-brand-500 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-200 transition-colors"
          aria-label="閉じる"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
