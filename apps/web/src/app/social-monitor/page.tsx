'use client';

import { useEffect, useState } from 'react';
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
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            📡 SNS監視
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Twitter上のフィッシングURL拡散をリアルタイム検知
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={handleScan}
            disabled={scanning}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
          >
            {scanning ? '⏳ スキャン中...' : '🔄 手動スキャン'}
          </button>
        )}
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
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-200"
        >
          <option value="">すべてのステータス</option>
          <option value="new">🆕 未対応</option>
          <option value="reviewed">✅ 確認済</option>
          <option value="dismissed">🚫 却下</option>
        </select>

        <select
          value={filters.brandId}
          onChange={(e) => handleFilterChange('brandId', e.target.value)}
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-200"
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
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-200"
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
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
        >
          {filters.order === 'desc' ? '↓ 降順' : '↑ 昇順'}
        </button>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-500 dark:text-gray-400">
            読み込み中...
          </div>
        ) : posts.length === 0 ? (
          <div className="p-12 text-center text-gray-500 dark:text-gray-400">
            <p className="text-4xl mb-3">📡</p>
            <p className="font-medium">検知されたSNS投稿はありません</p>
            <p className="text-sm mt-1">
              スケジューラが4時間ごとに自動スキャンします
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">
                    投稿者
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">
                    内容
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">
                    マッチドメイン
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">
                    ブランド
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">
                    リスク
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">
                    ステータス
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">
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
                        <span className="font-medium text-gray-900 dark:text-gray-100">
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
                        className="text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400"
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
                    <td className="px-4 py-3 text-xs text-gray-600 dark:text-gray-400">
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
                    <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
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
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
            <span className="text-sm text-gray-500 dark:text-gray-400">
              全 {pagination.total} 件中{' '}
              {(pagination.page - 1) * pagination.pageSize + 1}–
              {Math.min(pagination.page * pagination.pageSize, pagination.total)}{' '}
              件
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => handlePageChange(pagination.page - 1)}
                disabled={pagination.page <= 1}
                className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-lg disabled:opacity-30 hover:bg-white dark:hover:bg-gray-800 text-gray-700 dark:text-gray-200"
              >
                ← 前
              </button>
              <span className="px-3 py-1 text-sm text-gray-600 dark:text-gray-400">
                {pagination.page} / {pagination.totalPages}
              </span>
              <button
                onClick={() => handlePageChange(pagination.page + 1)}
                disabled={pagination.page >= pagination.totalPages}
                className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-lg disabled:opacity-30 hover:bg-white dark:hover:bg-gray-800 text-gray-700 dark:text-gray-200"
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
