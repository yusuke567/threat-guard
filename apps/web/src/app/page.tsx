'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import ThreatTable from '@/components/ThreatTable';
import Tooltip from '@/components/Tooltip';
import { getThreats, getDashboardStats, getBrands } from '@/lib/api';
import { PageHeader, Button, Card, Alert } from '@/components/ui';

type FilterState = {
  brandId: string;
  period: string;
  status: string;
  minRiskScore: string;
  sortBy: string;
  order: string;
  page: string;
  pageSize: string;
};

type SummaryFilter = 'all' | 'action_needed' | 'monitoring' | 'resolved';

export default function Dashboard() {
  const router = useRouter();
  const [threats, setThreats] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [brands, setBrands] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showGuide, setShowGuide] = useState(true);
  const [summaryFilter, setSummaryFilter] = useState<SummaryFilter>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState<FilterState>({
    brandId: '',
    period: '',
    status: '',
    minRiskScore: '',
    sortBy: 'riskScore',
    order: 'desc',
    page: '1',
    pageSize: '20',
  });

  // Fetch brands on mount
  useEffect(() => {
    getBrands().then(setBrands).catch(console.error);
  }, []);

  // Build query params from current filters and summaryFilter
  const buildQueryParams = () => {
    const params: Record<string, string> = {};

    // Apply filters
    if (filters.brandId) params.brandId = filters.brandId;
    if (filters.status) params.status = filters.status;
    if (filters.minRiskScore) {
      // Parse "min:max" format (e.g., "60:80" means 60-79, "80:" means 80+)
      const [min, max] = filters.minRiskScore.split(':');
      if (min) params.minRiskScore = min;
      if (max) params.maxRiskScore = max;
    }
    if (filters.sortBy) params.sortBy = filters.sortBy;
    if (filters.order) params.order = filters.order;
    if (filters.page) params.page = filters.page;
    if (filters.pageSize) params.pageSize = filters.pageSize;

    // Apply summary filter overrides
    if (summaryFilter === 'action_needed') {
      params.minRiskScore = '60';
      params.excludeResolved = 'true';
      delete params.status;
    } else if (summaryFilter === 'monitoring') {
      params.minRiskScore = '40';
      params.maxRiskScore = '60';
      params.excludeResolved = 'true';
      delete params.status;
    } else if (summaryFilter === 'resolved') {
      params.status = 'resolved,false_positive';
      delete params.minRiskScore;
    }

    // Period filter
    if (filters.period) {
      const now = new Date();
      let from: Date | null = null;
      if (filters.period === 'today') {
        from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      } else if (filters.period === '7d') {
        from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      } else if (filters.period === '30d') {
        from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      }
      if (from) {
        params.fromDate = from.toISOString();
      }
    }

    return params;
  };

  // Fetch threats when filters change
  useEffect(() => {
    setLoading(true);
    const params = buildQueryParams();

    Promise.all([
      getThreats(params),
      getDashboardStats(),
    ])
      .then(([t, s]) => { setThreats(t); setStats(s); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [filters, summaryFilter]);

  if (error && !threats) {
    return (
      <Alert variant="error">
        <p className="font-medium">エラーが発生しました</p>
        <p className="text-sm mt-1">{error}</p>
      </Alert>
    );
  }

  const sc = stats?.statusCounts || { action_needed: 0, monitoring: 0, resolved: 0 };
  const actionNeeded = sc.action_needed;
  const monitoring = sc.monitoring;
  const resolved = sc.resolved;

  const handleSummaryClick = (filter: SummaryFilter) => {
    setSummaryFilter(summaryFilter === filter ? 'all' : filter);
    setFilters(prev => ({ ...prev, page: '1' }));
  };

  const updateFilter = (key: keyof FilterState, value: string) => {
    setSummaryFilter('all');
    setFilters(prev => ({ ...prev, [key]: value, page: '1' }));
  };

  return (
    <div className="space-y-6">
      {/* Welcome Guide */}
      {showGuide && (
        <Alert variant="info" className="p-5 relative">
          <button onClick={() => setShowGuide(false)} className="absolute top-3 right-3 text-blue-400 hover:text-blue-600 text-lg">✕</button>
          <h2 className="font-bold text-blue-900 dark:text-blue-200 text-lg">🛡️ ThreatGuardへようこそ</h2>
          <p className="text-blue-700 dark:text-blue-300 text-sm mt-2 leading-relaxed">
            このダッシュボードでブランドのなりすまし脅威を監視・管理できます。
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mt-3">
            <Link href="/brands" className="bg-surface-card/60 rounded-lg p-3 hover:bg-blue-100 dark:hover:bg-blue-800/40 transition-colors cursor-pointer group">
              <p className="font-bold text-blue-900 dark:text-blue-200 text-sm group-hover:underline">① ブランドを登録 →</p>
              <p className="text-blue-700 dark:text-blue-300 text-xs mt-1">監視したいブランドとドメインを登録すると自動スキャンが開始されます</p>
            </Link>
            <Link href="/alerts" className="bg-surface-card/60 rounded-lg p-3 hover:bg-blue-100 dark:hover:bg-blue-800/40 transition-colors cursor-pointer group">
              <p className="font-bold text-blue-900 dark:text-blue-200 text-sm group-hover:underline">② 通知を設定 →</p>
              <p className="text-blue-700 dark:text-blue-300 text-xs mt-1">メールやSlackで脅威検知の通知を受け取る設定をします</p>
            </Link>
            <Link href="/threats" className="bg-surface-card/60 rounded-lg p-3 hover:bg-blue-100 dark:hover:bg-blue-800/40 transition-colors cursor-pointer group">
              <p className="font-bold text-blue-900 dark:text-blue-200 text-sm group-hover:underline">③ 脅威を確認 →</p>
              <p className="text-blue-700 dark:text-blue-300 text-xs mt-1">自動スキャンで検知されたなりすまし脅威を確認します</p>
            </Link>
            <Link href="/takedown-request" className="bg-surface-card/60 rounded-lg p-3 hover:bg-blue-100 dark:hover:bg-blue-800/40 transition-colors cursor-pointer group">
              <p className="font-bold text-blue-900 dark:text-blue-200 text-sm group-hover:underline">④ 削除申請を送信 →</p>
              <p className="text-blue-700 dark:text-blue-300 text-xs mt-1">リスクの高い脅威に対して削除申請を生成・送信します</p>
            </Link>
          </div>
        </Alert>
      )}

      <PageHeader title="脅威一覧" description="検知されたなりすまし脅威の監視・管理" />

      {/* Summary Cards - clickable filters */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <button
          onClick={() => handleSummaryClick('action_needed')}
          className={`text-left rounded-xl border-2 p-4 transition-all animate-fade-in-up stagger-1 ${
            summaryFilter === 'action_needed'
              ? 'border-red-400 bg-red-50 dark:bg-red-900/30 ring-2 ring-red-200'
              : 'border-[var(--border-default)] bg-surface-card hover:border-red-200 dark:border-red-800 hover:bg-red-50 dark:bg-red-900/30/50'
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-[var(--text-secondary)]">🔴 対応が必要</p>
              <p className="text-3xl font-bold text-red-600 mt-1">{actionNeeded}<span className="text-base font-normal text-[var(--text-tertiary)] ml-1">件</span></p>
            </div>
          </div>
          <p className="text-xs text-[var(--text-tertiary)] mt-2">リスクスコア60以上 — 削除申請を検討</p>
        </button>

        <button
          onClick={() => handleSummaryClick('monitoring')}
          className={`text-left rounded-xl border-2 p-4 transition-all animate-fade-in-up stagger-2 ${
            summaryFilter === 'monitoring'
              ? 'border-yellow-400 bg-yellow-50 dark:bg-yellow-900/30 ring-2 ring-yellow-200'
              : 'border-[var(--border-default)] bg-surface-card hover:border-yellow-200 dark:border-yellow-800 hover:bg-yellow-50 dark:bg-yellow-900/30/50'
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-[var(--text-secondary)]">🟡 確認待ち</p>
              <p className="text-3xl font-bold text-yellow-600 mt-1">{monitoring}<span className="text-base font-normal text-[var(--text-tertiary)] ml-1">件</span></p>
            </div>
          </div>
          <p className="text-xs text-[var(--text-tertiary)] mt-2">リスクスコア40〜59 — 監視継続</p>
        </button>

        <button
          onClick={() => handleSummaryClick('resolved')}
          className={`text-left rounded-xl border-2 p-4 transition-all animate-fade-in-up stagger-3 ${
            summaryFilter === 'resolved'
              ? 'border-green-400 bg-green-50 dark:bg-green-900/30 ring-2 ring-green-200'
              : 'border-[var(--border-default)] bg-surface-card hover:border-green-200 dark:border-green-800 hover:bg-green-50 dark:bg-green-900/30/50'
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-[var(--text-secondary)]">🟢 対応済み</p>
              <p className="text-3xl font-bold text-green-600 mt-1">{resolved}<span className="text-base font-normal text-[var(--text-tertiary)] ml-1">件</span></p>
            </div>
          </div>
          <p className="text-xs text-[var(--text-tertiary)] mt-2">対応不要 or 削除完了</p>
        </button>
      </div>

      {/* Filter Bar */}
      <Card padding="sm">
        <div className="flex flex-wrap gap-4 items-center">
          <select
            className="w-full sm:w-auto border border-[var(--border-default)] rounded-lg px-3 py-2 text-sm"
            value={filters.brandId}
            onChange={(e) => updateFilter('brandId', e.target.value)}
          >
            <option value="">全ブランド</option>
            {brands.map((b: any) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>

          <select
            className="w-full sm:w-auto border border-[var(--border-default)] rounded-lg px-3 py-2 text-sm"
            value={filters.period}
            onChange={(e) => updateFilter('period', e.target.value)}
          >
            <option value="">全期間</option>
            <option value="today">今日</option>
            <option value="7d">直近7日</option>
            <option value="30d">直近30日</option>
          </select>

          <select
            className="w-full sm:w-auto border border-[var(--border-default)] rounded-lg px-3 py-2 text-sm"
            value={filters.status}
            onChange={(e) => updateFilter('status', e.target.value)}
          >
            <option value="">全ステータス</option>
            <option value="new_domain">未対応</option>
            <option value="analyzing">確認中</option>
            <option value="confirmed_threat">脅威確認</option>
            <option value="takedown_sent">削除申請中</option>
            <option value="resolved">削除完了</option>
            <option value="false_positive">誤検知</option>
          </select>

          <select
            className="w-full sm:w-auto border border-[var(--border-default)] rounded-lg px-3 py-2 text-sm"
            value={filters.minRiskScore}
            onChange={(e) => updateFilter('minRiskScore', e.target.value)}
          >
            <option value="">全リスクレベル</option>
            <option value="80:">🔴 危険 (80+)</option>
            <option value="60:80">🟠 高 (60-79)</option>
            <option value="40:60">🟡 中 (40-59)</option>
          </select>

          {(filters.brandId || filters.period || filters.status || filters.minRiskScore || summaryFilter !== 'all') && (
            <button
              className="text-sm text-blue-600 hover:text-blue-800 font-medium"
              onClick={() => {
                setSummaryFilter('all');
                setFilters(prev => ({
                  ...prev,
                  brandId: '',
                  period: '',
                  status: '',
                  minRiskScore: '',
                  page: '1',
                }));
              }}
            >
              ✕ フィルターをクリア
            </button>
          )}
        </div>
      </Card>

      {/* Action Bar */}
      {selectedIds.size > 0 && (
        <Alert variant="info" className="flex items-center justify-between">
          <span className="text-sm font-medium text-blue-800">
            {selectedIds.size}件を選択中
          </span>
          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={() => setSelectedIds(new Set())}
              className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            >
              選択解除
            </button>
            <Button
              variant="danger"
              onClick={() => {
                const ids = Array.from(selectedIds);
                sessionStorage.setItem('takedown_threat_ids', JSON.stringify(ids));
                router.push('/takedown-request');
              }}
              className="flex items-center gap-2"
            >
              🗑️ {selectedIds.size}件を削除申請
            </Button>
          </div>
        </Alert>
      )}

      {/* Threat Table */}
      <Card>
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        ) : (
          <>
            <ThreatTable
              threats={threats?.data || []}
              onSelect={(id) => router.push(`/threats/${id}`)}
              expandable
              selectable
              selectedIds={selectedIds}
              onSelectionChange={setSelectedIds}
              onScreenshotCaptured={() => {
                // Refresh threat data when screenshot is captured (use same filter logic as useEffect)
                getThreats(buildQueryParams()).then(setThreats).catch(console.error);
              }}
            />
            {/* Pagination */}
            {threats && threats.totalPages > 1 && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-[var(--border-subtle)]">
                <p className="text-sm text-[var(--text-secondary)]">
                  {threats.total}件中 {(threats.page - 1) * threats.pageSize + 1}〜
                  {Math.min(threats.page * threats.pageSize, threats.total)}件
                </p>
                <div className="flex gap-2">
                  <button
                    className="px-3 py-1 rounded border text-sm disabled:opacity-50"
                    disabled={threats.page <= 1}
                    onClick={() => setFilters(prev => ({ ...prev, page: String(threats.page - 1) }))}
                  >
                    前へ
                  </button>
                  <button
                    className="px-3 py-1 rounded border text-sm disabled:opacity-50"
                    disabled={threats.page >= threats.totalPages}
                    onClick={() => setFilters(prev => ({ ...prev, page: String(threats.page + 1) }))}
                  >
                    次へ
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  );
}
