'use client';

import Tooltip from './Tooltip';

interface RiskLevel {
  label: string;
  color: string;
  bgColor: string;
  barColor: string;
  action: string;
  actionLabel?: string;
  actionHref?: string;
}

function getRiskLevel(score: number): RiskLevel {
  if (score >= 80) return {
    label: '危険',
    color: 'text-red-700 dark:text-red-300',
    bgColor: 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800',
    barColor: 'bg-red-500',
    action: '即座に削除申請を送信してください。フィッシング被害が発生する前に、ドメインの停止が必要です。',
    actionLabel: '削除申請',
  };
  if (score >= 60) return {
    label: '高',
    color: 'text-orange-700 dark:text-orange-300',
    bgColor: 'bg-orange-50 dark:bg-orange-900/30 border-orange-200 dark:border-orange-800',
    barColor: 'bg-orange-500',
    action: '脅威の詳細を確認し、削除申請が必要か判断してください。偽サイトが稼働中の可能性があります。',
    actionLabel: '🔍 詳細を確認',
  };
  if (score >= 40) return {
    label: '中',
    color: 'text-yellow-700 dark:text-yellow-300',
    bgColor: 'bg-yellow-50 dark:bg-yellow-900/30 border-yellow-200 dark:border-yellow-800',
    barColor: 'bg-yellow-500',
    action: '現時点では監視を継続してください。状況が変わればリスクが上昇する可能性があります。',
    actionLabel: '監視継続',
  };
  return {
    label: '低',
    color: 'text-green-700 dark:text-green-300',
    bgColor: 'bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-800',
    barColor: 'bg-green-500',
    action: '現時点で対応は不要です。定期スキャンで自動的に監視されます。',
  };
}

// Compact version for tables
export function RiskBadgeCompact({ score, threatId }: { score: number | null; threatId?: string }) {
  if (score === null) return <span className="text-gray-400 dark:text-gray-500 text-sm">—</span>;

  const level = getRiskLevel(score);

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1.5 min-w-[80px]">
        <div className="w-16 h-2 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
          <div className={`h-full rounded-full ${level.barColor}`} style={{ width: `${score}%` }} />
        </div>
        <span className={`text-xs font-bold ${level.color}`}>{score}</span>
      </div>
      <span className={`px-1.5 py-0.5 rounded text-xs font-bold ${level.color} ${level.bgColor} border`}>
        {level.label}
      </span>
      {score >= 80 && threatId && (
        <a
          href={`/threats/${threatId}`}
          className="px-2 py-0.5 bg-red-600 text-white rounded text-xs font-medium hover:bg-red-700 whitespace-nowrap"
          onClick={(e) => e.stopPropagation()}
        >
          削除申請
        </a>
      )}
    </div>
  );
}

// Full version for detail pages
export function RiskBadgeFull({ score }: { score: number | null }) {
  if (score === null) return <span className="text-gray-400 dark:text-gray-500">未算出</span>;

  const level = getRiskLevel(score);

  return (
    <div className={`rounded-xl border p-5 ${level.bgColor}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className={`text-3xl font-bold ${level.color}`}>{score}</span>
          <span className={`px-2 py-1 rounded-lg text-sm font-bold ${level.color} bg-white dark:bg-gray-800/60`}>
            {level.label}
          </span>
        </div>
        <Tooltip content="リスクスコア（0〜100）はドメイン類似度（30%）・ドメイン年齢（20%）・SSL状態（15%）・脅威分類（25%）・コンテンツ類似度（10%）から自動算出されます。" />
      </div>

      {/* Progress bar */}
      <div className="w-full h-3 bg-white dark:bg-gray-800/60 rounded-full overflow-hidden mb-3">
        <div className={`h-full rounded-full transition-all ${level.barColor}`} style={{ width: `${score}%` }} />
      </div>

      {/* Recommended action */}
      <div className="bg-white dark:bg-gray-800/60 rounded-lg p-3">
        <p className="text-xs font-bold mb-1 opacity-75">💡 推奨アクション</p>
        <p className={`text-sm ${level.color}`}>{level.action}</p>
      </div>
    </div>
  );
}
