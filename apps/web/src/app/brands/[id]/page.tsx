'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  getBrand,
  getBrandStats,
  updateBrand,
  deleteBrand,
  triggerScan,
  uploadBrandLogo,
  deleteBrandLogo,
  getBrandScans,
  getBrandDomains,
  addBrandDomain,
  bulkAddBrandDomains,
  removeBrandDomain,
} from '@/lib/api';

/* ──────────────────────── types ──────────────────────── */
interface BrandData {
  id: string;
  name: string;
  domain: string;
  logoUrl?: string | null;
  screenshotUrl?: string | null;
  keywords: string;
  whitelistDomains: string;
  senderEmail?: string | null;
  smtpHost?: string | null;
  smtpPort?: number | null;
  smtpUser?: string | null;
  smtpPass?: string | null;
  organization?: { id: string; name: string };
  brandDomains?: Array<{ id: string; domain: string; type: string; whoisExpiry?: string | null; createdAt: string }>;
  _count?: { detectedDomains: number; scanJobs: number };
  createdAt: string;
}
interface BrandStats {
  totalThreats: number;
  statusBreakdown: Record<string, number>;
  riskDistribution: Record<string, number>;
  averageRiskScore: number | null;
  dailyTrend: Array<{ date: string; count: number }>;
  recentScans: any[];
}

