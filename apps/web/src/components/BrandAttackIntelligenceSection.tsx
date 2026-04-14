'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { Card, Icon } from './ui';
import { ProFeatureLock } from './ProFeatureLock';
import { getBrandAttackIntelligence, type BrandAttackIntelligenceDto } from '@/lib/api';

const BarChart = dynamic(() => import('recharts').then((m) => m.BarChart), { ssr: false });
const Bar = dynamic(() => import('recharts').then((m) => m.Bar), { ssr: false });
const XAxis = dynamic(() => import('recharts').then((m) => m.XAxis), { ssr: false });
const YAxis = dynamic(() => import('recharts').then((m) => m.YAxis), { ssr: false });
const CartesianGrid = dynamic(() => import('recharts').then((m) => m.CartesianGrid), { ssr: false });
const ResponsiveContainer = dynamic(() => import('recharts').then((m) => m.ResponsiveContainer), { ssr: false });
const RTooltip = dynamic(() => import('recharts').then((m) => m.Tooltip), { ssr: false });

interface Props {
  brandId: string;
}

function formatMonthLabel(yyyyMM: string): string {
  // "2025-04" -> "25/4月"
  const [y, m] = yyyyMM.split('-');
  return `${y.slice(2)}/${parseInt(m, 10)}月`;
}

/**
 * Layer 3: ブランド別「攻撃インテリジェンス」パネル。
 * 月次推移・TLD分布・パスパターン・偽装ブランド名バリアント・ピーク月を可視化。
 * Pro+: 完全表示 / Starter: 件数 + アップセル。
 */
