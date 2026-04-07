'use client';

import { usePathname } from 'next/navigation';
import { useAnnouncements } from './AnnouncementProvider';
import Alert from '@/components/ui/Alert';
import type { Announcement } from '@/data/announcements';

const priorityToVariant = {
  high: 'warning',
  medium: 'info',
  low: 'info',
} as const;

function SpotlightAlert({ announcement }: { announcement: Announcement }) {
  const { dismiss } = useAnnouncements();

  return (
    <Alert variant={priorityToVariant[announcement.priority]} className="mb-4 animate-fade-in-up">
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm">{announcement.title}</p>
          <p className="text-sm mt-0.5 opacity-90">{announcement.description}</p>
        </div>
        <button
          onClick={() => dismiss(announcement.id)}
          className="shrink-0 p-1 opacity-60 hover:opacity-100 transition-opacity"
          aria-label="閉じる"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </Alert>
  );
}

export default function PageSpotlightAlerts() {
  const pathname = usePathname();
  const { spotlightAlerts } = useAnnouncements();
  const alerts = spotlightAlerts(pathname);

  if (alerts.length === 0) return null;

  return (
    <div className="mb-2">
      {alerts.map((a) => (
        <SpotlightAlert key={a.id} announcement={a} />
      ))}
    </div>
  );
}
