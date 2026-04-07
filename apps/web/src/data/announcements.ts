export type AnnouncementPriority = 'high' | 'medium' | 'low';

export interface Announcement {
  id: string;
  title: string;
  description: string;
  date: string;
  priority: AnnouncementPriority;
  targetPage: string | null;
}

/**
 * お知らせデータ（新しい順に追加）
 *
 * 自動振り分けルール:
 *   priority=high + targetPage=null → グローバルバナー
 *   targetPage指定あり              → 該当ページにスポットライト表示
 *   すべて                          → What's New パネルに一覧表示
 */
export const announcements: Announcement[] = [
  {
    id: '2026-04-realtime-notification',
    title: 'リアルタイム通知機能を追加しました',
    description: 'SNS監視でリアルタイム通知が利用できるようになりました。アラート設定から有効にできます。',
    date: '2026-04-07',
    priority: 'high',
    targetPage: null,
  },
  {
    id: '2026-04-social-monitor-filter',
    title: 'SNS監視のフィルター機能を改善',
    description: 'キーワードの複合条件やプラットフォーム指定でのフィルタリングが可能になりました。',
    date: '2026-04-05',
    priority: 'medium',
    targetPage: '/social-monitor',
  },
  {
    id: '2026-04-report-export',
    title: 'レポートのエクスポート対応',
    description: 'レポートページからCSV・PDFでのエクスポートができるようになりました。',
    date: '2026-04-01',
    priority: 'low',
    targetPage: null,
  },
];
