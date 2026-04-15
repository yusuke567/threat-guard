'use client';

import { useState } from 'react';
import { useAnnouncements } from './AnnouncementProvider';
import type { AnnouncementPriority } from '@/data/announcements';

const priorityDot: Record<AnnouncementPriority, string> = {
  high: 'bg-red-500',
  medium: 'bg-yellow-500',
  low: 'bg-blue-400',
};

export default function WhatsNewPanel() {
  const { allAnnouncements, isRead } = useAnnouncements();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  if (allAnnouncements.length === 0) {
    return (
      <div className="p-6 text-center text-sm text-[var(--text-tertiary)]">
        お知らせはありません
      </div>
    );
  }

  const toggle = (id: string) =>
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));

  return (
    <div className="max-h-[60vh] overflow-y-auto">
      {allAnnouncements.map((a, i) => {
        const read = isRead(a.id);
        const isExpanded = expanded[a.id] ?? false;
        return (
          <div key={a.id}>
            {i > 0 && <div className="border-t border-[var(--border-subtle)]" />}
            <button
              type="button"
              onClick={() => toggle(a.id)}
              aria-expanded={isExpanded}
              className="w-full text-left px-4 py-3 hover:bg-surface-elevated transition-colors"
            >
              <div className="flex items-center gap-2 mb-1">
                <span className={`w-2 h-2 rounded-full shrink-0 ${priorityDot[a.priority]}`} />
                <span className="text-xs text-[var(--text-tertiary)]">{a.date}</span>
                {a.targetPage && (
                  <span className="text-xs text-brand-600 dark:text-brand-400">{a.targetPage}</span>
                )}
              </div>
              <p className={`text-sm ${read ? 'text-[var(--text-secondary)] font-normal' : 'text-[var(--text-primary)] font-semibold'}`}>
                {a.title}
              </p>
              <p
                className={`text-xs text-[var(--text-tertiary)] mt-0.5 whitespace-pre-wrap ${
                  isExpanded ? '' : 'line-clamp-2'
                }`}
              >
                {a.description}
              </p>
              <span className="text-[11px] text-brand-600 dark:text-brand-400 mt-1 inline-block">
                {isExpanded ? '閉じる' : 'もっと見る'}
              </span>
            </button>
          </div>
        );
      })}
    </div>
  );
}
