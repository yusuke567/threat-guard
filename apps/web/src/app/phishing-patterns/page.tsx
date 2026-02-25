'use client';

import { useEffect, useState } from 'react';
import { getBrands, getPhishingPatterns, createPhishingPattern, updatePhishingPattern, deletePhishingPattern, applyPhishingPattern } from '@/lib/api';

const PATTERN_TYPES = [
  { value: 'domain_spoof', label: 'ドメイン偽装' },
  { value: 'email', label: 'メール' },
  { value: 'sms', label: 'SMS' },
  { value: 'social', label: 'SNS' },
  { value: 'clone_site', label: 'クローンサイト' },
  { value: 'other', label: 'その他' },
];

const SEVERITIES = [
  { value: 'low', label: '低', color: 'bg-gray-100 text-gray-700' },
  { value: 'medium', label: '中', color: 'bg-yellow-100 text-yellow-700' },
  { value: 'high', label: '高', color: 'bg-orange-100 text-orange-700' },
  { value: 'critical', label: '重大', color: 'bg-red-100 text-red-700' },
];

const STATUSES = [
  { value: 'new', label: '新規', color: 'bg-blue-100 text-blue-700' },
  { value: 'confirmed', label: '確認済', color: 'bg-green-100 text-green-700' },
  { value: 'rule_created', label: 'ルール反映済', color: 'bg-purple-100 text-purple-700' },
  { value: 'archived', label: 'アーカイブ', color: 'bg-gray-100 text-gray-500' },
];

export default function PhishingPatternsPage() {
  const [brands, setBrands] = useState<any[]>([]);
  const [selectedBrand, setSelectedBrand] = useState('');
  const [patterns, setPatterns] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    reportedBy: '',
    patternType: 'domain_spoof',
    url: '',
    domain: '',
    description: '',
    severity: 'medium',
    victimCount: 0,
  });

  useEffect(() => {
    getBrands().then((b) => {
      setBrands(b);
      if (b.length > 0) setSelectedBrand(b[0].id);
    });
  }, []);

  useEffect(() => {
    if (!selectedBrand) return;
    setLoading(true);
    getPhishingPatterns(selectedBrand, statusFilter || undefined)
      .then(setPatterns)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [selectedBrand, statusFilter]);

  const reload = () => {
    if (!selectedBrand) return;
    getPhishingPatterns(selectedBrand, statusFilter || undefined).then(setPatterns);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBrand || !form.description) return;
    await createPhishingPattern(selectedBrand, form);
    setShowForm(false);
    setForm({ reportedBy: '', patternType: 'domain_spoof', url: '', domain: '', description: '', severity: 'medium', victimCount: 0 });
    reload();
  };

  const handleStatusChange = async (id: string, status: string) => {
    await updatePhishingPattern(id, { status });
    reload();
  };

  const handleApply = async (id: string) => {
    const result = await applyPhishingPattern(id);
    alert(result.alreadyExisted ? '既に検知済みドメインに存在します' : '検知対象に追加しました');
    reload();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('削除しますか？')) return;
    await deletePhishingPattern(id);
    reload();
  };

  const getSeverityBadge = (s: string) => {
    const sev = SEVERITIES.find((x) => x.value === s);
    return sev ? <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${sev.color}`}>{sev.label}</span> : s;
  };

  const getStatusBadge = (s: string) => {
    const st = STATUSES.find((x) => x.value === s);
    return st ? <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${st.color}`}>{st.label}</span> : s;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">📋 ユーザー報告パターン</h1>
          <p className="text-gray-500 mt-1">ユーザーからヒアリングしたフィッシング手口</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
        >
          + 新規報告
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap gap-4">
        <select
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
          value={selectedBrand}
          onChange={(e) => setSelectedBrand(e.target.value)}
        >
          {brands.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
        <select
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">全ステータス</option>
          {STATUSES.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
      </div>

      {/* Create form */}
      {showForm && (
        <form onSubmit={handleCreate} className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <h2 className="text-lg font-semibold">新規パターン報告</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">報告者</label>
              <input
                type="text"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                placeholder="匿名可"
                value={form.reportedBy}
                onChange={(e) => setForm({ ...form, reportedBy: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">パターン種別</label>
              <select
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                value={form.patternType}
                onChange={(e) => setForm({ ...form, patternType: e.target.value })}
              >
                {PATTERN_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">フィッシングURL</label>
              <input
                type="text"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                placeholder="https://..."
                value={form.url}
                onChange={(e) => setForm({ ...form, url: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ドメイン</label>
              <input
                type="text"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                placeholder="自動抽出 or 手動入力"
                value={form.domain}
                onChange={(e) => setForm({ ...form, domain: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">重要度</label>
              <select
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                value={form.severity}
                onChange={(e) => setForm({ ...form, severity: e.target.value })}
              >
                {SEVERITIES.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">被害者数</label>
              <input
                type="number"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                min={0}
                value={form.victimCount}
                onChange={(e) => setForm({ ...form, victimCount: parseInt(e.target.value) || 0 })}
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">手口の説明 *</label>
            <textarea
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              rows={3}
              required
              placeholder="どのような手口でフィッシングが行われたか"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
          <div className="flex gap-2">
            <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium">
              登録
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm">
              キャンセル
            </button>
          </div>
        </form>
      )}

      {/* Pattern list */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        ) : patterns.length === 0 ? (
          <div className="text-center py-12 text-gray-500">報告されたパターンはありません</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">種別</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">ドメイン / URL</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">説明</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">重要度</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">ステータス</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">被害</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">報告日</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {patterns.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    {PATTERN_TYPES.find((t) => t.value === p.patternType)?.label || p.patternType}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs max-w-[200px] truncate">
                    {p.domain || p.url || '-'}
                  </td>
                  <td className="px-4 py-3 max-w-[250px] truncate">{p.description}</td>
                  <td className="px-4 py-3">{getSeverityBadge(p.severity)}</td>
                  <td className="px-4 py-3">{getStatusBadge(p.status)}</td>
                  <td className="px-4 py-3">{p.victimCount > 0 ? `${p.victimCount}名` : '-'}</td>
                  <td className="px-4 py-3 text-gray-500">{new Date(p.createdAt).toLocaleDateString('ja-JP')}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      {p.status === 'new' && (
                        <button
                          onClick={() => handleStatusChange(p.id, 'confirmed')}
                          className="px-2 py-1 text-xs bg-green-50 text-green-700 rounded hover:bg-green-100"
                        >
                          確認
                        </button>
                      )}
                      {p.domain && p.status !== 'rule_created' && (
                        <button
                          onClick={() => handleApply(p.id)}
                          className="px-2 py-1 text-xs bg-purple-50 text-purple-700 rounded hover:bg-purple-100"
                        >
                          検知反映
                        </button>
                      )}
                      {p.status !== 'archived' && (
                        <button
                          onClick={() => handleStatusChange(p.id, 'archived')}
                          className="px-2 py-1 text-xs bg-gray-50 text-gray-600 rounded hover:bg-gray-100"
                        >
                          📦
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(p.id)}
                        className="px-2 py-1 text-xs bg-red-50 text-red-600 rounded hover:bg-red-100"
                      >
                        🗑
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
