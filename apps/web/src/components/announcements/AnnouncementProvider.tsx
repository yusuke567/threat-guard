'use client';

import { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { announcements, type Announcement } from '@/data/announcements';

const READ_KEY = 'threatguard_announcements_read';
const DISMISSED_KEY = 'threatguard_announcements_dismissed';

const announcementIds = new Set(announcements.map((a) => a.id));

function loadFromStorage(key: string): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return new Set();
    const ids: string[] = JSON.parse(raw);
    return new Set(ids.filter((id) => announcementIds.has(id)));
  } catch {
    return new Set();
  }
}

function saveToStorage(key: string, ids: Set<string>) {
  const valid = [...ids].filter((id) => announcementIds.has(id));
  localStorage.setItem(key, JSON.stringify(valid));
}

interface AnnouncementContextValue {
  globalBanners: Announcement[];
  spotlightAlerts: (page: string) => Announcement[];
  allAnnouncements: Announcement[];
  unreadCount: number;
  dismiss: (id: string) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  isRead: (id: string) => boolean;
  isDismissed: (id: string) => boolean;
}

const AnnouncementContext = createContext<AnnouncementContextValue | null>(null);

export function useAnnouncements(): AnnouncementContextValue {
  const ctx = useContext(AnnouncementContext);
  if (!ctx) throw new Error('useAnnouncements must be used within AnnouncementProvider');
  return ctx;
}

export function AnnouncementProvider({ children }: { children: React.ReactNode }) {
  const [readIds, setReadIds] = useState<Set<string>>(() => loadFromStorage(READ_KEY));
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(() => loadFromStorage(DISMISSED_KEY));

  const dismiss = useCallback((id: string) => {
    setDismissedIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      saveToStorage(DISMISSED_KEY, next);
      return next;
    });
  }, []);

  const markRead = useCallback((id: string) => {
    setReadIds((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      saveToStorage(READ_KEY, next);
      return next;
    });
  }, []);

  const markAllRead = useCallback(() => {
    setReadIds(() => {
      const next = new Set(announcementIds);
      saveToStorage(READ_KEY, next);
      return next;
    });
  }, []);

  const isRead = useCallback((id: string) => readIds.has(id), [readIds]);
  const isDismissed = useCallback((id: string) => dismissedIds.has(id), [dismissedIds]);

  const globalBanners = useMemo(
    () =>
      announcements.filter(
        (a) => a.priority === 'high' && a.targetPage === null && !dismissedIds.has(a.id)
      ),
    [dismissedIds]
  );

  const spotlightAlerts = useCallback(
    (page: string) =>
      announcements.filter(
        (a) =>
          a.targetPage !== null &&
          (page === a.targetPage || page.startsWith(a.targetPage + '/')) &&
          !dismissedIds.has(a.id)
      ),
    [dismissedIds]
  );

  const unreadCount = useMemo(
    () => announcements.filter((a) => !readIds.has(a.id)).length,
    [readIds]
  );

  const value: AnnouncementContextValue = useMemo(
    () => ({
      globalBanners,
      spotlightAlerts,
      allAnnouncements: announcements,
      unreadCount,
      dismiss,
      markRead,
      markAllRead,
      isRead,
      isDismissed,
    }),
    [globalBanners, spotlightAlerts, unreadCount, dismiss, markRead, markAllRead, isRead, isDismissed]
  );

  return (
    <AnnouncementContext.Provider value={value}>
      {children}
    </AnnouncementContext.Provider>
  );
}
