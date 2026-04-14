'use client';

import { usePlan } from '@/lib/usePlan';
import { Card, Icon } from './ui';
import { ProFeatureLock } from './ProFeatureLock';

const FEATURE_DESC =
  'JPCERT/CC（インシデント対応の中核機関）が観測した過去のフィッシングURLが、お客様の登録ブランドを騙ったものであった場合、自動で脅威として登録し、通常のアラート（メール / Slack）でお知らせします。';

/**
 * /alerts ページに表示する「JPCERT/CC連動アラート」セクション。
 * Pro+: 有効状態の説明カード
 * Starter: ロックUI（アップセル）
 */
export function JpcertAlertCard() {
  const { isPro, loading } = usePlan();

  if (loading) {
    return (
      <Card className="space-y-4">
        <div className="h-6 w-48 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
        <div className="h-20 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
      </Card>
    );
  }

  if (!isPro) {
    return (
      <ProFeatureLock
        featureName="JPCERT/CC連動アラート"
        description={FEATURE_DESC}
        requiredPlan="Professional"
      />
    );
  }

  return (
    <Card className="space-y-3">
      <div className="flex items-center gap-2">
        <h2 className="text-lg font-bold text-[var(--text-primary)]">JPCERT/CC連動アラート</h2>
        <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300">
          有効
        </span>
      </div>
      <p className="text-sm text-[var(--text-secondary)]">{FEATURE_DESC}</p>
      <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
        <Icon name="lightbulb" size={18} className="text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-blue-700 dark:text-blue-300">
          フィードは日次（毎日03:00 JST）で自動更新されます。該当があった場合のみ既存の通知設定（上記）に従ってアラートが届きます。
        </p>
      </div>
    </Card>
  );
}
