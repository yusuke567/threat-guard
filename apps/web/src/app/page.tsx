'use client';

import { useEffect, useState } from 'react';
import StatCard from '@/components/StatCard';
import ThreatTable from '@/components/ThreatTable';
import { getThreats } from '@/lib/api';

export default function Dashboard() {
  const [threats, setThreats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        />
        <StatCard
          title="重大脅威"
          value={critical}
          icon="🚨"
          color="red"
          subtitle="リスクスコア 80+"
        />
        <StatCard
          title="要対応"
          value={pending}
          icon="⚡"
          color="yellow"
          subtitle="テイクダウン待ち"
        />
        <StatCard
          title="解決済"
          value={resolved}
          icon="✅"
          color="green"
          subtitle="今月"
        />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900">最新の脅威</h2>
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