export function BrandAttackIntelligenceSection({ brandId }: Props) {
  const [data, setData] = useState<BrandAttackIntelligenceDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getBrandAttackIntelligence(brandId)
      .then((d) => { if (!cancelled) setData(d); })
      .catch((e: any) => { if (!cancelled) setError(e?.message || '取得に失敗しました'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [brandId]);

  if (loading) {
    return (
      <Card className="space-y-3">
        <div className="h-6 w-64 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
        <div className="h-48 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <p className="text-sm text-red-600 dark:text-red-400">攻撃インテリジェンスの取得に失敗しました: {error}</p>
      </Card>
    );
  }

  if (!data) return null;

  // データなし
  if (data.totalCount === 0) {
    return null; // jpcert-historyセクションと重複するので、データなし時は表示しない
  }

  // Starter: ロックUI
  if (!data.isPro) {
    return (
      <div className="space-y-3">
        <Card>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-bold text-[var(--text-primary)] flex items-center gap-2">
              <Icon name="chart" size={20} className="text-brand-600" />
              攻撃インテリジェンス
            </h2>
            <span className="px-3 py-1 rounded-full text-sm font-bold bg-orange-50 text-orange-700 border border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800">
              全期間 {data.totalCount.toLocaleString()} 件 / 直近30日 {data.recent30dCount.toLocaleString()} 件
            </span>
          </div>
          <p className="text-sm text-[var(--text-secondary)]">
            このブランドに対する観測攻撃の月次推移・TLD分布・パスパターン・偽装ブランド名を可視化します。
          </p>
        </Card>
        <ProFeatureLock
          featureName="攻撃インテリジェンス分析"
          description="観測データを月次タイムライン・TLD分布・URLパス傾向・偽装ブランド名バリアントとして可視化し、攻撃傾向とピーク時期を特定できます。"
          requiredPlan="Professional"
        />
      </div>
    );
  }

  // Pro+: 詳細表示
  const maxTimelineCount = Math.max(...data.monthlyTimeline.map((m) => m.count), 1);

  return (
    <Card className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-lg font-bold text-[var(--text-primary)] flex items-center gap-2">
          <Icon name="chart" size={20} className="text-brand-600" />
          攻撃インテリジェンス
        </h2>
        <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300">
          Pro機能
        </span>
      </div>

      {/* サマリ */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800 border border-[var(--border-default)]">
          <div className="text-xs text-[var(--text-secondary)] mb-1">全期間観測</div>
          <div className="text-xl font-bold text-[var(--text-primary)]">{data.totalCount.toLocaleString()} <span className="text-sm font-normal">件</span></div>
        </div>
        <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800 border border-[var(--border-default)]">
          <div className="text-xs text-[var(--text-secondary)] mb-1">直近30日</div>
          <div className="text-xl font-bold text-[var(--text-primary)]">{data.recent30dCount.toLocaleString()} <span className="text-sm font-normal">件</span></div>
        </div>
        <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800 border border-[var(--border-default)]">
          <div className="text-xs text-[var(--text-secondary)] mb-1">ピーク月</div>
          <div className="text-xl font-bold text-[var(--text-primary)]">
            {data.peakMonth ? (
              <>
                {formatMonthLabel(data.peakMonth.month)}
                <span className="text-sm font-normal text-[var(--text-secondary)]"> ({data.peakMonth.count}件)</span>
              </>
            ) : '—'}
          </div>
        </div>
        <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800 border border-[var(--border-default)]">
          <div className="text-xs text-[var(--text-secondary)] mb-1">別名バリアント</div>
          <div className="text-xl font-bold text-[var(--text-primary)]">{data.brandLabelVariants.length} <span className="text-sm font-normal">種</span></div>
        </div>
      </div>

      {/* 月次タイムライン */}
      <div>
        <h3 className="text-xs uppercase tracking-wide font-semibold text-[var(--text-secondary)] mb-2">
          月次観測推移（過去24ヶ月）
        </h3>
        <div className="h-48 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.monthlyTimeline}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 10, fill: 'var(--text-secondary)' }}
                tickFormatter={formatMonthLabel}
                interval={1}
              />
              <YAxis tick={{ fontSize: 10, fill: 'var(--text-secondary)' }} allowDecimals={false} />
              <RTooltip
                contentStyle={{
                  backgroundColor: 'var(--bg-elevated)',
                  border: '1px solid var(--border-default)',
                  borderRadius: 8,
                  fontSize: 12,
                }}
                labelFormatter={(v: any) => formatMonthLabel(String(v))}
                formatter={(v: any) => [`${Number(v)} 件`, '観測数']}
              />
              <Bar dataKey="count" fill="#ea580c" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* TLD分布 */}
        <div>
          <h3 className="text-xs uppercase tracking-wide font-semibold text-[var(--text-secondary)] mb-2">
            悪用TLD分布（上位10）
          </h3>
          <div className="space-y-1.5">
            {data.topTlds.map((t) => (
              <div key={t.tld} className="flex items-center gap-2 text-xs">
                <div className="w-16 font-mono text-[var(--text-primary)]">{t.tld}</div>
                <div className="flex-1 h-3 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-orange-400 dark:bg-orange-600 rounded-full"
                    style={{ width: `${Math.max(t.percentage, 2)}%` }}
                  />
                </div>
                <div className="w-20 text-right text-[var(--text-secondary)] tabular-nums">
                  {t.count}件 ({t.percentage}%)
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* パスパターン */}
        <div>
          <h3 className="text-xs uppercase tracking-wide font-semibold text-[var(--text-secondary)] mb-2">
            URLパス傾向（上位10）
          </h3>
          <div className="space-y-1.5">
            {data.commonPathPatterns.map((p) => (
              <div key={p.pattern} className="flex items-center gap-2 text-xs">
                <div className="flex-1 font-mono text-[var(--text-primary)] truncate" title={p.pattern}>
                  {p.pattern}
                </div>
                <div className="text-[var(--text-secondary)] tabular-nums">{p.count}件</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 偽装ブランド名バリアント */}
      {data.brandLabelVariants.length > 0 && (
        <div>
          <h3 className="text-xs uppercase tracking-wide font-semibold text-[var(--text-secondary)] mb-2">
            JPCERT記録上の偽装ブランド名バリアント（上位10）
          </h3>
          <div className="flex flex-wrap gap-2">
            {data.brandLabelVariants.map((v) => (
              <span
                key={v.label}
                className="px-2 py-1 rounded-full text-xs bg-gray-100 dark:bg-gray-800 text-[var(--text-primary)] border border-[var(--border-default)]"
              >
                {v.label} <span className="font-bold">{v.count}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      <p className="text-xs text-[var(--text-tertiary)]">
        分析対象: JPCERT/CC phishurl-list で観測されたこのブランドを騙ったフィッシングURL全件
      </p>
    </Card>
  );
}
