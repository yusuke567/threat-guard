'use client';

import { useEffect, useState } from 'react';
import { PageHeader, Button, Card, Alert, useToast } from '@/components/ui';
import Image from 'next/image';
import { getBrands, createBrand, updateBrand, deleteBrand, triggerScan, getOrganizations, createOrganization, importBrandsCSV } from '@/lib/api';

/* ──── Monitoring status helpers ──── */
const MONITORING_STATUS: Record<string, { label: string; color: string; dot: string }> = {
  active: { label: '監視中', color: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300', dot: 'bg-green-500' },
  running: { label: 'スキャン中', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300', dot: 'bg-blue-500 animate-pulse' },
  error: { label: 'エラー', color: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300', dot: 'bg-red-500' },
  inactive: { label: '未監視', color: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300', dot: 'bg-gray-400' },
};

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

export default function BrandsPage() {
  const toast = useToast();
  const [brands, setBrands] = useState<any[]>([]);
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [scanning, setScanning] = useState<string | null>(null);
  const [editingBrand, setEditingBrand] = useState<any | null>(null);
  const [editForm, setEditForm] = useState({ name: '', domain: '', keywords: '' });
  const [scanNotice, setScanNotice] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '',
    domain: '',
    organizationId: '',
    newOrgName: '',
    keywords: '',
  });
  const [showCsvImport, setShowCsvImport] = useState(false);
  const [csvText, setCsvText] = useState('');
  const [csvImporting, setCsvImporting] = useState(false);

  const loadBrands = () => {
    getBrands()
      .then(setBrands)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadBrands();
    getOrganizations().then(setOrganizations).catch(console.error);
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Resolve organization: use existing or create new
      let orgId = form.organizationId;
      if (!orgId && form.newOrgName.trim()) {
        const newOrg = await createOrganization(form.newOrgName.trim());
        orgId = newOrg.id;
        setOrganizations((prev) => [...prev, newOrg]);
      }
      if (!orgId) { toast.warning('組織を選択するか、新しい組織名を入力してください'); return; }

      await createBrand({
        name: form.name,
        domain: form.domain,
        organizationId: orgId,
        keywords: form.keywords,
        whitelistDomains: form.domain, // Primary domain as initial whitelist
      });
      setScanNotice(`🔍 「${form.name}」を登録しました。初回ドメイン調査を自動開始します。保有ドメインはブランド詳細ページで追加できます。`);
      setTimeout(() => setScanNotice(null), 15000);
      setShowForm(false);
      setForm({ name: '', domain: '', organizationId: '', newOrgName: '', keywords: '' });
      loadBrands();
    } catch (e) {
      console.error(e);
    }
  };

  const handleScan = async (brandId: string, type: string) => {
    setScanning(brandId);
    try {
      await triggerScan(brandId, type);
      toast.success('スキャンを開始しました');
    } catch (e) {
      console.error(e);
    } finally {
      setScanning(null);
    }
  };

  const startEdit = (brand: any) => {
    setEditingBrand(brand);
    setEditForm({
      name: brand.name,
      domain: brand.domain,
      keywords: Array.isArray(brand.keywords) ? brand.keywords.join(', ') : (brand.keywords || ''),
    });
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBrand) return;
    try {
      await updateBrand(editingBrand.id, {
        name: editForm.name,
        domain: editForm.domain,
        keywords: editForm.keywords,
      });
      setEditingBrand(null);
      loadBrands();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('このブランドを削除しますか？')) return;
    await deleteBrand(id);
    loadBrands();
  };

  const handleCsvImport = async () => {
    if (!csvText.trim()) return;
    setCsvImporting(true);
    try {
      const result = await importBrandsCSV(csvText);
      const msg = `インポート完了: ${result.created}件登録${result.errors > 0 ? `、${result.errors}件エラー` : ''}`;
      if (result.created > 0) {
        setScanNotice(`${msg}\n初回ドメイン調査を自動開始しました。`);
        setTimeout(() => setScanNotice(null), 15000);
      } else {
        toast.info(msg);
      }
      if (result.errors > 0 && result.errorDetails.length > 0) {
        console.log('CSV Import Errors:', result.errorDetails);
      }
      setShowCsvImport(false);
      setCsvText('');
      loadBrands();
    } catch (err: any) {
      toast.error(err.message || 'インポートに失敗しました');
    } finally {
      setCsvImporting(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      setCsvText(event.target?.result as string || '');
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="ブランド管理"
        description="監視対象のブランドを管理"
        actions={
          <>
            <Button variant="ghost" onClick={() => setShowCsvImport(!showCsvImport)}>
              CSV一括登録
            </Button>
            <Button onClick={() => setShowForm(!showForm)}>
              + ブランド追加
            </Button>
          </>
        }
      />

      {/* Scan triggered notice */}
      {scanNotice && (
        <Alert variant="info" className="flex items-start gap-2 px-4 py-3">
          <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-600 border-t-transparent flex-shrink-0 mt-0.5" />
          <p className="text-sm whitespace-pre-line">{scanNotice}</p>
        </Alert>
      )}

      {/* CSV Import Form */}
      {showCsvImport && (
        <Card className="space-y-4">
          <h2 className="text-lg font-bold">CSV一括インポート</h2>
          <div className="text-sm text-[var(--text-secondary)] space-y-2">
            <p>CSVファイルまたはテキストで複数のブランドを一括登録できます。</p>
            <p className="font-medium">必須列: name（ブランド名）, domain（ドメイン）</p>
            <p>対応列: name, domain, keywords, organizationName</p>
            <p className="text-xs text-gray-500">※ 日本語ヘッダーにも対応: ブランド名, ドメイン, キーワード, 組織名</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">CSVファイルを選択</label>
            <input
              type="file"
              accept=".csv,.txt"
              onChange={handleFileUpload}
              className="block w-full text-sm text-[var(--text-secondary)] file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 dark:file:bg-blue-900/30 file:text-blue-700 dark:file:text-blue-300 hover:file:bg-blue-100 dark:hover:file:bg-blue-900/50"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">またはCSVテキストを直接入力</label>
            <textarea
              className="w-full border border-[var(--border-default)] rounded-lg px-3 py-2 text-sm font-mono bg-white dark:bg-gray-900 text-[var(--text-primary)]"
              rows={8}
              placeholder={`name,domain,keywords
MyBrand,mybrand.com,マイブランド,my-brand
AnotherBrand,another.co.jp,アナザー`}
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <Button onClick={handleCsvImport} disabled={csvImporting || !csvText.trim()}>
              {csvImporting ? 'インポート中...' : 'インポート実行'}
            </Button>
            <Button variant="ghost" onClick={() => { setShowCsvImport(false); setCsvText(''); }}>
              キャンセル
            </Button>
          </div>
        </Card>
      )}

      {/* Create Form */}
      {showForm && (
        <Card>
        <form onSubmit={handleCreate} className="space-y-4">
          <h2 className="text-lg font-bold">新規ブランド登録</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">ブランド名</label>
              <input
                type="text"
                required
                className="w-full border border-[var(--border-default)] rounded-lg px-3 py-2 text-sm"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="例: MyBrand"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">ドメイン</label>
              <input
                type="text"
                required
                className="w-full border border-[var(--border-default)] rounded-lg px-3 py-2 text-sm"
                value={form.domain}
                onChange={(e) => setForm({ ...form, domain: e.target.value })}
                placeholder="例: mybrand.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">組織</label>
              {organizations.length > 0 ? (
                <select
                  className="w-full border border-[var(--border-default)] rounded-lg px-3 py-2 text-sm"
                  value={form.organizationId}
                  onChange={(e) => setForm({ ...form, organizationId: e.target.value, newOrgName: '' })}
                >
                  <option value="">既存の組織を選択</option>
                  {organizations.map((org) => (
                    <option key={org.id} value={org.id}>{org.name}</option>
                  ))}
                </select>
              ) : null}
              {!form.organizationId && (
                <input
                  type="text"
                  className={`w-full border border-[var(--border-default)] rounded-lg px-3 py-2 text-sm ${organizations.length > 0 ? 'mt-2' : ''}`}
                  value={form.newOrgName}
                  onChange={(e) => setForm({ ...form, newOrgName: e.target.value })}
                  placeholder="新しい組織名を入力（例: 株式会社〇〇）"
                />
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">検知キーワード（カンマ区切り）</label>
              <input
                type="text"
                className="w-full border border-[var(--border-default)] rounded-lg px-3 py-2 text-sm"
                value={form.keywords}
                onChange={(e) => setForm({ ...form, keywords: e.target.value })}
                placeholder="例: マイブランド, mybrand, my-brand"
              />
              <p className="text-xs text-[var(--text-tertiary)] mt-1">
                ブランドの別名・略称・日本語名など。なりすましドメインの検知精度が上がります。
              </p>
            </div>
          </div>
          <p className="text-xs text-[var(--text-tertiary)]">
            保有ドメイン・メール送信設定は、ブランド登録後に詳細ページで設定できます。
          </p>
          <div className="flex gap-2">
            <Button type="submit">登録</Button>
            <Button variant="ghost" type="button" onClick={() => setShowForm(false)}>キャンセル</Button>
          </div>
        </form>
        </Card>
      )}

      {/* Brand List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : brands.length === 0 ? (
        <Card className="!p-12 text-center text-[var(--text-secondary)]">
          まだブランドが登録されていません
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {brands.map((brand: any) => (
            <Card key={brand.id}>
              {editingBrand?.id === brand.id ? (
                <form onSubmit={handleUpdate} className="space-y-4">
                  <h3 className="text-lg font-bold">ブランド編集</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">ブランド名</label>
                      <input
                        type="text"
                        required
                        className="w-full border border-[var(--border-default)] rounded-lg px-3 py-2 text-sm"
                        value={editForm.name}
                        onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">ドメイン</label>
                      <input
                        type="text"
                        required
                        className="w-full border border-[var(--border-default)] rounded-lg px-3 py-2 text-sm"
                        value={editForm.domain}
                        onChange={(e) => setEditForm({ ...editForm, domain: e.target.value })}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">検知キーワード（カンマ区切り）</label>
                    <input
                      type="text"
                      className="w-full border border-[var(--border-default)] rounded-lg px-3 py-2 text-sm"
                      value={editForm.keywords}
                      onChange={(e) => setEditForm({ ...editForm, keywords: e.target.value })}
                    />
                  </div>
                  <p className="text-xs text-[var(--text-tertiary)]">
                    保有ドメイン・メール送信設定は<a href={`/brands/${brand.id}`} className="text-blue-600 hover:underline">ブランド詳細ページ</a>で管理できます。
                  </p>
                  <div className="flex gap-2">
                    <Button type="submit">保存</Button>
                    <Button variant="ghost" type="button" onClick={() => setEditingBrand(null)}>キャンセル</Button>
                  </div>
                </form>
              ) : (
                <>
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      {brand.logoUrl ? (
                        <Image src={brand.logoUrl} alt={brand.name} width={40} height={40} className="rounded-lg object-contain border border-[var(--border-default)] flex-shrink-0" unoptimized />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-surface-elevated flex items-center justify-center flex-shrink-0">
                          <span className="text-lg text-gray-400">🏢</span>
                        </div>
                      )}
                      <div>
                        <a href={`/brands/${brand.id}`} className="font-bold text-lg hover:text-blue-600 transition-colors">{brand.name}</a>
                      <p className="text-[var(--text-secondary)] text-sm font-mono">{brand.domain}</p>
                      {brand.senderEmail && (
                        <p className="text-xs text-green-600 mt-1">📧 {brand.senderEmail}</p>
                      )}
                      {brand.keywords && String(brand.keywords).length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {String(brand.keywords).split(',').filter(Boolean).map((kw: string) => (
                            <span key={kw} className="px-2 py-0.5 bg-surface-elevated rounded text-xs">{kw.trim()}</span>
                          ))}
                        </div>
                      )}
                      {/* Last scan info */}
                      {brand.lastScan && (
                        <p className="text-xs text-gray-400 mt-2">
                          🕐 最終スキャン: {formatRelativeTime(brand.lastScan.completedAt || brand.lastScan.startedAt)}
                          {brand.lastScan.findingsCount > 0 && (
                            <span className="ml-1 text-orange-500">（{brand.lastScan.findingsCount}件検出）</span>
                          )}
                        </p>
                      )}
                      </div>
                    </div>
                    <div className="text-right space-y-2">
                      <div>
                        <div className="text-2xl font-bold text-blue-600">
                          {brand._count?.detectedDomains ?? 0}
                        </div>
                        <div className="text-xs text-[var(--text-secondary)]">検知数</div>
                      </div>
                      {/* Monitoring Status Badge */}
                      {(() => {
                        const status = MONITORING_STATUS[brand.monitoringStatus] || MONITORING_STATUS.inactive;
                        return (
                          <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${status.color}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
                            {status.label}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-[var(--border-subtle)]">
                    <button
                      onClick={() => handleScan(brand.id, 'ct_monitor')}
                      disabled={scanning === brand.id}
                      className="px-3 py-1.5 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-lg text-xs font-medium hover:bg-blue-100 disabled:opacity-50"
                    >
                      🔍 CT監視スキャン
                    </button>
                    <button
                      onClick={() => handleScan(brand.id, 'domain_generation')}
                      disabled={scanning === brand.id}
                      className="px-3 py-1.5 bg-purple-50 text-purple-700 rounded-lg text-xs font-medium hover:bg-purple-100 disabled:opacity-50"
                    >
                      🔤 類似ドメインスキャン
                    </button>
                    <button
                      onClick={() => startEdit(brand)}
                      className="px-3 py-1.5 bg-gray-50 dark:bg-gray-900 text-[var(--text-primary)] rounded-lg text-xs font-medium hover:bg-surface-elevated"
                    >
                      ✏️ 編集
                    </button>
                    <button
                      onClick={() => handleDelete(brand.id)}
                      className="px-3 py-1.5 text-red-600 hover:bg-red-50 dark:bg-red-900/30 rounded-lg text-xs font-medium ml-auto"
                    >
                      削除
                    </button>
                  </div>
                </>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
