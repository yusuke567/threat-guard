'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { getThreat, generateTakedown } from '@/lib/api';
import { RiskBadgeFull } from '@/components/RiskBadge';

const statusColors: Record<string, string> = {
  new_domain: 'bg-blue-100 text-blue-800',
  analyzing: 'bg-yellow-100 text-yellow-800',
  confirmed_threat: 'bg-red-100 text-red-800',
  false_positive: 'bg-gray-100 text-gray-800',
  takedown_sent: 'bg-orange-100 text-orange-800',
  resolved: 'bg-green-100 text-green-800',
};

const categoryLabels: Record<string, string> = {
  phishing: '🎣 フィッシング',
  brand_abuse: '⚠️ ブランド悪用',
  parked: '🅿️ パーク',
  legitimate: '✅ 正規',
  unknown: '❓ 不明',
};

export default function ThreatDetailPage() {
  const params = useParams();
  const [threat, setThreat] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (params.id) {
      getThreat(params.id as string)
        .then(setThreat)
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [params.id]);

  const handleTakedown = async () => {
    if (!threat) return;
    setGenerating(true);
    try {
      await generateTakedown(threat.id);
      // Reload threat data
      const updated = await getThreat(threat.id);
      setThreat(updated);
    } catch (e) {
      console.error(e);
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!threat) {
    return <div className="text-center py-20 text-gray-500">脅威が見つかりません</div>;
  }

  const latestAnalysis = threat.analyses?.[0];
  const riskScore = threat.riskScore ?? 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <a href="/threats" className="text-blue-600 hover:text-blue-700 text-sm">← 脅威一覧</a>
        <h1 className="text-2xl font-bold text-gray-900 mt-2 font-mono">{threat.domain}</h1>
        <p className="text-gray-500 mt-1">
          ブランド: {threat.brand?.name} ({threat.brand?.domain})
        </p>
      </div>

      {/* Risk Score with Action */}
      <RiskBadgeFull score={threat.riskScore} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Domain Info */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-bold mb-4">ドメイン情報</h2>
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-gray-500">ステータス</dt>
                <dd className="mt-1">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[threat.status] || 'bg-gray-100'}`}>
                    {threat.status}
                  </span>
                </dd>
              </div>
              <div>
                <dt className="text-gray-500">検知元</dt>
                <dd className="mt-1 font-medium">{threat.source}</dd>
              </div>
              <div>
                <dt className="text-gray-500">初回検知</dt>
                <dd className="mt-1">{new Date(threat.firstSeen).toLocaleString('ja-JP')}</dd>
              </div>
              <div>
                <dt className="text-gray-500">最終確認</dt>
                <dd className="mt-1">{new Date(threat.lastSeen).toLocaleString('ja-JP')}</dd>
              </div>
            </dl>
          </div>

          {/* Analysis */}
          {latestAnalysis && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-lg font-bold mb-4">AI分析結果</h2>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{categoryLabels[latestAnalysis.category]?.split(' ')[0]}</span>
                  <div>
                    <div className="font-medium">
                      {categoryLabels[latestAnalysis.category] || latestAnalysis.category}
                    </div>
                    <div className="text-sm text-gray-500">
                      信頼度: {Math.round(latestAnalysis.confidence * 100)}%
                    </div>
                  </div>
                </div>
                <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-4">
                  {latestAnalysis.reasoning}
                </p>
              </div>
            </div>
          )}

          {/* Takedowns */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">テイクダウン申請</h2>
              <button
                onClick={handleTakedown}
                disabled={generating}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 text-sm font-medium"
              >
                {generating ? '生成中...' : '📝 テイクダウン申請を生成'}
              </button>
            </div>
            {threat.takedowns?.length > 0 ? (
              <div className="space-y-4">
                {threat.takedowns.map((td: any) => (
                  <div key={td.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">レジストラ: {td.registrar}</span>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        td.status === 'draft' ? 'bg-gray-100 text-gray-800' :
                        td.status === 'sent' ? 'bg-blue-100 text-blue-800' :
                        td.status === 'completed' ? 'bg-green-100 text-green-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {td.status}
                      </span>
                    </div>
                    <pre className="text-xs text-gray-600 bg-gray-50 rounded p-3 overflow-x-auto whitespace-pre-wrap max-h-60">
                      {td.template}
                    </pre>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-sm">まだテイクダウン申請がありません</p>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Screenshot */}
          {threat.screenshotUrl && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-sm font-bold mb-3">スクリーンショット</h3>
              <img src={threat.screenshotUrl} alt="Screenshot" className="rounded-lg border" />
            </div>
          )}

          {/* WHOIS */}
          {threat.whoisData && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-sm font-bold mb-3">WHOIS情報</h3>
              <pre className="text-xs text-gray-600 overflow-x-auto">
                {JSON.stringify(threat.whoisData, null, 2)}
              </pre>
            </div>
          )}

          {/* SSL */}
          {threat.sslInfo && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-sm font-bold mb-3">SSL情報</h3>
              <pre className="text-xs text-gray-600 overflow-x-auto">
                {JSON.stringify(threat.sslInfo, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
