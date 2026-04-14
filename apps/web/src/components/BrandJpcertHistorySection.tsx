'use client';

import { useEffect, useState } from 'react';
import { Card, Icon } from './ui';
import { ProFeatureLock } from './ProFeatureLock';
import { getBrandJpcertHistory, type BrandJpcertHistoryDto } from '@/lib/api';

interface Props {
  brandId: string;
}

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString('ja-JP', { year: 'numeric', month: 'short', day: 'numeric' });
}

/**
 * ブランド詳細ページに表示するJPCERT/CC観測履歴セクション。
 * - Pro+: 詳細URL一覧 + 騙られたブランド名の集計
 * - Starter: 件数表示 + アップセル
 */
export function BrandJpcertHistorySection({ brandId }: Props) {
  const [data, setData] = useState<BrandJpcertHistoryDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getBrandJpcertHistory(brandId)
      .then((d) => { if (!cancelled) setData(d); })
      .catch((e: any) => { if (!cancelled) setError(e?.message || '取得に失敗しました'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [brandId]);

  if (loading) {
    return (
      <Card className="space-y-3">
        <div className="h-6 w-56 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
        <div className="h-24 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <p className="text-sm text-red-600 dark:text-red-400">JPCERT観測履歴の取得に失敗しました: {error}</p>
      </Card>
    );
  }

  if (!data) return null;

  // データなし
  if (data.totalCount === 0) {
    return (
      <Card className="space-y-2">
        <h2 className="text-lg font-bold text-[var(--text-primary)] flex items-center gap-2">
          <Icon name="shield" size={20} className="text-brand-600" />
          JPCERT/CC観測履歴
        </h2>
        <p className="text-sm text-[var(--text-secondary)]">
          このブランドを騙ったフィッシングURLはJPCERT/CCの公開フィードに観測されていません。
        </p>
        <p className="text-xs text-[var(--text-tertiary)]">
          ヒント: ブランドの「キーワード」設定を充実させると、より幅広く照合されます。
        </p>
      </Card>
    );
  }

  // Starter: ロックUI（件数のみ表示してアップセル）
  if (!data.isPro) {
    return (
      <div className="space-y-3">
        <Card>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-bold text-[var(--text-primary)] flex items-center gap-2">
              <Icon name="shield" size={20} className="text-brand-600" />
              JPCERT/CC観測履歴
            </h2>
            <span className="px-3 py-1 rounded-full text-sm font-bold bg-orange-50 text-orange-700 border border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800">
              {data.totalCount.toLocaleString()} 件の観測実績
            </span>
          </div>
          <p className="text-sm text-[var(--text-secondary)]">
            JPCERT/CC が観測したフィッシングURLのうち、このブランドを騙ったものが {data.totalCount.toLocaleString()} 件確認されています。
          </p>
        </Card>
        <ProFeatureLock
          featureName="JPCERT/CC観測履歴の詳細表示"
          description="個別のフィッシングURL・観測日時・騙られたブランド名の内訳を閲覧でき、新規観測時には自動でアラートが発報されます。"
          requiredPlan="Professional"
        />
      </div>
    );
  }

  // Pro+: 詳細表示
  const items = data.items ?? [];
  const visible = showAll ? items : items.slice(0, 10);

  return (
    <Card className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-[var(--text-primary)] flex items-center gap-2">
          <Icon name="shield" size={20} className="text-brand-600" />
          JPCERT/CC観測履歴
          <span className="text-sm font-normal text-[var(--text-secondary)]">
            （{data.totalCount.toLocaleString()}件 / 最大200件表示）
          </span>
        </h2>
        <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300">
          Pro機能
        </span>
      </div>

      {/* 騙られたブランド名の内訳 */}
      {data.topBrandLabels.length > 0 && (
        <div>
          <h3 className="text-xs uppercase tracking-wide font-semibold text-[var(--text-secondary)] mb-2">
            JPCERT記録上の騙られたブランド名（上位5件）
          </h3>
          <div className="flex flex-wrap gap-2">
            {data.topBrandLabels.map((b) => (
              <span
                key={b.label}
                className="px-2 py-1 rounded-full text-xs bg-gray-100 dark:bg-gray-800 text-[var(--text-primary)] border border-[var(--border-default)]"
              >
                {b.label} <span className="font-bold">{b.count}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* URL一覧 */}
      <div>
        <h3 className="text-xs uppercase tracking-wide font-semibold text-[var(--text-secondary)] mb-2">
          観測URL一覧（新しい順）
        </h3>
        <div className="overflow-x-auto rounded-lg border border-[var(--border-default)]">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 dark:bg-gray-800 text-[var(--text-secondary)] uppercase tracking-wide">
              <tr>
                <th className="text-left px-3 py-2 font-medium">観測日</th>
                <th className="text-left px-3 py-2 font-medium">ドメイン</th>
                <th className="text-left px-3 py-2 font-medium">URL</th>
                <th className="text-left px-3 py-2 font-medium">JPCERT記録ブランド</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]">
              {visible.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="px-3 py-2 text-[var(--text-secondary)] whitespace-nowrap">
                    {formatDate(u.observedAt)}
                  </td>
                  <td className="px-3 py-2 text-[var(--text-primary)] font-mono">{u.domain}</td>
                  <td className="px-3 py-2 text-[var(--text-secondary)]">
                    <span className="block max-w-md truncate" title={u.url}>{u.url}</span>
                  </td>
                  <td className="px-3 py-2 text-[var(--text-secondary)]">{u.brandLabel}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {items.length > 10 && (
          <button
            onClick={() => setShowAll(!showAll)}
            className="mt-2 text-sm text-brand-600 hover:text-brand-700 dark:text-brand-500 font-medium"
          >
            {showAll ? '▲ 折りたたむ' : `▼ もっと見る（残り ${items.length - 10}件）`}
          </button>
        )}
      </div>

      <p className="text-xs text-[var(--text-tertiary)]">
        出典: JPCERT/CC phishurl-list（過去観測されたフィッシングURL公開リスト）
      </p>
    </Card>
  );
}
