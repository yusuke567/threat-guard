'use client';

import Tooltip from './Tooltip';

interface Threat {
  id: string;
  domain: string;
  status: string;
  riskScore: number | null;
  firstSeen: string;
  brand: { name: string; domain: string };
  analyses: Array<{ category: string; confidence: number }>;
}

const statusColors: Record<string, string> = {
  new_domain: 'bg-blue-100 text-blue-800',
  analyzing: 'bg-yellow-100 text-yellow-800',
  confirmed_threat: 'bg-red-100 text-red-800',
  false_positive: 'bg-gray-100 text-gray-800',
  takedown_sent: 'bg-orange-100 text-orange-800',
  resolved: 'bg-green-100 text-green-800',
};

const statusLabels: Record<string, string> = {
  new_domain: '新規',
  analyzing: '分析中',
  confirmed_threat: '脅威確認',
  false_positive: '誤検知',
  takedown_sent: 'テイクダウン済',
  resolved: '解決済',
};

const categoryLabels: Record<string, string> = {
  phishing: '🎣 フィッシング',
  brand_abuse: '⚠️ ブランド悪用',
  parked: '🅿️ パーク',
  legitimate: '✅ 正規',
  unknown: '❓ 不明',
};

function RiskBadge({ score }: { score: number | null }) {
  if (score === null) return <span className="text-gray-400">—</span>;
  const color =
    score >= 80 ? 'bg-red-500' :
    score >= 60 ? 'bg-orange-500' :
    score >= 40 ? 'bg-yellow-500' :
    'bg-green-500';
  return (
    <div className="flex items-center gap-2">
      <div className={`w-2 h-2 rounded-full ${color}`} />
      <span className="font-mono font-bold">{score}</span>
    </div>
  );
}

export default function ThreatTable({ threats, onSelect }: { threats: Threat[]; onSelect?: (id: string) => void }) {
  if (threats.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        検知された脅威はありません
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-200 text-left text-sm text-gray-500">
            <th className="pb-3 font-medium">ドメイン</th>
            <th className="pb-3 font-medium">ブランド</th>
            <th className="pb-3 font-medium">カテゴリ</th>
            <th className="pb-3 font-medium">
              <span className="flex items-center gap-1">
                リスク
                <Tooltip content="0〜100のリスクスコア。ドメイン類似度（30%）・ドメイン年齢（20%）・SSL状態（15%）・AI脅威分類（25%）・コンテンツ類似度（10%）から算出。80以上は重大脅威です。" />
              </span>
            </th>
            <th className="pb-3 font-medium">ステータス</th>
            <th className="pb-3 font-medium">検知日</th>
          </tr>
        </thead>
        <tbody>
          {threats.map((threat) => (
            <tr
              key={threat.id}
              className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
              onClick={() => onSelect?.(threat.id)}
            >
              <td className="py-3 font-mono text-sm font-medium">{threat.domain}</td>
              <td className="py-3 text-sm text-gray-600">{threat.brand.name}</td>
              <td className="py-3 text-sm">
                {threat.analyses[0]
                  ? categoryLabels[threat.analyses[0].category] || threat.analyses[0].category
                  : '—'}
              </td>
              <td className="py-3"><RiskBadge score={threat.riskScore} /></td>
              <td className="py-3">
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[threat.status] || 'bg-gray-100'}`}>
                  {statusLabels[threat.status] || threat.status}
                </span>
              </td>
              <td className="py-3 text-sm text-gray-500">
                {new Date(threat.firstSeen).toLocaleDateString('ja-JP')}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
