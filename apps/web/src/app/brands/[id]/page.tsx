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
  getBrandDomains,
  addBrandDomain,
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

/* ──────────────────────── helpers ──────────────────────── */
const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  new_domain: { label: '新規', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' },
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
  const [editForm, setEditForm] = useState({ name: '', domain: '', keywords: '', managedDomains: '', senderEmail: '', smtpHost: '', smtpPort: '', smtpUser: '', smtpPass: '' });
  const [smtpOpen, setSmtpOpen] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const [newDomain, setNewDomain] = useState('');
  const [newDomainType, setNewDomainType] = useState<'primary' | 'owned'>('owned');
  const [addingDomain, setAddingDomain] = useState(false);
  const [scanNotice, setScanNotice] = useState<string | null>(null);
  const [domainSuccess, setDomainSuccess] = useState<string | null>(null);
  const [showAllDomains, setShowAllDomains] = useState(false);

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

  useEffect(() => { loadData(); }, [loadData]);

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
    const wl = brand.whitelistDomains
      ? brand.whitelistDomains.split(',').filter((d) => d.trim() !== brand.domain).join('\n')
      : '';
    setEditForm({
      name: brand.name,
      domain: brand.domain,
      keywords: brand.keywords || '',
      managedDomains: wl,
      senderEmail: brand.senderEmail || '',
      smtpHost: brand.smtpHost || '',
      smtpPort: brand.smtpPort ? String(brand.smtpPort) : '',
      smtpUser: brand.smtpUser || '',
      smtpPass: brand.smtpPass || '',
    });
    setEditing(true);
    setSmtpOpen(false);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!brand) return;
    const managed = editForm.managedDomains
      .split(/[,;\n\r]+/)
      .map((d) => d.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, ''))
      .filter((d) => d.length > 0 && d.includes('.'));
    const allDomains = [editForm.domain, ...managed].filter(Boolean);
    const uniqueDomains = [...new Set(allDomains)];
    try {
      await updateBrand(brand.id, {
        name: editForm.name,
        domain: editForm.domain,
        keywords: editForm.keywords,
        whitelistDomains: uniqueDomains.join(','),
        senderEmail: editForm.senderEmail || null,
        smtpHost: editForm.smtpHost || null,
        smtpPort: editForm.smtpPort ? Number(editForm.smtpPort) : null,
        smtpUser: editForm.smtpUser || null,
        smtpPass: editForm.smtpPass || null,
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
                <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{brand.name}</h1>
                <p className="text-gray-500 dark:text-gray-400 font-mono text-sm mt-1">{brand.domain}</p>
                {brand.organization && (
                  <p className="text-xs text-gray-400 mt-1">🏢 {brand.organization.name}</p>
                )}
                {brand.senderEmail && (
                  <p className="text-xs text-green-600 mt-1">📧 {brand.senderEmail}</p>
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
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">管理ドメイン（任意）</label>
              <textarea className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100" rows={3} value={editForm.managedDomains} onChange={(e) => setEditForm({ ...editForm, managedDomains: e.target.value })} />
              <p className="text-xs text-gray-400 mt-1">自社管理ドメインを改行/カンマ区切りで。ホワイトリストに自動登録されます。</p>
            </div>

            {/* SMTP */}
            <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
              <button type="button" onClick={() => setSmtpOpen(!smtpOpen)} className="flex items-center gap-2 text-sm font-bold text-gray-700 dark:text-gray-200">
                <svg className={`w-4 h-4 transition-transform ${smtpOpen ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                📧 メール送信設定
              </button>
              {smtpOpen && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">送信元メール</label>
                    <input type="email" className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-900" value={editForm.senderEmail} onChange={(e) => setEditForm({ ...editForm, senderEmail: e.target.value })} placeholder="abuse@example.com" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">SMTPホスト</label>
                    <input type="text" className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-900" value={editForm.smtpHost} onChange={(e) => setEditForm({ ...editForm, smtpHost: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">SMTPポート</label>
                    <input type="number" className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-900" value={editForm.smtpPort} onChange={(e) => setEditForm({ ...editForm, smtpPort: e.target.value })} placeholder="587" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">SMTPユーザー</label>
                    <input type="text" className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-900" value={editForm.smtpUser} onChange={(e) => setEditForm({ ...editForm, smtpUser: e.target.value })} />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">SMTPパスワード</label>
                    <input type="password" className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-900" value={editForm.smtpPass} onChange={(e) => setEditForm({ ...editForm, smtpPass: e.target.value })} />
                  </div>
                </div>
              )}
            </div>

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
        <p className="text-xs text-gray-400 mt-2">プライマリ = 監視対象の本体ドメイン。保有 = 自社管理ドメイン（ホワイトリスト自動登録）。</p>

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

      {/* Recent Scans */}
      {stats && stats.recentScans.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-4">スキャン履歴</h2>
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
                {stats.recentScans.map((scan: any) => (
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
        </div>
      )}

      {/* Created at */}
      <div className="text-xs text-gray-400 text-right">
        登録日: {new Date(brand.createdAt).toLocaleDateString('ja-JP')}
      </div>
    </div>
  );
}
