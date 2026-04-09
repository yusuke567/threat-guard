'use client';

import { useEffect, useState } from 'react';
import { PageHeader, Button, useToast } from '@/components/ui';
import { getBrands, getPhishingPatterns, createPhishingPattern, updatePhishingPattern, deletePhishingPattern, applyPhishingPattern, importPhishingPatternsCSV } from '@/lib/api';

const PATTERN_TYPES = [
  { value: 'domain_spoof', label: 'ドメイン偽装' },
  { value: 'email', label: 'メール' },
  { value: 'sms', label: 'SMS' },
  { value: 'social', label: 'SNS' },
  { value: 'clone_site', label: 'クローンサイト' },
  { value: 'other', label: 'その他' },
];

const SEVERITIES = [
  { value: 'low', label: '低', color: 'bg-surface-elevated text-[var(--text-primary)]' },
  { value: 'medium', label: '中', color: 'bg-yellow-100 text-yellow-700 dark:text-yellow-300' },
  { value: 'high', label: '高', color: 'bg-orange-100 text-orange-700 dark:text-orange-300' },
  { value: 'critical', label: '重大', color: 'bg-red-100 text-red-700 dark:text-red-300' },
];

const STATUSES = [
  { value: 'new', label: '新規', color: 'bg-blue-100 text-blue-700 dark:text-blue-300' },
  { value: 'confirmed', label: '確認済', color: 'bg-green-100 text-green-700 dark:text-green-300' },
  { value: 'rule_created', label: 'ルール反映済', color: 'bg-purple-100 text-purple-700' },
  { value: 'archived', label: 'アーカイブ', color: 'bg-surface-elevated text-[var(--text-secondary)]' },
];

