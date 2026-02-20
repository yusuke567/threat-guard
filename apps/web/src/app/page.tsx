'use client';

import { useEffect, useState } from 'react';
import StatCard from '@/components/StatCard';
import ThreatTable from '@/components/ThreatTable';
import Tooltip from '@/components/Tooltip';
import { getThreats } from '@/lib/api';

export default function Dashboard() {
  const [threats, setThreats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showGuide, setShowGuide] = useState(true);

  useEffect(() => {
    getThreats({ sortBy: 'riskScore', order: 'desc', pageSize: '100' })
      .then(setThreats)
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
        <p className="text-xs mt-2 text-red-500">APIサーバーが起動しているか確認してください</p>
      </div>
    );
  }

  const data = threats?.data || [];
  const danger = data.filter((t: any) => (t.riskScore ?? 0) >= 80).length;
  const high = data.filter((t: any) => { const s = t.riskScore ?? 0; return s >= 60 && s < 80; }).length;
  const medium = data.filter((t: any) => { const s = t.riskScore ?? 0; return s >= 40 && s < 60; }).length;
  const low = data.filter((t: any) => (t.riskScore ?? 0) < 40).length;

  return (
    <div className="space-y-8">
      {/* Welcome Guide */}
      {showGuide && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 relative">
          <button
            onClick={() => setShowGuide(false)}
            className="absolute top-3 right-3 text-blue-400 hover:text-blue-600 text-lg"
          >
            ✕
          </button>
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="🔴 危険"
          value={danger}
          icon="🚨"
          color="red"
          subtitle="即テイクダウン推奨"
          tooltip="リスクスコア80以上。フィッシングやブランド悪用の可能性が非常に高く、即座にテイクダウン申請の送信が必要です。"
        />
        <StatCard
          title="🟠 高"
          value={high}
          icon="⚠️"
          color="yellow"
          subtitle="要確認・テイクダウン検討"
          tooltip="リスクスコア60〜79。脅威の詳細を確認し、テイクダウンが必要か判断してください。"
        />
        <StatCard
          title="🟡 中"
          value={medium}
          icon="👁"
          color="blue"
          subtitle="監視継続"
          tooltip="リスクスコア40〜59。現時点では監視を継続してください。状況変化でリスクが上昇する可能性があります。"
        />
        <StatCard
          title="🟢 低"
          value={low}
          icon="✅"
          color="green"
          subtitle="対応不要"
          tooltip="リスクスコア39以下。現時点で対応は不要です。定期スキャンで自動監視されます。"
        />
      </div>

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
