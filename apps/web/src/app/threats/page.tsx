'use client';

import { useEffect, useState } from 'react';
import ThreatTable from '@/components/ThreatTable';
import { getThreats } from '@/lib/api';

export default function ThreatsPage() {
  const [threats, setThreats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    status: '',
    category: '',
    minRiskScore: '',
    sortBy: 'riskScore',
    order: 'desc',
    page: '1',
    pageSize: '20',
  });

  useEffect(() => {
    setLoading(true);
    const params: Record<string, string> = {};
    Object.entries(filters).forEach(([k, v]) => { if (v) params[k] = v; });
    getThreats(params)
      .then(setThreats)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [filters]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">脅威一覧</h1>
        <p className="text-gray-500 mt-1">検知されたなりすましドメインの一覧</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex flex-wrap gap-4">
          <select
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value, page: '1' })}
          >
            <option value="">全ステータス</option>
            <option value="new_domain">新規</option>
            <option value="analyzing">分析中</option>
            <option value="confirmed_threat">脅威確認</option>
            <option value="takedown_sent">テイクダウン済</option>
            <option value="resolved">解決済</option>
            <option value="false_positive">誤検知</option>
          </select>

          <select
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
            value={filters.category}
            onChange={(e) => setFilters({ ...filters, category: e.target.value, page: '1' })}
          >
            <option value="">全カテゴリ</option>
            <option value="phishing">フィッシング</option>
            <option value="brand_abuse">ブランド悪用</option>
            <option value="parked">パーク</option>
            <option value="legitimate">正規</option>
            <option value="unknown">不明</option>
          </select>

          <select
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
            value={filters.minRiskScore}
            onChange={(e) => setFilters({ ...filters, minRiskScore: e.target.value, page: '1' })}
          >
            <option value="">全リスクレベル</option>
            <option value="80">重大 (80+)</option>
            <option value="60">高 (60+)</option>
            <option value="40">中 (40+)</option>
          </select>

          <select
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
            value={filters.sortBy}
            onChange={(e) => setFilters({ ...filters, sortBy: e.target.value })}
          >
            <option value="riskScore">リスクスコア順</option>
            <option value="firstSeen">検知日順</option>
            <option value="domain">ドメイン名順</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        ) : (
          <>
            <ThreatTable
              threats={threats?.data || []}
              onSelect={(id) => window.location.href = `/threats/${id}`}
            />
            {/* Pagination */}
            {threats && threats.totalPages > 1 && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
                <p className="text-sm text-gray-500">
                  {threats.total}件中 {(threats.page - 1) * threats.pageSize + 1}〜
                  {Math.min(threats.page * threats.pageSize, threats.total)}件
                </p>
                <div className="flex gap-2">
                  <button
                    className="px-3 py-1 rounded border text-sm disabled:opacity-50"
                    disabled={threats.page <= 1}
                    onClick={() => setFilters({ ...filters, page: String(threats.page - 1) })}
                  >
                    前へ
                  </button>
                  <button
                    className="px-3 py-1 rounded border text-sm disabled:opacity-50"
                    disabled={threats.page >= threats.totalPages}
                    onClick={() => setFilters({ ...filters, page: String(threats.page + 1) })}
                  >
                    次へ
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