/* ──────────────────────── monitoring status ──────────────────────── */
const MONITORING_STATUS: Record<string, { label: string; color: string; dot: string }> = {
  active: { label: '監視中', color: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300', dot: 'bg-green-500' },
  running: { label: 'スキャン中', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300', dot: 'bg-blue-500 animate-pulse' },
  error: { label: 'エラー', color: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300', dot: 'bg-red-500' },
  inactive: { label: '未監視', color: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300', dot: 'bg-gray-400' },
};

function getMonitoringStatus(recentScans: any[]): string {
  if (!recentScans || recentScans.length === 0) return 'inactive';
  const latest = recentScans[0];
  if (latest.status === 'running' || latest.status === 'pending') return 'running';
  if (latest.status === 'failed') return 'error';
  const daysSince = (Date.now() - new Date(latest.startedAt).getTime()) / (1000 * 60 * 60 * 24);
  return daysSince <= 7 ? 'active' : 'inactive';
}

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'たった今';
  if (minutes < 60) return `${minutes}分前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}時間前`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}日前`;
  return new Date(dateStr).toLocaleDateString('ja-JP');
}

/* ──────────────────────── helpers ──────────────────────── */
const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  new_domain: { label: '新規', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' },
  analyzing: { label: '確認中', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300' },
  investigating: { label: '調査中', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300' },
  confirmed_threat: { label: '脅威確認', color: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' },
  confirmed_phishing: { label: 'フィッシング確認', color: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' },
  takedown_in_progress: { label: '削除申請中', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300' },
  taken_down: { label: '削除完了', color: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' },
  false_positive: { label: '誤検知', color: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300' },
  monitoring: { label: '監視中', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300' },
};

const RISK_COLORS: Record<string, string> = {
  critical: 'bg-red-500',
  high: 'bg-orange-500',
  medium: 'bg-yellow-500',
  low: 'bg-green-500',
  unknown: 'bg-gray-400',
};
const RISK_LABELS: Record<string, string> = {
  critical: '危険 (80+)',
  high: '高 (60-79)',
  medium: '中 (40-59)',
  low: '低 (0-39)',
  unknown: '未評価',
};

const SCAN_TYPE_LABELS: Record<string, string> = {
  ct_monitor: 'CT監視',
  domain_generation: '類似ドメイン',
  full: 'フルスキャン',
};

/* ──────────────────────── component ──────────────────────── */
export default function BrandDetailPage() {
  const params = useParams();
  const router = useRouter();
  const brandId = params.id as string;

  const [brand, setBrand] = useState<BrandData | null>(null);
  const [stats, setStats] = useState<BrandStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', domain: '', keywords: '' });
  const [logoUploading, setLogoUploading] = useState(false);
  const [newDomain, setNewDomain] = useState('');
  const [newDomainType, setNewDomainType] = useState<'primary' | 'owned'>('owned');
  const [addingDomain, setAddingDomain] = useState(false);
  const [scanNotice, setScanNotice] = useState<string | null>(null);
  const [domainSuccess, setDomainSuccess] = useState<string | null>(null);
  const [showAllDomains, setShowAllDomains] = useState(false);
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkDomains, setBulkDomains] = useState('');
  const [bulkAdding, setBulkAdding] = useState(false);
  const [scanHistory, setScanHistory] = useState<{ scans: any[]; total: number; page: number; totalPages: number } | null>(null);
  const [scanPage, setScanPage] = useState(1);

  const loadData = useCallback(async () => {
    try {
      const [b, s] = await Promise.all([getBrand(brandId), getBrandStats(brandId)]);
      setBrand(b);
      setStats(s);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [brandId]);

  const loadScans = useCallback(async (page: number) => {
    try {
      const data = await getBrandScans(brandId, page, 20);
      setScanHistory(data);
    } catch (e) { console.error(e); }
  }, [brandId]);

  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => { loadScans(scanPage); }, [loadScans, scanPage]);

  const handleScan = async (type: string) => {
    setScanning(true);
    try {
      await triggerScan(brandId, type);
      alert('スキャンを開始しました');
      loadData();
    } catch (e) { console.error(e); }
    finally { setScanning(false); }
  };

  const startEdit = () => {
    if (!brand) return;
    setEditForm({
      name: brand.name,
      domain: brand.domain,
      keywords: brand.keywords || '',
    });
    setEditing(true);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!brand) return;
    try {
      await updateBrand(brand.id, {
        name: editForm.name,
        domain: editForm.domain,
        keywords: editForm.keywords,
      });
      setEditing(false);
      loadData();
    } catch (e) { console.error(e); }
  };

  const handleDelete = async () => {
    if (!brand || !confirm('このブランドを削除しますか？関連する脅威データもすべて削除されます。')) return;
    await deleteBrand(brand.id);
    router.push('/brands');
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !brand) return;
    setLogoUploading(true);
    try {
      await uploadBrandLogo(brand.id, file);
      loadData();
    } catch (err: any) {
      alert(err.message || 'ロゴのアップロードに失敗しました');
    } finally {
      setLogoUploading(false);
      e.target.value = '';
    }
  };

  const handleAddDomain = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDomain.trim() || !brand) return;
    setAddingDomain(true);
    setScanNotice(null);
    setDomainSuccess(null);
    try {
      const addedDomain = newDomain.trim();
      const result = await addBrandDomain(brand.id, addedDomain, newDomainType);
      setNewDomain('');
      setNewDomainType('owned');
      const reclassMsg = result?.reclassified > 0 ? ` ${result.reclassified}件の検知ドメインをホワイトリスト（誤検知）に再分類しました。` : '';
      setDomainSuccess(`✅ 「${addedDomain}」を${newDomainType === 'primary' ? 'プライマリドメイン' : '保有ドメイン（ホワイトリスト）'}として追加しました。${reclassMsg}`);
      setTimeout(() => setDomainSuccess(null), 10000);
      setScanNotice(`🔍 「${brand.name}」のドメイン調査を自動開始しました。CT監視・類似ドメイン生成・脅威分析が完了するまで数分かかります。`);
      setTimeout(() => setScanNotice(null), 15000);
      loadData();
    } catch (err: any) {
      alert(err.message || 'ドメインの追加に失敗しました');
    } finally {
      setAddingDomain(false);
    }
  };

  const handleBulkAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bulkDomains.trim() || !brand) return;
    setBulkAdding(true);
    setScanNotice(null);
    setDomainSuccess(null);
    try {
      const result = await bulkAddBrandDomains(brand.id, bulkDomains.trim(), 'owned');
      const msgs: string[] = [];
      if (result.added > 0) msgs.push(`${result.added}件追加`);
      if (result.skipped > 0) msgs.push(`${result.skipped}件は既存`);
      if (result.reclassified > 0) msgs.push(`${result.reclassified}件の検知ドメインをホワイトリスト（誤検知）に再分類`);
      setDomainSuccess(`✅ 一括登録完了: ${msgs.join('、')}`);
      setTimeout(() => setDomainSuccess(null), 10000);
      if (result.added > 0) {
        setScanNotice(`🔍 「${brand.name}」のドメイン調査を自動開始しました。`);
        setTimeout(() => setScanNotice(null), 15000);
      }
      setBulkDomains('');
      setBulkMode(false);
      loadData();
    } catch (err: any) {
      alert(err.message || 'ドメインの一括追加に失敗しました');
    } finally {
      setBulkAdding(false);
    }
  };

  const handleRemoveDomain = async (domainId: string) => {
    if (!brand || !confirm('このドメインを削除しますか？')) return;
    try {
      await removeBrandDomain(brand.id, domainId);
      loadData();
    } catch (e) { console.error(e); }
  };

  const handleLogoDelete = async () => {
    if (!brand || !confirm('ロゴを削除しますか？')) return;
    try {
      await deleteBrandLogo(brand.id);
      loadData();
    } catch (e) { console.error(e); }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!brand) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-500 dark:text-gray-400">ブランドが見つかりません</p>
        <a href="/brands" className="text-blue-600 hover:underline text-sm mt-2 inline-block">← ブランド一覧に戻る</a>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
        <a href="/brands" className="hover:text-blue-600">ブランド管理</a>
        <span>/</span>
        <span className="text-gray-900 dark:text-gray-100">{brand.name}</span>
      </div>

      {/* Brand Info Card */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex flex-col sm:flex-row sm:items-start gap-6">
          {/* Logo */}
          <div className="flex-shrink-0">
            <div className="w-20 h-20 rounded-xl bg-gray-100 dark:bg-gray-700 flex items-center justify-center overflow-hidden border border-gray-200 dark:border-gray-600 relative group">
              {brand.logoUrl ? (
                <img src={brand.logoUrl} alt={brand.name} className="w-full h-full object-contain" />
              ) : (
                <span className="text-3xl text-gray-400">🏢</span>
              )}
              <label className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                <span className="text-white text-xs font-medium">{brand.logoUrl ? '変更' : 'アップロード'}</span>
                <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} disabled={logoUploading} />
              </label>
            </div>
            {brand.logoUrl && (
              <button onClick={handleLogoDelete} className="text-xs text-red-500 hover:text-red-600 mt-1 w-full text-center">
                削除
              </button>
            )}
            {logoUploading && <p className="text-xs text-gray-400 mt-1 text-center">アップロード中...</p>}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{brand.name}</h1>
                  {/* Monitoring Status Badge */}
                  {stats && (() => {
                    const mStatus = getMonitoringStatus(stats.recentScans);
                    const info = MONITORING_STATUS[mStatus];
                    return (
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${info.color}`}>
                        <span className={`w-2 h-2 rounded-full ${info.dot}`} />
                        {info.label}
                      </span>
                    );
                  })()}
                </div>
                <p className="text-gray-500 dark:text-gray-400 font-mono text-sm mt-1">{brand.domain}</p>
                {brand.organization && (
                  <p className="text-xs text-gray-400 mt-1">🏢 {brand.organization.name}</p>
                )}
                {brand.senderEmail && (
                  <p className="text-xs text-green-600 mt-1">📧 {brand.senderEmail}</p>
                )}
                {/* Last scan time */}
                {stats && stats.recentScans.length > 0 && (
                  <p className="text-xs text-gray-400 mt-1">
                    🕐 最終スキャン: {formatRelativeTime(stats.recentScans[0].completedAt || stats.recentScans[0].startedAt)}
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                <button onClick={startEdit} className="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg text-sm hover:bg-gray-200 dark:hover:bg-gray-600">
                  ✏️ 編集
                </button>
                <button onClick={handleDelete} className="px-3 py-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg text-sm">
                  削除
                </button>
              </div>
            </div>

            {/* Keywords */}
            {brand.keywords && brand.keywords.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-3">
                {brand.keywords.split(',').filter(Boolean).map((kw) => (
                  <span key={kw} className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs text-gray-600 dark:text-gray-300">
                    {kw.trim()}
                  </span>
                ))}
              </div>
            )}

            {/* Scan buttons */}
            <div className="flex flex-wrap gap-2 mt-4">
              <button
                onClick={() => handleScan('ct_monitor')}
                disabled={scanning}
                className="px-3 py-1.5 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-lg text-xs font-medium hover:bg-blue-100 disabled:opacity-50"
              >
                🔍 CT監視スキャン
              </button>
              <button
                onClick={() => handleScan('domain_generation')}
                disabled={scanning}
                className="px-3 py-1.5 bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-lg text-xs font-medium hover:bg-purple-100 disabled:opacity-50"
              >
                🔤 類似ドメインスキャン
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Setup Checklist */}
      {(() => {
        const checks = [
          { key: 'logo', label: 'ロゴを設定', done: !!brand.logoUrl, anchor: 'logo' },
          { key: 'primary', label: 'プライマリドメインを追加', done: (brand.brandDomains?.filter(d => d.type === 'primary').length ?? 0) > 0, anchor: 'domains' },
          { key: 'owned', label: '保有ドメインを登録', done: (brand.brandDomains?.filter(d => d.type === 'owned').length ?? 0) > 0, anchor: 'domains' },
          { key: 'keywords', label: '検知キーワードを設定', done: !!brand.keywords && brand.keywords.trim().length > 0, anchor: 'info' },
          { key: 'email', label: 'メール送信設定', done: !!brand.senderEmail, anchor: 'email' },
        ];
        const doneCount = checks.filter(c => c.done).length;
        const allDone = doneCount === checks.length;
        if (allDone) return null;
        const pct = Math.round((doneCount / checks.length) * 100);
        return (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">🚀 セットアップ</h2>
              <span className="text-xs text-gray-500 dark:text-gray-400">{doneCount}/{checks.length} 完了</span>
            </div>
            <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2 mb-4">
              <div
                className="h-2 rounded-full transition-all duration-500 bg-gradient-to-r from-blue-500 to-blue-600"
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="space-y-2">
              {checks.map(c => (
                <div key={c.key} className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${c.done ? 'bg-green-50 dark:bg-green-900/10' : 'bg-gray-50 dark:bg-gray-700/50 hover:bg-blue-50 dark:hover:bg-blue-900/10'}`}>
                  <span className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs ${c.done ? 'bg-green-500 text-white' : 'border-2 border-gray-300 dark:border-gray-500 text-gray-400'}`}>
                    {c.done ? '✓' : ''}
                  </span>
                  <span className={`text-sm ${c.done ? 'text-gray-400 dark:text-gray-500 line-through' : 'text-gray-700 dark:text-gray-200'}`}>
                    {c.label}
                  </span>
                  {!c.done && (
                    <span className="ml-auto text-xs text-blue-600 dark:text-blue-400">↓ 下で設定</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Edit Form */}
      {editing && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <form onSubmit={handleUpdate} className="space-y-4">
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">ブランド編集</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">ブランド名</label>
                <input type="text" required className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">ドメイン</label>
                <input type="text" required className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100" value={editForm.domain} onChange={(e) => setEditForm({ ...editForm, domain: e.target.value })} />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">検知キーワード（カンマ区切り）</label>
              <input type="text" className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100" value={editForm.keywords} onChange={(e) => setEditForm({ ...editForm, keywords: e.target.value })} />
            </div>
            <p className="text-xs text-gray-400 dark:text-gray-500">保有ドメイン・メール送信設定はこのページ下部の専用セクションで管理できます。</p>

            <div className="flex gap-2">
              <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">保存</button>
              <button type="button" onClick={() => setEditing(false)} className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm">キャンセル</button>
            </div>
          </form>
        </div>
      )}

      {/* Stats Cards */}
      {stats && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
              <p className="text-xs text-gray-500 dark:text-gray-400">検知数合計</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">{stats.totalThreats}</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
              <p className="text-xs text-gray-500 dark:text-gray-400">平均リスクスコア</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">{stats.averageRiskScore ?? '-'}</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
              <p className="text-xs text-gray-500 dark:text-gray-400">フィッシング確認</p>
              <p className="text-2xl font-bold text-red-600 mt-1">{stats.statusBreakdown.confirmed_phishing || 0}</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
              <p className="text-xs text-gray-500 dark:text-gray-400">削除完了</p>
              <p className="text-2xl font-bold text-green-600 mt-1">{stats.statusBreakdown.taken_down || 0}</p>
            </div>
          </div>

          {/* Status Breakdown & Risk Distribution */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Status */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
              <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-4">ステータス別内訳</h2>
              <div className="space-y-2">
                {Object.entries(stats.statusBreakdown).map(([status, count]) => {
                  const info = STATUS_LABELS[status] || { label: status, color: 'bg-gray-100 text-gray-600' };
                  const pct = stats.totalThreats > 0 ? Math.round((count / stats.totalThreats) * 100) : 0;
                  return (
                    <div key={status} className="flex items-center gap-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${info.color} whitespace-nowrap`}>{info.label}</span>
                      <div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-full h-2">
                        <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-sm font-medium text-gray-600 dark:text-gray-300 w-12 text-right">{count}</span>
                    </div>
                  );
                })}
                {Object.keys(stats.statusBreakdown).length === 0 && (
                  <p className="text-sm text-gray-400">検知データなし</p>
                )}
              </div>
            </div>

            {/* Risk Distribution */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
              <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-4">リスク帯分布</h2>
              <div className="space-y-2">
                {['critical', 'high', 'medium', 'low', 'unknown'].map((band) => {
                  const count = stats.riskDistribution[band] || 0;
                  if (count === 0) return null;
                  const pct = stats.totalThreats > 0 ? Math.round((count / stats.totalThreats) * 100) : 0;
                  return (
                    <div key={band} className="flex items-center gap-3">
                      <span className="text-xs w-24 text-gray-600 dark:text-gray-300">{RISK_LABELS[band]}</span>
                      <div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-full h-2">
                        <div className={`${RISK_COLORS[band]} h-2 rounded-full`} style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-sm font-medium text-gray-600 dark:text-gray-300 w-12 text-right">{count}</span>
                    </div>
                  );
                })}
                {stats.totalThreats === 0 && (
                  <p className="text-sm text-gray-400">検知データなし</p>
                )}
              </div>
            </div>
          </div>

          {/* 30-Day Trend */}
          {stats.dailyTrend.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
              <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-4">直近30日の検知推移</h2>
              <div className="flex items-end gap-[2px] h-24">
                {(() => {
                  const maxCount = Math.max(...stats.dailyTrend.map((d) => d.count), 1);
                  return stats.dailyTrend.map((d) => (
                    <div key={d.date} className="flex-1 group relative">
                      <div
                        className="bg-blue-500 rounded-t hover:bg-blue-600 transition-colors w-full"
                        style={{ height: `${Math.max((d.count / maxCount) * 96, 2)}px` }}
                      />
                      <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 hidden group-hover:block bg-gray-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap z-10">
                        {d.date}: {d.count}件
                      </div>
                    </div>
                  ));
                })()}
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-xs text-gray-400">{stats.dailyTrend[0]?.date}</span>
                <span className="text-xs text-gray-400">{stats.dailyTrend[stats.dailyTrend.length - 1]?.date}</span>
              </div>
            </div>
          )}
        </>
      )}

      {/* Domain 2-layer Management */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-4">
          ドメイン管理 <span className="text-gray-400 font-normal">({brand.brandDomains?.length || 0})</span>
        </h2>

        {/* Primary Domains */}
        {(() => {
          const INITIAL_SHOW = 5;
          const primaryDomains = brand.brandDomains?.filter((d) => d.type === 'primary') || [];
          const ownedDomains = brand.brandDomains?.filter((d) => d.type === 'owned') || [];
          const totalDomains = primaryDomains.length + ownedDomains.length;
          const visibleOwned = showAllDomains ? ownedDomains : ownedDomains.slice(0, Math.max(0, INITIAL_SHOW - primaryDomains.length));
          const hiddenCount = totalDomains - primaryDomains.length - visibleOwned.length;
          return (
            <>
              <div className="mb-4">
                <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">🎯 プライマリドメイン（監視対象）</h3>
                {primaryDomains.length > 0 ? (
                  <div className="space-y-1">
                    {primaryDomains.map((d) => (
                      <div key={d.id} className="flex items-center justify-between px-3 py-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                        <div className="flex items-center gap-2">
                          <span className="px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded text-[10px] font-medium">PRIMARY</span>
                          <span className="text-sm font-mono text-gray-700 dark:text-gray-200">{d.domain}</span>
                        </div>
                        <button onClick={() => handleRemoveDomain(d.id)} className="text-xs text-red-500 hover:text-red-600">✕</button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400 px-3">プライマリドメインが設定されていません</p>
                )}
              </div>

              <div className="mb-4">
                <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">
                  🏢 保有ドメイン（ホワイトリスト）
                  {ownedDomains.length > 0 && <span className="ml-1 text-gray-400 normal-case">— {ownedDomains.length}件</span>}
                </h3>
                {ownedDomains.length > 0 ? (
                  <div className="space-y-1">
                    {visibleOwned.map((d) => (
                      <div key={d.id} className="flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                        <div className="flex items-center gap-2">
                          <span className="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300 rounded text-[10px] font-medium">OWNED</span>
                          <span className="text-sm font-mono text-gray-700 dark:text-gray-200">{d.domain}</span>
                        </div>
                        <button onClick={() => handleRemoveDomain(d.id)} className="text-xs text-red-500 hover:text-red-600">✕</button>
                      </div>
                    ))}
                    {hiddenCount > 0 && !showAllDomains && (
                      <button
                        onClick={() => setShowAllDomains(true)}
                        className="w-full px-3 py-2 text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                      >
                        他 {hiddenCount}件を表示 ▼
                      </button>
                    )}
                    {showAllDomains && ownedDomains.length > INITIAL_SHOW && (
                      <button
                        onClick={() => setShowAllDomains(false)}
                        className="w-full px-3 py-2 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-lg transition-colors"
                      >
                        折りたたむ ▲
                      </button>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400 px-3">保有ドメインが登録されていません</p>
                )}
              </div>
            </>
          );
        })()}

        {/* Add domain form */}
        <form onSubmit={handleAddDomain} className="flex flex-col sm:flex-row gap-2 mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
          <input
            type="text"
            value={newDomain}
            onChange={(e) => setNewDomain(e.target.value)}
            placeholder="example.com"
            className="flex-1 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
          />
          <select
            value={newDomainType}
            onChange={(e) => setNewDomainType(e.target.value as 'primary' | 'owned')}
            className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
          >
            <option value="owned">保有ドメイン</option>
            <option value="primary">プライマリ</option>
          </select>
          <button
            type="submit"
            disabled={addingDomain || !newDomain.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            追加
          </button>
        </form>
        <div className="flex items-center justify-between mt-2">
          <p className="text-xs text-gray-400">プライマリ = 監視対象の本体ドメイン。保有 = 自社管理ドメイン（ホワイトリスト自動登録）。</p>
          <button
            type="button"
            onClick={() => setBulkMode(!bulkMode)}
            className="text-xs text-blue-600 hover:text-blue-700 font-medium whitespace-nowrap ml-2"
          >
            {bulkMode ? '閉じる' : '📋 一括登録'}
          </button>
        </div>

        {/* Bulk add domains */}
        {bulkMode && (
          <form onSubmit={handleBulkAdd} className="mt-3 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">保有ドメインを一括登録</label>
            <textarea
              value={bulkDomains}
              onChange={(e) => setBulkDomains(e.target.value)}
              placeholder={"example.com\nexample.co.jp\nexample.net\n\nカンマ・改行・セミコロンで区切り可"}
              rows={6}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-mono"
            />
            <div className="flex items-center justify-between mt-2">
              <p className="text-xs text-gray-400">
                {bulkDomains.trim() ? `${bulkDomains.split(/[,;\n\r]+/).filter((d) => d.trim().length > 0 && d.trim().includes('.')).length}件のドメインを検出` : 'ドメインを入力してください'}
              </p>
              <button
                type="submit"
                disabled={bulkAdding || !bulkDomains.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {bulkAdding ? '登録中...' : '一括登録'}
              </button>
            </div>
          </form>
        )}

        {/* Domain added success notice */}
        {domainSuccess && (
          <div className="mt-3 px-4 py-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
            <p className="text-sm text-green-700 dark:text-green-300">{domainSuccess}</p>
          </div>
        )}

        {/* Scan triggered notice */}
        {scanNotice && (
          <div className="mt-3 flex items-start gap-2 px-4 py-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-600 border-t-transparent flex-shrink-0 mt-0.5" />
            <p className="text-sm text-blue-700 dark:text-blue-300">{scanNotice}</p>
          </div>
        )}
      </div>

      {/* Scan History */}
      {scanHistory && scanHistory.scans.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">
              スキャン履歴 <span className="text-gray-400 font-normal">（{scanHistory.total}件）</span>
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700">
                  <th className="pb-2 font-medium">種別</th>
                  <th className="pb-2 font-medium">ステータス</th>
                  <th className="pb-2 font-medium">検知数</th>
                  <th className="pb-2 font-medium">開始日時</th>
                  <th className="pb-2 font-medium">完了日時</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
                {scanHistory.scans.map((scan: any) => (
                  <tr key={scan.id}>
                    <td className="py-2">{SCAN_TYPE_LABELS[scan.type] || scan.type}</td>
                    <td className="py-2">
                      <span className={`px-2 py-0.5 rounded text-xs ${
                        scan.status === 'completed' ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' :
                        scan.status === 'failed' ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' :
                        scan.status === 'running' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' :
                        'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
                      }`}>
                        {scan.status}
                      </span>
                    </td>
                    <td className="py-2 font-medium">{scan.findingsCount}</td>
                    <td className="py-2 text-gray-500 dark:text-gray-400">{new Date(scan.startedAt).toLocaleString('ja-JP')}</td>
                    <td className="py-2 text-gray-500 dark:text-gray-400">{scan.completedAt ? new Date(scan.completedAt).toLocaleString('ja-JP') : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {scanHistory.totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
              <p className="text-xs text-gray-400">
                {(scanHistory.page - 1) * 20 + 1}〜{Math.min(scanHistory.page * 20, scanHistory.total)}件 / 全{scanHistory.total}件
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setScanPage((p) => Math.max(1, p - 1))}
                  disabled={scanHistory.page <= 1}
                  className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-xs disabled:opacity-30 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  ← 前へ
                </button>
                <span className="px-3 py-1.5 text-xs text-gray-500">{scanHistory.page} / {scanHistory.totalPages}</span>
                <button
                  onClick={() => setScanPage((p) => Math.min(scanHistory.totalPages, p + 1))}
                  disabled={scanHistory.page >= scanHistory.totalPages}
                  className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-xs disabled:opacity-30 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  次へ →
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Created at */}
      <div className="text-xs text-gray-400 text-right">
        登録日: {new Date(brand.createdAt).toLocaleDateString('ja-JP')}
      </div>
    </div>
  );
}
