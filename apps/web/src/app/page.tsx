'use client';

import { useEffect, useState } from 'react';
import StatCard from '@/components/StatCard';
import ThreatTable from '@/components/ThreatTable';
import Tooltip from '@/components/Tooltip';
import { getThreats, getDashboardStats } from '@/lib/api';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, Tooltip as RTooltip,
} from 'recharts';

const RISK_COLORS = ['#dc2626', '#f59e0b', '#3b82f6', '#22c55e'];
const CATEGORY_COLORS: Record<string, string> = {
  phishing: '#dc2626',
  brand_abuse: '#f59e0b',
  parked: '#6b7280',
  legitimate: '#22c55e',
  unknown: '#a855f7',
};
const CATEGORY_LABELS: Record<string, string> = {
  phishing: 'フィッシング',
  brand_abuse: 'ブランド悪用',
  parked: 'パーク',
  legitimate: '正規',
  unknown: '不明',
};
const TAKEDOWN_LABELS: Record<string, string> = {
  draft: '下書き',
  sent: '送信済',
  acknowledged: '受領確認',
  completed: '完了',
  rejected: '却下',
};

export default function Dashboard() {
  const [threats, setThreats] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showGuide, setShowGuide] = useState(true);

  useEffect(() => {
    Promise.all([
      getThreats({ sortBy: 'riskScore', order: 'desc', pageSize: '100' }),
      getDashboardStats(),
    ])
      .then(([t, s]) => { setThreats(t); setStats(s); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
        <p className="font-medium">エラーが発生しました</p>
        <p className="text-sm mt-1">{error}</p>
      </div>
    );
  }

  const data = threats?.data || [];
  const rc = stats?.riskCounts || { danger: 0, high: 0, medium: 0, low: 0 };
  const totalTakedowns = Object.values(stats?.takedownStats || {}).reduce((a: number, b: any) => a + b, 0) as number;

  return (
    <div className="space-y-8">
      {/* Welcome Guide */}
      {showGuide && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 relative">
          <button onClick={() => setShowGuide(false)} className="absolute top-3 right-3 text-blue-400 hover:text-blue-600 text-lg">✕</button>
          <h2 className="font-bold text-blue-900 text-lg">🛡️ BrandShieldへようこそ</h2>
          <p className="text-blue-700 text-sm mt-2 leading-relaxed">
            このダッシュボードでブランドのなりすまし脅威を監視・管理できます。
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
            <div className="bg-white/60 rounded-lg p-3">
              <p className="font-bold text-blue-900 text-sm">① ブランドを登録</p>
              <p className="text-blue-700 text-xs mt-1">「ブランド管理」から監視したいブランドとドメインを登録</p>
            </div>
            <div className="bg-white/60 rounded-lg p-3">
              <p className="font-bold text-blue-900 text-sm">② スキャンを実行</p>
              <p className="text-blue-700 text-xs mt-1">CT監視や類似ドメインスキャンでなりすましを自動検知</p>
            </div>
            <div className="bg-white/60 rounded-lg p-3">
              <p className="font-bold text-blue-900 text-sm">③ 脅威に対応</p>
              <p className="text-blue-700 text-xs mt-1">リスクレベルに応じてテイクダウン申請を生成・送信</p>
            </div>
          </div>
        </div>
      )}

      <div>
        <h1 className="text-2xl font-bold text-gray-900">ダッシュボード</h1>
        <p className="text-gray-500 mt-1">ブランド保護状況の概要</p>
      </div>

      {/* Risk Level Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="🔴 危険" value={rc.danger} icon="🚨" color="red" subtitle="即テイクダウン推奨"
          tooltip="リスクスコア80以上。即座にテイクダウン申請が必要です。" />
        <StatCard title="🟠 高" value={rc.high} icon="⚠️" color="yellow" subtitle="要確認・テイクダウン検討"
          tooltip="リスクスコア60〜79。テイクダウンが必要か判断してください。" />
        <StatCard title="🟡 中" value={rc.medium} icon="👁" color="blue" subtitle="監視継続"
          tooltip="リスクスコア40〜59。監視を継続してください。" />
        <StatCard title="🟢 低" value={rc.low} icon="✅" color="green" subtitle="対応不要"
          tooltip="リスクスコア39以下。対応は不要です。" />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Threat Timeline */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">📈 脅威検知トレンド</h2>
          {stats?.timelineData?.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={stats.timelineData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(v: string) => v.slice(5)} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <RTooltip formatter={(v: any) => [`${v}件`, '検知数']} labelFormatter={(l: any) => l} />
                <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-gray-400 text-sm py-10 text-center">データがありません</p>
          )}
        </div>

        {/* Category Breakdown */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">🏷️ 脅威カテゴリ</h2>
          {stats?.categoryBreakdown?.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={stats.categoryBreakdown.map((c: any) => ({
                    name: CATEGORY_LABELS[c.category] || c.category,
                    value: c.count,
                    fill: CATEGORY_COLORS[c.category] || '#6b7280',
                  }))}
                  cx="50%" cy="50%"
                  innerRadius={50} outerRadius={80}
                  dataKey="value"
                  label={({ name, value }: any) => `${name}: ${value}`}
                  labelLine={false}
                >
                  {stats.categoryBreakdown.map((c: any, i: number) => (
                    <Cell key={i} fill={CATEGORY_COLORS[c.category] || '#6b7280'} />
                  ))}
                </Pie>
                <Legend verticalAlign="bottom" height={36} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-gray-400 text-sm py-10 text-center">データがありません</p>
          )}
        </div>
      </div>

      {/* Brand Breakdown + Takedown Progress */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Brand Breakdown */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">🏢 ブランド別脅威</h2>
          <div className="space-y-3">
            {(stats?.brandBreakdown || []).map((b: any) => {
              const maxCount = Math.max(...(stats?.brandBreakdown || []).map((x: any) => x.count), 1);
              return (
                <div key={b.name}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium text-gray-700">{b.name}</span>
                    <span className="text-gray-500">{b.count}件</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2.5">
                    <div
                      className="bg-blue-600 h-2.5 rounded-full transition-all"
                      style={{ width: `${(b.count / maxCount) * 100}%` }}
                    />
                  </div>
                </div>
              );
            })}
            {!(stats?.brandBreakdown?.length) && (
              <p className="text-gray-400 text-sm text-center py-4">ブランド未登録</p>
            )}
          </div>
        </div>

        {/* Takedown Progress */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">📋 テイクダウン進捗</h2>
          {totalTakedowns > 0 ? (
            <div className="space-y-3">
              {Object.entries(stats.takedownStats).map(([status, count]: [string, any]) => (
                <div key={status} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${
                      status === 'completed' ? 'bg-green-500' :
                      status === 'sent' ? 'bg-blue-500' :
                      status === 'draft' ? 'bg-gray-400' :
                      status === 'rejected' ? 'bg-red-500' :
                      'bg-yellow-500'
                    }`} />
                    <span className="text-sm text-gray-700">{TAKEDOWN_LABELS[status] || status}</span>
                  </div>
                  <span className="text-sm font-bold text-gray-900">{count}件</span>
                </div>
              ))}
              <div className="border-t pt-3 mt-3 flex justify-between">
                <span className="text-sm font-medium text-gray-600">合計</span>
                <span className="text-sm font-bold text-gray-900">{totalTakedowns}件</span>
              </div>
            </div>
          ) : (
            <div className="text-center py-6">
              <p className="text-gray-400 text-sm">テイクダウン申請はまだありません</p>
              <p className="text-gray-300 text-xs mt-1">脅威詳細から申請を作成できます</p>
            </div>
          )}
        </div>
      </div>

      {/* Recent Site Changes */}
      {stats?.recentChanges?.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">🔄 直近のサイト変化</h2>
          <div className="space-y-3">
            {stats.recentChanges.map((c: any, i: number) => (
              <div key={i} className="flex items-start gap-3 text-sm border-b border-gray-100 pb-3 last:border-0">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-medium text-gray-900">{c.domain}</span>
                    <span className="text-xs text-gray-400">{c.brandName}</span>
                  </div>
                  <p className="text-gray-600 mt-0.5">{c.change}</p>
                </div>
                <span className="text-xs text-gray-400 whitespace-nowrap">
                  {new Date(c.detectedAt).toLocaleString('ja-JP', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Threat Table */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-gray-900">検知された脅威</h2>
            <Tooltip content="リスクスコアが高い順に表示。🔴危険 = 即テイクダウン、🟠高 = 要確認、🟡中 = 監視継続、🟢低 = 対応不要。" />
          </div>
          <a href="/threats" className="text-blue-600 hover:text-blue-700 text-sm font-medium">
            すべて表示 →
          </a>
        </div>
        <ThreatTable
          threats={data.slice(0, 10)}
          onSelect={(id) => window.location.href = `/threats/${id}`}
        />
      </div>
    </div>
  );
}
