'use client';

import Tooltip from './Tooltip';
import { RiskBadgeCompact } from './RiskBadge';

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
            <th className="pb-3 font-medium">カテゴリ</th>
            <th className="pb-3 font-medium">
              <span className="flex items-center gap-1">
                リスク
                <Tooltip content="リスクスコア（0〜100）と推奨アクション。🔴危険（80+）= 即テイクダウン、🟠高（60-79）= 要確認、🟡中（40-59）= 監視継続、🟢低（0-39）= 対応不要。" />
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
              <td className="py-3">
                <div className="font-mono text-sm font-medium">{threat.domain}</div>
                <div className="text-xs text-gray-400 mt-0.5">vs {threat.brand.domain}</div>
              </td>
              <td className="py-3 text-sm">
                {threat.analyses[0]
                  ? categoryLabels[threat.analyses[0].category] || threat.analyses[0].category
                  : '—'}
              </td>
              <td className="py-3">
                <RiskBadgeCompact score={threat.riskScore} threatId={threat.id} />
              </td>
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
