'use client';

import { useEffect, useState } from 'react';
import { getBrands, createBrand, deleteBrand, triggerScan, getOrganizations, createOrganization } from '@/lib/api';

export default function BrandsPage() {
  const [brands, setBrands] = useState<any[]>([]);
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [scanning, setScanning] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '',
    domain: '',
    organizationId: '',
    newOrgName: '',
    keywords: '',
    managedDomains: '',
  });

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
      if (!orgId) return alert('組織を選択するか、新しい組織名を入力してください');

      // Merge primary domain + managed domains into whitelistDomains
      const managed = form.managedDomains
        .split(/[,;\n\r]+/)
        .map((d) => d.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, ''))
        .filter((d) => d.length > 0 && d.includes('.'));
      const allDomains = [form.domain, ...managed].filter(Boolean);
      const uniqueDomains = [...new Set(allDomains)];

      await createBrand({
        name: form.name,
        domain: form.domain,
        organizationId: orgId,
        keywords: form.keywords,
        whitelistDomains: uniqueDomains.join(','),
      });
      setShowForm(false);
      setForm({ name: '', domain: '', organizationId: '', newOrgName: '', keywords: '', managedDomains: '' });
      loadBrands();
    } catch (e) {
      console.error(e);
    }
  };

  const handleScan = async (brandId: string, type: string) => {
    setScanning(brandId);
    try {
      await triggerScan(brandId, type);
      alert('スキャンを開始しました');
    } catch (e) {
      console.error(e);
    } finally {
      setScanning(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('このブランドを削除しますか？')) return;
    await deleteBrand(id);
    loadBrands();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">ブランド管理</h1>
          <p className="text-gray-500 mt-1">監視対象のブランドを管理</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
        >
          + ブランド追加
        </button>
      </div>

      {/* Create Form */}
      {showForm && (
        <form onSubmit={handleCreate} className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <h2 className="text-lg font-bold">新規ブランド登録</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ブランド名</label>
              <input
                type="text"
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="例: MyBrand"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ドメイン</label>
              <input
                type="text"
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                value={form.domain}
                onChange={(e) => setForm({ ...form, domain: e.target.value })}
                placeholder="例: mybrand.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">組織</label>
              {organizations.length > 0 ? (
                <select
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
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
                  className={`w-full border border-gray-300 rounded-lg px-3 py-2 text-sm ${organizations.length > 0 ? 'mt-2' : ''}`}
                  value={form.newOrgName}
                  onChange={(e) => setForm({ ...form, newOrgName: e.target.value })}
                  placeholder="新しい組織名を入力（例: 株式会社〇〇）"
                />
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">検知キーワード（カンマ区切り）</label>
              <input
                type="text"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                value={form.keywords}
                onChange={(e) => setForm({ ...form, keywords: e.target.value })}
                placeholder="例: コインチェック, coinchk, coin-check"
              />
              <p className="text-xs text-gray-400 mt-1">
                ブランドの別名・略称・日本語名など。なりすましドメインの検知精度が上がります。
              </p>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">管理ドメイン（任意）</label>
            <textarea
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              rows={3}
              value={form.managedDomains}
              onChange={(e) => setForm({ ...form, managedDomains: e.target.value })}
              placeholder={"例:\ncoincheck.jp\ncoincheck.co.jp\ncoincheck.net"}
            />
            <p className="text-xs text-gray-400 mt-1">
              自社で管理しているドメインを入力（カンマ・改行区切り）。ホワイトリストに自動登録され、誤検知を防ぎます。
            </p>
          </div>
          <div className="flex gap-2">
            <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
              登録
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 border rounded-lg text-sm">
              キャンセル
            </button>
          </div>
        </form>
      )}

      {/* Brand List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : brands.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-500">
          まだブランドが登録されていません
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {brands.map((brand: any) => (
            <div key={brand.id} className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-bold text-lg">{brand.name}</h3>
                  <p className="text-gray-500 text-sm font-mono">{brand.domain}</p>
                  {brand.keywords && brand.keywords.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {(Array.isArray(brand.keywords) ? brand.keywords : brand.keywords.split(',')).map((kw: string) => (
                        <span key={kw} className="px-2 py-0.5 bg-gray-100 rounded text-xs">{kw.trim()}</span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-blue-600">
                    {brand._count?.detectedDomains ?? 0}
                  </div>
                  <div className="text-xs text-gray-500">検知数</div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-gray-100">
                <button
                  onClick={() => handleScan(brand.id, 'ct_monitor')}
                  disabled={scanning === brand.id}
                  className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-xs font-medium hover:bg-blue-100 disabled:opacity-50"
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
                  onClick={() => handleDelete(brand.id)}
                  className="px-3 py-1.5 text-red-600 hover:bg-red-50 rounded-lg text-xs font-medium ml-auto"
                >
                  削除
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
