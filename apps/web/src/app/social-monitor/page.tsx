'use client';

import { useEffect, useState } from 'react';
import { PageHeader, Button } from '@/components/ui';
import StatCard from '@/components/StatCard';
import { RiskBadgeCompact } from '@/components/RiskBadge';
import { useAuth } from '@/components/AuthProvider';
import {
  getSocialPosts,
  getSocialPostStats,
  updateSocialPostStatus,
  triggerSocialScan,
  getBrands,
} from '@/lib/api';

const statusLabels: Record<string, string> = {
  new: '🆕 未対応',
  reviewed: '✅ 確認済',
  dismissed: '🚫 却下',
};

const statusColors: Record<string, string> = {
  new: 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300',
  reviewed: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300',
  dismissed: 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300',
};

const platformLabels: Record<string, string> = {
  twitter: '𝕏 Twitter',
  facebook: 'Facebook',
  instagram: 'Instagram',
  telegram: 'Telegram',
  discord: 'Discord',
};

export default function SocialMonitorPage() {
  const { user } = useAuth();
  const [posts, setPosts] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [brands, setBrands] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [pagination, setPagination] = useState<any>(null);

  const [filters, setFilters] = useState({
    status: '',
    brandId: '',
    sortBy: 'createdAt',
    order: 'desc',
    page: '1',
    pageSize: '20',
  });

  const isAdmin = user?.role === 'superadmin' || user?.role === 'admin';

  const loadData = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (filters.status) params.status = filters.status;
      if (filters.brandId) params.brandId = filters.brandId;
      params.sortBy = filters.sortBy;
      params.order = filters.order;
      params.page = filters.page;
      params.pageSize = filters.pageSize;

      const [postsRes, statsRes] = await Promise.all([
        getSocialPosts(params),
        getSocialPostStats(),
      ]);
      setPosts(postsRes.posts);
      setPagination(postsRes.pagination);
      setStats(statsRes);
    } catch (err) {
      console.error('Failed to load social posts:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    getBrands().then(setBrands).catch(console.error);
  }, []);

  useEffect(() => {
    loadData();
  }, [filters]);

  const handleStatusChange = async (id: string, newStatus: string) => {
    try {
      await updateSocialPostStatus(id, newStatus);
      setPosts((prev) =>
        prev.map((p) => (p.id === id ? { ...p, status: newStatus } : p))
      );
      // Refresh stats
      getSocialPostStats().then(setStats).catch(console.error);
    } catch (err) {
      console.error('Status update failed:', err);
    }
  };

  const handleScan = async () => {
    setScanning(true);
    setScanResult(null);
    try {
      const res = await triggerSocialScan();
      setScanResult(res.message);
      loadData();
    } catch (err: any) {
      setScanResult(`エラー: ${err.message}`);
    } finally {
      setScanning(false);
    }
  };

  const handleFilterChange = (key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value, page: '1' }));
  };

  const handlePageChange = (newPage: number) => {
    setFilters((prev) => ({ ...prev, page: String(newPage) }));
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleString('ja-JP', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const truncate = (text: string, max: number) =>
    text.length > max ? text.slice(0, max) + '…' : text;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
      {/* Header */}
      <div className="mb-6">
        <PageHeader
          title="📡 SNS監視"
          description="Twitter上のフィッシングURL拡散をリアルタイム検知"
          actions={
            isAdmin ? (
              <Button
                onClick={handleScan}
                disabled={scanning}
              >
                {scanning ? '⏳ スキャン中...' : '🔄 手動スキャン'}
              </Button>
            ) : undefined
          }
        />
      </div>

      {/* Scan result */}
      {scanResult && (
        <div className={`mb-4 p-3 rounded-lg text-sm ${
          scanResult.startsWith('エラー')
            ? 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800'
            : 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800'
        }`}>
          {scanResult}
          <button
            onClick={() => setScanResult(null)}
            className="ml-2 opacity-50 hover:opacity-100"
          >
            ✕
          </button>
        </div>
      )}

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard
            title="検知総数"
            value={stats.total}
            icon="📊"
            color="blue"
            tooltip="検知されたSNS投稿の合計数"
          />
          <StatCard
            title="未対応"
            value={stats.new}
            icon="🔴"
            color="red"
            subtitle="確認が必要な投稿"
            tooltip="ステータスが「未対応」の投稿数"
          />
          {stats.byPlatform?.map((p: any) => (
            <StatCard
              key={p.platform}
              title={platformLabels[p.platform] || p.platform}
              value={p.count}
              icon="🐦"
              color="yellow"
            />
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <select
          value={filters.status}
          onChange={(e) => handleFilterChange('status', e.target.value)}
          className="px-3 py-2 border border-[var(--border-default)] rounded-lg bg-surface-card text-sm text-[var(--text-primary)]"
        >
          <option value="">すべてのステータス</option>
          <option value="new">🆕 未対応</option>
          <option value="reviewed">✅ 確認済</option>
          <option value="dismissed">🚫 却下</option>
        </select>

        <select
          value={filters.brandId}
          onChange={(e) => handleFilterChange('brandId', e.target.value)}
          className="px-3 py-2 border border-[var(--border-default)] rounded-lg bg-surface-card text-sm text-[var(--text-primary)]"
        >
          <option value="">すべてのブランド</option>
          {brands.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>

        <select
          value={filters.sortBy}
          onChange={(e) => handleFilterChange('sortBy', e.target.value)}
          className="px-3 py-2 border border-[var(--border-default)] rounded-lg bg-surface-card text-sm text-[var(--text-primary)]"
        >
          <option value="createdAt">検知日時</option>
          <option value="riskScore">リスクスコア</option>
          <option value="postedAt">投稿日時</option>
        </select>

        <button
          onClick={() =>
            setFilters((prev) => ({
              ...prev,
              order: prev.order === 'desc' ? 'asc' : 'desc',
              page: '1',
            }))
          }
          className="px-3 py-2 border border-[var(--border-default)] rounded-lg bg-surface-card text-sm text-[var(--text-primary)] hover:bg-gray-50 dark:hover:bg-gray-700"
        >
          {filters.order === 'desc' ? '↓ 降順' : '↑ 昇順'}
        </button>
      </div>

      {/* Table */}
      <div className="bg-surface-card rounded-xl border border-[var(--border-default)] overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-[var(--text-secondary)]">
            読み込み中...
          </div>
        ) : posts.length === 0 ? (
          <div className="p-8 sm:p-12">
            <div className="text-center mb-8">
              <p className="text-4xl mb-3">✅</p>
              <p className="font-bold text-lg text-[var(--text-primary)]">
                現在、フィッシングURLの拡散は検知されていません
              </p>
              <p className="text-sm text-[var(--text-secondary)] mt-1">
                4時間ごとに自動スキャンしています
              </p>
            </div>

            {/* How it works - ステップ説明 */}
            <div className="max-w-2xl mx-auto">
              <p className="text-sm font-bold text-[var(--text-secondary)] mb-4 text-center">
                📡 SNS監視のしくみ
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 border border-blue-100 dark:border-blue-800">
                  <div className="text-2xl mb-2">1️⃣</div>
                  <p className="text-sm font-bold text-blue-900 dark:text-blue-200 mb-1">
                    偽ドメインを検知
                  </p>
                  <p className="text-xs text-blue-700 dark:text-blue-300">
                    ブランドを騙る危険なドメイン（リスクスコア60以上）が自動スキャンで検知されます
                  </p>
                </div>
                <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-xl p-4 border border-yellow-100 dark:border-yellow-800">
                  <div className="text-2xl mb-2">2️⃣</div>
                  <p className="text-sm font-bold text-yellow-900 dark:text-yellow-200 mb-1">
                    Twitterで拡散を検索
                  </p>
                  <p className="text-xs text-yellow-700 dark:text-yellow-300">
                    検知した偽ドメインのURLがTwitter上で共有されていないか、4時間ごとに自動検索します
                  </p>
                </div>
                <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-4 border border-red-100 dark:border-red-800">
                  <div className="text-2xl mb-2">3️⃣</div>
                  <p className="text-sm font-bold text-red-900 dark:text-red-200 mb-1">
                    拡散を検知したら通知
                  </p>
                  <p className="text-xs text-red-700 dark:text-red-300">
                    フィッシングURLを含むツイートが見つかると、ここに表示され、Slack・メールで即座に通知されます
                  </p>
                </div>
              </div>
              <p className="text-xs text-[var(--text-tertiary)] mt-4 text-center">
                💡 ここに何も表示されていない＝フィッシングURLの拡散が検知されていない、ということです。安全な状態です。
              </p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-900/50 border-b border-[var(--border-default)]">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-[var(--text-secondary)]">
                    投稿者
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-[var(--text-secondary)]">
                    内容
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-[var(--text-secondary)]">
                    マッチドメイン
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-[var(--text-secondary)]">
                    ブランド
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-[var(--text-secondary)]">
                    リスク
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-[var(--text-secondary)]">
                    ステータス
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-[var(--text-secondary)]">
                    投稿日時
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {posts.map((post) => (
                  <tr
                    key={post.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div>
                        <span className="font-medium text-[var(--text-primary)]">
                          {post.authorName || '—'}
                        </span>
                        {post.authorHandle && (
                          <a
                            href={`https://x.com/${post.authorHandle}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block text-xs text-blue-600 dark:text-blue-400 hover:underline"
                          >
                            @{post.authorHandle}
                          </a>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 max-w-xs">
                      <a
                        href={`https://x.com/i/status/${post.postId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[var(--text-secondary)] hover:text-blue-600 dark:hover:text-blue-400"
                        title={post.content}
                      >
                        {truncate(post.content, 80)}
                      </a>
                      {post.urls && (
                        <div className="text-xs text-red-500 dark:text-red-400 mt-1 font-mono">
                          {truncate(post.urls, 60)}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {post.matchedDomain ? (
                        <span className="text-xs font-mono bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 px-2 py-0.5 rounded">
                          {post.matchedDomain}
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-[var(--text-secondary)]">
                      {post.brand?.name || '—'}
                    </td>
                    <td className="px-4 py-3">
                      <RiskBadgeCompact score={post.riskScore} />
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={post.status}
                        onChange={(e) =>
                          handleStatusChange(post.id, e.target.value)
                        }
                        className={`text-xs font-medium px-2 py-1 rounded-lg border-0 cursor-pointer ${
                          statusColors[post.status] || ''
                        }`}
                      >
                        <option value="new">🆕 未対応</option>
                        <option value="reviewed">✅ 確認済</option>
                        <option value="dismissed">🚫 却下</option>
                      </select>
                    </td>
                    <td className="px-4 py-3 text-xs text-[var(--text-secondary)] whitespace-nowrap">
                      {formatDate(post.postedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--border-default)] bg-gray-50 dark:bg-gray-900/50">
            <span className="text-sm text-[var(--text-secondary)]">
              全 {pagination.total} 件中{' '}
              {(pagination.page - 1) * pagination.pageSize + 1}–
              {Math.min(pagination.page * pagination.pageSize, pagination.total)}{' '}
              件
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => handlePageChange(pagination.page - 1)}
                disabled={pagination.page <= 1}
                className="px-3 py-1 text-sm border border-[var(--border-default)] rounded-lg disabled:opacity-30 hover:bg-white dark:hover:bg-gray-800 text-[var(--text-primary)]"
              >
                ← 前
              </button>
              <span className="px-3 py-1 text-sm text-[var(--text-secondary)]">
                {pagination.page} / {pagination.totalPages}
              </span>
              <button
                onClick={() => handlePageChange(pagination.page + 1)}
                disabled={pagination.page >= pagination.totalPages}
                className="px-3 py-1 text-sm border border-[var(--border-default)] rounded-lg disabled:opacity-30 hover:bg-white dark:hover:bg-gray-800 text-[var(--text-primary)]"
              >
                次 →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