export default function PhishingPatternsPage() {
  const toast = useToast();
  const [brands, setBrands] = useState<any[]>([]);
  const [selectedBrand, setSelectedBrand] = useState('');
  const [patterns, setPatterns] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [showCsvImport, setShowCsvImport] = useState(false);
  const [csvText, setCsvText] = useState('');
  const [csvImporting, setCsvImporting] = useState(false);
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
    toast.info(result.alreadyExisted ? '既に検知済みドメインに存在します' : '検知対象に追加しました');
    reload();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('削除しますか？')) return;
    await deletePhishingPattern(id);
    reload();
  };

  const handleCsvImport = async () => {
    if (!selectedBrand || !csvText.trim()) return;
    setCsvImporting(true);
    try {
      const result = await importPhishingPatternsCSV(selectedBrand, csvText);
      toast.success(`インポート完了: ${result.created}件登録${result.errors > 0 ? `、${result.errors}件エラー` : ''}`);
      setShowCsvImport(false);
      setCsvText('');
      reload();
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
      <PageHeader
        title="📋 ユーザー報告パターン"
        description="ユーザーからヒアリングしたフィッシング手口"
        actions={
          <>
            <button
              onClick={() => setShowCsvImport(!showCsvImport)}
              className="px-4 py-2 border border-[var(--border-default)] text-[var(--text-primary)] rounded-lg hover:bg-surface-elevated text-sm font-medium"
            >
              CSV一括登録
            </button>
            <Button
              onClick={() => setShowForm(!showForm)}
            >
              + 新規報告
            </Button>
          </>
        }
      />

      {/* Filters */}
      <div className="bg-surface-card rounded-xl border border-[var(--border-default)] p-4 flex flex-wrap gap-4">
        <select
          className="border border-[var(--border-default)] rounded-lg px-3 py-2 text-sm"
          value={selectedBrand}
          onChange={(e) => setSelectedBrand(e.target.value)}
        >
          {brands.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
        <select
          className="border border-[var(--border-default)] rounded-lg px-3 py-2 text-sm"
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
        <form onSubmit={handleCreate} className="bg-surface-card rounded-xl border border-[var(--border-default)] p-6 space-y-4">
          <h2 className="text-lg font-semibold">新規パターン報告</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">報告者</label>
              <input
                type="text"
                className="w-full border border-[var(--border-default)] rounded-lg px-3 py-2 text-sm"
                placeholder="匿名可"
                value={form.reportedBy}
                onChange={(e) => setForm({ ...form, reportedBy: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">パターン種別</label>
              <select
                className="w-full border border-[var(--border-default)] rounded-lg px-3 py-2 text-sm"
                value={form.patternType}
                onChange={(e) => setForm({ ...form, patternType: e.target.value })}
              >
                {PATTERN_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">フィッシングURL</label>
              <input
                type="text"
                className="w-full border border-[var(--border-default)] rounded-lg px-3 py-2 text-sm"
                placeholder="https://..."
                value={form.url}
                onChange={(e) => setForm({ ...form, url: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">ドメイン</label>
              <input
                type="text"
                className="w-full border border-[var(--border-default)] rounded-lg px-3 py-2 text-sm"
                placeholder="自動抽出 or 手動入力"
                value={form.domain}
                onChange={(e) => setForm({ ...form, domain: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">重要度</label>
              <select
                className="w-full border border-[var(--border-default)] rounded-lg px-3 py-2 text-sm"
                value={form.severity}
                onChange={(e) => setForm({ ...form, severity: e.target.value })}
              >
                {SEVERITIES.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">被害者数</label>
              <input
                type="number"
                className="w-full border border-[var(--border-default)] rounded-lg px-3 py-2 text-sm"
                min={0}
                value={form.victimCount}
                onChange={(e) => setForm({ ...form, victimCount: parseInt(e.target.value) || 0 })}
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">手口の説明 *</label>
            <textarea
              className="w-full border border-[var(--border-default)] rounded-lg px-3 py-2 text-sm"
              rows={3}
              required
              placeholder="どのような手口でフィッシングが行われたか"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
          <div className="flex gap-2">
            <Button type="submit">
              登録
            </Button>
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 border border-[var(--border-default)] rounded-lg text-sm">
              キャンセル
            </button>
          </div>
        </form>
      )}

      {/* CSV Import form */}
      {showCsvImport && (
        <div className="bg-surface-card rounded-xl border border-[var(--border-default)] p-6 space-y-4">
          <h2 className="text-lg font-semibold">CSV一括インポート</h2>
          <div className="text-sm text-[var(--text-secondary)] space-y-2">
            <p>CSVファイルまたはテキストで複数のパターンを一括登録できます。</p>
            <p className="font-medium">必須列: description（説明）</p>
            <p>対応列: reportedBy, patternType, url, domain, description, severity, victimCount, tags</p>
            <p className="text-xs text-[var(--text-tertiary)]">※ patternType: domain_spoof, email, sms, social, clone_site, other</p>
            <p className="text-xs text-[var(--text-tertiary)]">※ severity: low, medium, high, critical</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">CSVファイルを選択</label>
            <input
              type="file"
              accept=".csv,.txt"
              onChange={handleFileUpload}
              className="block w-full text-sm text-[var(--text-secondary)] file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">またはCSVテキストを直接入力</label>
            <textarea
              className="w-full border border-[var(--border-default)] rounded-lg px-3 py-2 text-sm font-mono"
              rows={8}
              placeholder={`patternType,url,domain,description,severity,victimCount
domain_spoof,https://example-phish.com,,フィッシングサイト,high,5
email,,,不審なメール報告,medium,0`}
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <Button
              onClick={handleCsvImport}
              disabled={csvImporting || !csvText.trim()}
            >
              {csvImporting ? 'インポート中...' : 'インポート実行'}
            </Button>
            <button
              onClick={() => { setShowCsvImport(false); setCsvText(''); }}
              className="px-4 py-2 border border-[var(--border-default)] rounded-lg text-sm"
            >
              キャンセル
            </button>
          </div>
        </div>
      )}

      {/* Pattern list */}
      <div className="bg-surface-card rounded-xl border border-[var(--border-default)] overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        ) : patterns.length === 0 ? (
          <div className="text-center py-12 text-[var(--text-secondary)]">報告されたパターンはありません</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-surface-base border-b border-[var(--border-default)]">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-[var(--text-secondary)]">種別</th>
                <th className="text-left px-4 py-3 font-medium text-[var(--text-secondary)]">ドメイン / URL</th>
                <th className="text-left px-4 py-3 font-medium text-[var(--text-secondary)]">説明</th>
                <th className="text-left px-4 py-3 font-medium text-[var(--text-secondary)]">重要度</th>
                <th className="text-left px-4 py-3 font-medium text-[var(--text-secondary)]">ステータス</th>
                <th className="text-left px-4 py-3 font-medium text-[var(--text-secondary)]">被害</th>
                <th className="text-left px-4 py-3 font-medium text-[var(--text-secondary)]">報告日</th>
                <th className="text-left px-4 py-3 font-medium text-[var(--text-secondary)]">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]">
              {patterns.map((p) => (
                <tr key={p.id} className="hover:bg-surface-elevated">
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
                  <td className="px-4 py-3 text-[var(--text-secondary)]">{new Date(p.createdAt).toLocaleDateString('ja-JP')}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      {p.status === 'new' && (
                        <button
                          onClick={() => handleStatusChange(p.id, 'confirmed')}
                          className="px-2 py-1 text-xs bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded hover:bg-green-100 dark:hover:bg-green-900/50 transition-colors"
                          title="報告内容を確認済みとしてマーク"
                        >
                          確認済にする
                        </button>
                      )}
                      {p.domain && p.status !== 'rule_created' && (
                        <button
                          onClick={() => handleApply(p.id)}
                          className="px-2 py-1 text-xs bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded hover:bg-purple-100 dark:hover:bg-purple-900/50 transition-colors"
                          title="このドメインを検知ルールに追加"
                        >
                          検知反映
                        </button>
                      )}
                      {p.status !== 'archived' && (
                        <button
                          onClick={() => handleStatusChange(p.id, 'archived')}
                          className="px-2 py-1 text-xs bg-surface-base text-[var(--text-secondary)] rounded hover:bg-surface-elevated transition-colors"
                          title="この報告をアーカイブ"
                        >
                          アーカイブ
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(p.id)}
                        className="px-2 py-1 text-xs bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors"
                        title="この報告を削除"
                      >
                        削除
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
