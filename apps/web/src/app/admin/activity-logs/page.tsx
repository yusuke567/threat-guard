'use client';

import { useState, useEffect, useCallback } from 'react';
import { PageHeader, Button, Card, Alert } from '@/components/ui';
import AdminGuard from '@/components/AdminGuard';
import { getActivityLogs, getActivityLogStats } from '@/lib/api';

interface ActivityLog {
  id: string;
  userId: string | null;
  userEmail: string;
  userName: string | null;
  organizationId: string | null;
  action: string;
  category: string;
  method: string;
  path: string;
  statusCode: number | null;
  ipAddress: string | null;
  metadata: string | null;
  duration: number | null;
  createdAt: string;
}

interface Stats {
  count24h: number;
  count7d: number;
  count30d: number;
  topUsers: Array<{ email: string; name: string | null; count: number }>;
  categoryBreakdown: Array<{ category: string; count: number }>;
}

const CATEGORY_LABELS: Record<string, string> = {
  auth: '認証',
  threat: '脅威',
  scan: 'スキャン',
  takedown: '削除申請',
  brand: 'ブランド',
  report: 'レポート',
  alert: 'アラート',
  social: 'SNS監視',
  phishing: '検知ルール',
  admin: '管理',
};

const METHOD_COLORS: Record<string, string> = {
  GET: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  POST: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  PUT: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  PATCH: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  DELETE: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

function statusColor(code: number | null): string {
  if (!code) return 'text-[var(--text-tertiary)]';
  if (code < 300) return 'text-green-600 dark:text-green-400';
  if (code < 400) return 'text-yellow-600 dark:text-yellow-400';
  if (code < 500) return 'text-orange-600 dark:text-orange-400';
  return 'text-red-600 dark:text-red-400';
}

export default function ActivityLogsPage() {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const pageSize = 50;

  const [filters, setFilters] = useState({
    userEmail: '',
    category: '',
    method: '',
    startDate: '',
    endDate: '',
  });
  const [appliedFilters, setAppliedFilters] = useState(filters);

  const loadStats = async () => {
    try {
      const data = await getActivityLogStats();
      setStats(data);
    } catch {
      // Stats are non-critical
    }
  };

  const loadLogs = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params: Record<string, string> = {
        page: String(page),
        pageSize: String(pageSize),
      };
      if (appliedFilters.userEmail) params.userEmail = appliedFilters.userEmail;
      if (appliedFilters.category) params.category = appliedFilters.category;
      if (appliedFilters.method) params.method = appliedFilters.method;
      if (appliedFilters.startDate) params.startDate = appliedFilters.startDate;
      if (appliedFilters.endDate) params.endDate = appliedFilters.endDate;

      const data = await getActivityLogs(params);
      setLogs(data.data);
      setTotal(data.total);
      setTotalPages(data.totalPages);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [page, appliedFilters]);

  useEffect(() => { loadLogs(); }, [loadLogs]);
  useEffect(() => { loadStats(); }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setAppliedFilters({ ...filters });
  };

  const handleReset = () => {
    const empty = { userEmail: '', category: '', method: '', startDate: '', endDate: '' };
    setFilters(empty);
    setAppliedFilters(empty);
    setPage(1);
  };

  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <AdminGuard>
      <div>
        <div className="mb-6">
          <PageHeader title="アクティビティログ" description="ユーザーの操作履歴を確認できます" />
        </div>

        {error && <Alert variant="error" className="mb-4 p-3 text-sm">{error}</Alert>}

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <Card padding="sm">
              <p className="text-xs text-[var(--text-tertiary)] mb-1">24時間</p>
              <p className="text-2xl font-bold text-[var(--text-primary)]">{stats.count24h.toLocaleString()}</p>
              <p className="text-xs text-[var(--text-tertiary)]">アクション</p>
            </Card>
            <Card padding="sm">
              <p className="text-xs text-[var(--text-tertiary)] mb-1">7日間</p>
              <p className="text-2xl font-bold text-[var(--text-primary)]">{stats.count7d.toLocaleString()}</p>
              <p className="text-xs text-[var(--text-tertiary)]">アクション</p>
            </Card>
            <Card padding="sm">
              <p className="text-xs text-[var(--text-tertiary)] mb-1">30日間</p>
              <p className="text-2xl font-bold text-[var(--text-primary)]">{stats.count30d.toLocaleString()}</p>
              <p className="text-xs text-[var(--text-tertiary)]">アクション</p>
            </Card>
            <Card padding="sm">
              <p className="text-xs text-[var(--text-tertiary)] mb-1">アクティブユーザー (7日)</p>
              <p className="text-2xl font-bold text-[var(--text-primary)]">{stats.topUsers.length}</p>
              <p className="text-xs text-[var(--text-tertiary)]">ユーザー</p>
            </Card>
          </div>
        )}

        {/* Top Users & Category Breakdown */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <Card padding="sm">
              <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">アクティブユーザー Top 10 (7日間)</h3>
              <div className="space-y-2">
                {stats.topUsers.map((u, i) => (
                  <div key={u.email} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[var(--text-tertiary)] w-5 text-right flex-shrink-0">{i + 1}.</span>
                      <span className="text-[var(--text-primary)] truncate">{u.name || u.email}</span>
                      {u.name && <span className="text-[var(--text-tertiary)] text-xs truncate hidden sm:inline">{u.email}</span>}
                    </div>
                    <span className="text-[var(--text-secondary)] font-medium flex-shrink-0 ml-2">{u.count}</span>
                  </div>
                ))}
                {stats.topUsers.length === 0 && (
                  <p className="text-sm text-[var(--text-tertiary)]">データがありません</p>
                )}
              </div>
            </Card>
            <Card padding="sm">
              <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">カテゴリ別アクション (7日間)</h3>
              <div className="space-y-2">
                {stats.categoryBreakdown.map((c) => (
                  <div key={c.category} className="flex items-center justify-between text-sm">
                    <span className="text-[var(--text-primary)]">{CATEGORY_LABELS[c.category] || c.category}</span>
                    <span className="text-[var(--text-secondary)] font-medium">{c.count}</span>
                  </div>
                ))}
                {stats.categoryBreakdown.length === 0 && (
                  <p className="text-sm text-[var(--text-tertiary)]">データがありません</p>
                )}
              </div>
            </Card>
          </div>
        )}

        {/* Filters */}
        <Card padding="sm" className="mb-6">
          <form onSubmit={handleSearch} className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[180px]">
              <label className="block text-xs text-[var(--text-tertiary)] mb-1">メールアドレス</label>
              <input
                type="text"
                value={filters.userEmail}
                onChange={e => setFilters(f => ({ ...f, userEmail: e.target.value }))}
                placeholder="検索..."
                className="w-full px-3 py-2 border border-[var(--border-default)] rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-transparent text-[var(--text-primary)]"
              />
            </div>
            <div className="w-36">
              <label className="block text-xs text-[var(--text-tertiary)] mb-1">カテゴリ</label>
              <select
                value={filters.category}
                onChange={e => setFilters(f => ({ ...f, category: e.target.value }))}
                className="w-full px-3 py-2 border border-[var(--border-default)] rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-transparent text-[var(--text-primary)]"
              >
                <option value="">全て</option>
                {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>
            <div className="w-28">
              <label className="block text-xs text-[var(--text-tertiary)] mb-1">メソッド</label>
              <select
                value={filters.method}
                onChange={e => setFilters(f => ({ ...f, method: e.target.value }))}
                className="w-full px-3 py-2 border border-[var(--border-default)] rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-transparent text-[var(--text-primary)]"
              >
                <option value="">全て</option>
                <option value="GET">GET</option>
                <option value="POST">POST</option>
                <option value="PUT">PUT</option>
                <option value="PATCH">PATCH</option>
                <option value="DELETE">DELETE</option>
              </select>
            </div>
            <div className="w-40">
              <label className="block text-xs text-[var(--text-tertiary)] mb-1">開始日</label>
              <input
                type="date"
                value={filters.startDate}
                onChange={e => setFilters(f => ({ ...f, startDate: e.target.value }))}
                className="w-full px-3 py-2 border border-[var(--border-default)] rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-transparent text-[var(--text-primary)]"
              />
            </div>
            <div className="w-40">
              <label className="block text-xs text-[var(--text-tertiary)] mb-1">終了日</label>
              <input
                type="date"
                value={filters.endDate}
                onChange={e => setFilters(f => ({ ...f, endDate: e.target.value }))}
                className="w-full px-3 py-2 border border-[var(--border-default)] rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-transparent text-[var(--text-primary)]"
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit">検索</Button>
              <Button type="button" variant="secondary" onClick={handleReset}>リセット</Button>
            </div>
          </form>
        </Card>

        {/* Table */}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        ) : (
          <Card className="!p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-900 border-b border-[var(--border-default)]">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-[var(--text-secondary)] whitespace-nowrap">日時</th>
                    <th className="text-left px-4 py-3 font-medium text-[var(--text-secondary)] whitespace-nowrap">ユーザー</th>
                    <th className="text-left px-4 py-3 font-medium text-[var(--text-secondary)] whitespace-nowrap">カテゴリ</th>
                    <th className="text-left px-4 py-3 font-medium text-[var(--text-secondary)] whitespace-nowrap">アクション</th>
                    <th className="text-center px-4 py-3 font-medium text-[var(--text-secondary)] whitespace-nowrap">メソッド</th>
                    <th className="text-left px-4 py-3 font-medium text-[var(--text-secondary)] whitespace-nowrap">パス</th>
                    <th className="text-center px-4 py-3 font-medium text-[var(--text-secondary)] whitespace-nowrap">ステータス</th>
                    <th className="text-right px-4 py-3 font-medium text-[var(--text-secondary)] whitespace-nowrap">処理時間</th>
                    <th className="text-left px-4 py-3 font-medium text-[var(--text-secondary)] whitespace-nowrap">IP</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {logs.map(log => (
                    <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="px-4 py-3 text-[var(--text-secondary)] whitespace-nowrap">
                        {new Date(log.createdAt).toLocaleString('ja-JP', {
                          month: '2-digit', day: '2-digit',
                          hour: '2-digit', minute: '2-digit', second: '2-digit',
                        })}
                      </td>
                      <td className="px-4 py-3 max-w-[200px]">
                        <div className="truncate text-[var(--text-primary)] font-medium">{log.userName || '-'}</div>
                        <div className="truncate text-xs text-[var(--text-tertiary)]">{log.userEmail}</div>
                      </td>
                      <td className="px-4 py-3 text-[var(--text-secondary)] whitespace-nowrap">
                        {CATEGORY_LABELS[log.category] || log.category}
                      </td>
                      <td className="px-4 py-3 text-[var(--text-primary)] whitespace-nowrap font-mono text-xs">
                        {log.action}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${METHOD_COLORS[log.method] || 'bg-gray-100 text-gray-700'}`}>
                          {log.method}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[var(--text-secondary)] font-mono text-xs max-w-[250px] truncate">
                        {log.path}
                      </td>
                      <td className={`px-4 py-3 text-center font-medium ${statusColor(log.statusCode)}`}>
                        {log.statusCode ?? '-'}
                      </td>
                      <td className="px-4 py-3 text-right text-[var(--text-tertiary)] whitespace-nowrap">
                        {log.duration != null ? `${log.duration}ms` : '-'}
                      </td>
                      <td className="px-4 py-3 text-[var(--text-tertiary)] font-mono text-xs whitespace-nowrap">
                        {log.ipAddress || '-'}
                      </td>
                    </tr>
                  ))}
                  {logs.length === 0 && (
                    <tr>
                      <td colSpan={9} className="px-4 py-8 text-center text-[var(--text-tertiary)]">
                        アクティビティログがありません
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {total > 0 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--border-default)] bg-gray-50 dark:bg-gray-900">
                <p className="text-sm text-[var(--text-tertiary)]">
                  全 {total.toLocaleString()} 件中 {from}〜{to} 件表示
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage(p => p - 1)}
                  >
                    前へ
                  </Button>
                  <span className="flex items-center text-sm text-[var(--text-secondary)] px-2">
                    {page} / {totalPages}
                  </span>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage(p => p + 1)}
                  >
                    次へ
                  </Button>
                </div>
              </div>
            )}
          </Card>
        )}
      </div>
    </AdminGuard>
  );
}
