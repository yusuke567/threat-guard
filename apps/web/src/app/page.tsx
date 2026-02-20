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
    getThreats({ sortBy: 'riskScore', order: 'desc', pageSize: '10' })
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
        <p className="text-xs mt-2 text-red-500">APIサーバー (localhost:3001) が起動しているか確認してください</p>
      </div>
    );
  }

  const data = threats?.data || [];
  const total = threats?.total || 0;
  const critical = data.filter((t: any) => (t.riskScore ?? 0) >= 80).length;
  const pending = data.filter((t: any) => t.status === 'confirmed_threat').length;
  const resolved = data.filter((t: any) => t.status === 'resolved').length;

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
              <p className="text-blue-700 text-xs mt-1">AI分析結果を確認し、ワンクリックでテイクダウン申請を生成</p>
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
          title="検知脅威数"
          value={total}
          icon="🔍"
          color="blue"
          subtitle="全期間"
          tooltip="CT Logs監視や類似ドメイン生成アルゴリズムによって検知された、ブランドになりすましている可能性のあるドメインの総数です。誤検知を含む場合があります。"
        />
        <StatCard
          title="重大脅威"
          value={critical}
          icon="🚨"
          color="red"
          subtitle="リスクスコア 80+"
          tooltip="リスクスコアが80以上の脅威です。フィッシングやブランド悪用の可能性が高く、早急な対応が推奨されます。スコアはドメイン類似度・年齢・SSL状態・AI分類から算出されます。"
        />
        <StatCard
          title="要対応"
          value={pending}
          icon="⚡"
          color="yellow"
          subtitle="テイクダウン待ち"
          tooltip="AI分析で脅威が確認され、まだテイクダウン申請が送信されていないドメインの数です。「脅威一覧」から個別にテイクダウン申請を生成できます。"
        />
        <StatCard
          title="解決済"
          value={resolved}
          icon="✅"
          color="green"
          subtitle="今月"
          tooltip="テイクダウンが完了し、脅威が解決されたドメインの数です。ドメインの停止やコンテンツの削除が確認されたものが含まれます。"
        />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-gray-900">最新の脅威</h2>
            <Tooltip content="リスクスコアが高い順に最新の脅威を表示しています。リスクスコアは0〜100で、ドメイン類似度（30%）・ドメイン年齢（20%）・SSL状態（15%）・AI脅威分類（25%）・コンテンツ類似度（10%）から算出されます。" />
          </div>
          <a href="/threats" className="text-blue-600 hover:text-blue-700 text-sm font-medium">
            すべて表示 →
          </a>
        </div>
        <ThreatTable
          threats={data}
          onSelect={(id) => window.location.href = `/threats/${id}`}
        />
      </div>
    </div>
  );
}
