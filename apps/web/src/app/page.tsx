'use client';

import { useEffect, useState } from 'react';
import StatCard from '@/components/StatCard';
import ThreatTable from '@/components/ThreatTable';
import Tooltip from '@/components/Tooltip';
import { getBrands, getScans, getThreats, triggerScan } from '@/lib/api';

export default function Dashboard() {
  const [threats, setThreats] = useState<any>(null);
  const [brand, setBrand] = useState<any>(null);
  const [lastScan, setLastScan] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    Promise.all([
      getThreats({ sortBy: 'riskScore', order: 'desc', pageSize: '200' }),
      getBrands().catch(() => []),
    ])
      .then(async ([threatData, brands]) => {
        setThreats(threatData);
        const firstBrand = brands[0];
        if (firstBrand) {
          setBrand(firstBrand);
          const scans = await getScans(firstBrand.id).catch(() => []);
          const completed = scans
            .filter((s: any) => s.status === 'completed')
            .sort((a: any, b: any) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime());
          if (completed[0]) setLastScan(completed[0]);
        }
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const handleScan = async () => {
    if (!brand || scanning) return;
    setScanning(true);
    try {
      await triggerScan(brand.id, 'ct_monitor');
    } catch {
      // ignore
    } finally {
      setScanning(false);
    }
  };

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
        <p className="text-xs mt-2 text-red-500">APIサーバーが起動しているか確認してください</p>
      </div>
    );
  }

  const data = threats?.data || [];
  const danger = data.filter((t: any) => (t.riskScore ?? 0) >= 80).length;
  const needsAction = data.filter((t: any) => { const s = t.riskScore ?? 0; return s >= 60 && s < 80; }).length;
  const takedownSent = data.filter((t: any) => t.status === 'takedown_sent').length;
  const resolved = data.filter((t: any) => t.status === 'resolved').length;
  const actionable = data.filter((t: any) => (t.riskScore ?? 0) >= 60);

  // Trend: threats per week for last 30 days
  const now = new Date();
  const weeks = Array.from({ length: 4 }, (_, i) => {
    const weekEnd = new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000);
    const weekStart = new Date(weekEnd.getTime() - 7 * 24 * 60 * 60 * 1000);
    const count = data.filter((t: any) => {
      const d = new Date(t.firstSeen);
      return d >= weekStart && d < weekEnd;
    }).length;
    const label = `${weekStart.getMonth() + 1}/${weekStart.getDate()}〜`;
    return { label, count };
  }).reverse();
  const maxCount = Math.max(...weeks.map((w) => w.count), 1);

  return (
    <div className="space-y-6">
      {/* Brand Summary */}
      {brand && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-2xl">🛡️</span>
                <h1 className="text-xl font-bold text-gray-900">{brand.name}</h1>
              </div>
              <p className="text-sm text-gray-500 mt-1 font-mono">{brand.domain}</p>
              <p className="text-xs text-gray-400 mt-1">
                最終スキャン: {lastScan
                  ? new Date(lastScan.completedAt).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                  : '未実行'}
              </p>
            </div>
            <button
              onClick={handleScan}
              disabled={scanning}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {scanning ? 'スキャン中...' : '🔍 今すぐスキャン'}
            </button>
          </div>
        </div>
      )}

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="🔴 危険"
          value={danger}
          icon="🚨"
          color="red"
          subtitle="即テイクダウン推奨"
          tooltip="リスクスコア80以上。即座にテイクダウン申請が必要です。"
        />
        <StatCard
          title="⚠️ 要対応"
          value={needsAction}
          icon="👁"
          color="yellow"
          subtitle="確認・テイクダウン検討"
          tooltip="リスクスコア60〜79。詳細を確認し、テイクダウンが必要か判断してください。"
        />
        <StatCard
          title="📨 テイクダウン済"
          value={takedownSent}
          icon="📤"
          color="blue"
          subtitle="申請送信済み"
          tooltip="テイクダウン申請が送信済みの脅威です。レジストラの対応を待っています。"
        />
        <StatCard
          title="✅ 解決済"
          value={resolved}
          icon="🎉"
          color="green"
          subtitle="対応完了"
          tooltip="テイクダウンが完了し、脅威が解決した件数です。"
        />
      </div>

      {/* Trend Chart */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <h2 className="text-lg font-bold text-gray-900">📈 検知トレンド</h2>
          <Tooltip content="過去4週間の脅威検知数の推移。増加傾向の場合はスキャン頻度の見直しを検討してください。" />
        </div>
        <div className="flex items-end gap-3 h-32">
          {weeks.map((week, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <span className="text-xs font-medium text-gray-700">{week.count}</span>
              <div
                className="w-full bg-blue-500 rounded-t-md transition-all"
                style={{ height: `${(week.count / maxCount) * 100}%`, minHeight: week.count > 0 ? '8px' : '2px' }}
              />
              <span className="text-xs text-gray-400">{week.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Actionable Threats */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-gray-900">⚡ 要対応の脅威</h2>
            <Tooltip content="リスクスコア60以上の脅威を表示。🔴危険 = 即テイクダウン、🟠高 = 要確認。" />
            <span className="text-sm text-gray-400">({actionable.length}件)</span>
          </div>
          <a href="/threats" className="text-blue-600 hover:text-blue-700 text-sm font-medium">
            すべて表示 →
          </a>
        </div>
        {actionable.length > 0 ? (
          <ThreatTable
            threats={actionable.slice(0, 10)}
            onSelect={(id) => window.location.href = `/threats/${id}`}
          />
        ) : (
          <div className="text-center py-8 text-gray-400">
            <p className="text-2xl mb-2">🎉</p>
            <p className="font-medium">要対応の脅威はありません</p>
            <p className="text-sm mt-1">すべての脅威は低〜中リスクです</p>
          </div>
        )}
      </div>
    </div>
  );
}
