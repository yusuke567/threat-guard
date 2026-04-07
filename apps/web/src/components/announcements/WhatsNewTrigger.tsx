'use client';

import { useState, useRef, useEffect } from 'react';
import { useAnnouncements } from './AnnouncementProvider';
import { Icon } from '@/components/ui';
import WhatsNewPanel from './WhatsNewPanel';

export default function WhatsNewTrigger() {
  const { unreadCount, markAllRead } = useAnnouncements();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleToggle = () => {
    const willOpen = !open;
    setOpen(willOpen);
    if (willOpen) markAllRead();
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={handleToggle}
        className="relative p-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
        aria-label="お知らせ"
      >
        <Icon name="bell" size={20} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold px-1 leading-none">
            {unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-surface-card border border-[var(--border-default)] rounded-lg shadow-lg z-50 animate-slide-down">
          <div className="px-4 py-3 border-b border-[var(--border-subtle)]">
            <p className="text-sm font-semibold text-[var(--text-primary)]">What&apos;s New</p>
          </div>
          <WhatsNewPanel />
        </div>
      )}
    </div>
  );
}
