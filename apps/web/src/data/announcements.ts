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
    id: '2026-04-jpcert-integration',
    title: '🛡️ JPCERT/CC連動による脅威検知機能をリリース（Pro以上）',
    description:
      'インシデント対応の中核機関であるJPCERT/CCが観測したフィッシングURLデータと連動し、お客様のブランドを騙ったサイトを自動検知・通知します。無料診断・リスクスコア・ブランド観測履歴・学習型パターン検知の4機能を同時追加。新機能の詳細は各ページに順次表示されるお知らせをご確認ください。',
    date: '2026-04-15',
    priority: 'high',
    targetPage: null,
  },
  {
    id: '2026-04-jpcert-alert',
    title: 'JPCERT/CC連動アラートを追加',
    description:
      '登録ブランドを騙ったフィッシングURLがJPCERT/CCの公開フィードに観測されると、通常のアラート（メール / Slack）で自動通知します。フィードは毎日03:00（JST）で自動更新されます。',
    date: '2026-04-15',
    priority: 'medium',
    targetPage: '/alerts',
  },
  {
    id: '2026-04-brand-attack-intelligence',
    title: 'ブランド別の攻撃インテリジェンスを追加',
    description:
      'ブランド詳細ページで、過去にあなたのブランドを騙ったフィッシングURLの全履歴、月次観測推移、悪用TLD分布、URLパス傾向、偽装ブランド名バリアントを可視化できるようになりました。',
    date: '2026-04-15',
    priority: 'medium',
    targetPage: '/brands',
  },
  {
    id: '2026-04-diagnosis-accuracy',
    title: '無料診断・リスクスコアの精度が向上',
    description:
      '既知のフィッシングURLデータベースとの照合により、無料診断は一致時に即時判定、リスクスコアは観測済みドメインで+30点ブースト。さらにJPCERTコーパスから機械的に学習した検知パターンで未観測ドメインの判定精度も向上しました。',
    date: '2026-04-15',
    priority: 'low',
    targetPage: null,
  },
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
