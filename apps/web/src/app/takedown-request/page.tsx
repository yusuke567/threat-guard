'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { getBulkAbuseContacts, generateBatchTemplate, submitBatchTakedown } from '@/lib/api';

// ─── Types ───────────────────────────────────────────────────────────────────
interface ThreatInfo {
  threatId: string;
  domain: string;
  riskScore: number | null;
  category: string;
  categoryDescription: string;
  brandName: string;
  brandDomain: string;
  registrar: string;
  abuseEmail: string | null;
  source: string;
  screenshotUrl: string | null;
}

interface AbuseGroup {
  abuseEmail: string | null;
  registrar: string;
  threats: ThreatInfo[];
  // Step 2 fields
  template?: string;
  language?: string;
  evidenceTypes?: string[];
  manualEmail?: string;
  loading?: boolean;
}

const riskColors: Record<string, string> = {
  critical: 'bg-red-100 text-red-800',
  high: 'bg-orange-100 text-orange-800',
  medium: 'bg-yellow-100 text-yellow-800',
  low: 'bg-green-100 text-green-800',
};

function getRiskLevel(score: number | null): { label: string; color: string } {
  if (score === null) return { label: '—', color: 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 dark:text-gray-500' };
  if (score >= 80) return { label: '🔴 危険', color: riskColors.critical };
  if (score >= 60) return { label: '🟠 高', color: riskColors.high };
  if (score >= 40) return { label: '🟡 中', color: riskColors.medium };
  return { label: '🟢 低', color: riskColors.low };
}

// ─── Component ───────────────────────────────────────────────────────────────
export default function TakedownRequestPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1
  const [threats, setThreats] = useState<ThreatInfo[]>([]);
  const [groups, setGroups] = useState<AbuseGroup[]>([]);
  const [excludedIds, setExcludedIds] = useState<Set<string>>(new Set());

  // Step 3 result
  const [result, setResult] = useState<any>(null);

  // Load threat data on mount
  useEffect(() => {
    const stored = sessionStorage.getItem('takedown_threat_ids');
    if (!stored) {
      router.push('/');
      return;
    }
    const ids: string[] = JSON.parse(stored);
    if (ids.length === 0) {
      router.push('/');
      return;
    }

    getBulkAbuseContacts(ids)
      .then((data) => {
        setThreats(data.threats);
        setGroups(data.groups.map((g: any) => ({
          ...g,
          language: 'ja',
          evidenceTypes: ['screenshot'],
          template: '',
          manualEmail: '',
        })));
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [router]);

  const activeThreats = threats.filter((t) => !excludedIds.has(t.threatId));
  const activeGroups = groups
    .map((g, originalIndex) => ({
      ...g,
      originalIndex,
      threats: g.threats.filter((t) => !excludedIds.has(t.threatId)),
    }))
    .filter((g) => g.threats.length > 0);

  const unresolvedCount = activeGroups.filter((g) => !g.abuseEmail && !g.manualEmail).length;

  // Step 2: Generate templates for all groups
  const generateTemplates = useCallback(async () => {
    const updated = [...groups];
    for (let i = 0; i < updated.length; i++) {
      const g = updated[i];
      const activeInGroup = g.threats.filter((t) => !excludedIds.has(t.threatId));
      if (activeInGroup.length === 0) continue;

      const email = g.abuseEmail || g.manualEmail;
      if (!email) continue;

      updated[i] = { ...g, loading: true };
      setGroups([...updated]);

      try {
        const res = await generateBatchTemplate({
          threatIds: activeInGroup.map((t) => t.threatId),
          abuseEmail: email,
          registrar: g.registrar,
          language: g.language || 'ja',
        });
        updated[i] = { ...updated[i], template: res.template, loading: false };
      } catch {
        updated[i] = { ...updated[i], template: '(テンプレート生成に失敗しました。手動で入力してください。)', loading: false };
      }
      setGroups([...updated]);
    }
  }, [groups, excludedIds]);

  // Move to step 2
  const goToStep2 = async () => {
    setStep(2);
    await generateTemplates();
  };

  // Submit (Step 3 → send)
  const handleSubmit = async () => {
    setSending(true);
    setError(null);
    try {
      const items: Array<{ threatId: string; abuseEmail: string; template: string; language: string; evidenceTypes: string }> = [];
      for (const g of activeGroups) {
        const email = g.abuseEmail || g.manualEmail;
        if (!email || !g.template) continue;
        for (const t of g.threats) {
          items.push({
            threatId: t.threatId,
            abuseEmail: email,
            template: g.template,
            language: g.language || 'en',
            evidenceTypes: (g.evidenceTypes || []).join(','),
          });
        }
      }

      if (items.length === 0) {
        setError('送信可能な申請がありません。送信先メールアドレスと文面を確認してください。');
        setSending(false);
        return;
      }

      const res = await submitBatchTakedown(items);
      setResult(res);
      sessionStorage.removeItem('takedown_threat_ids');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  // ─── Render ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  // ─── Result Screen ────────────────────────────────────────────────────────
  if (result) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-8 text-center">
          <div className="text-5xl mb-4">✅</div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">削除申請を送信しました</h1>
          <p className="text-gray-600 dark:text-gray-300 mb-6">
            {result.sentCount}/{result.totalCount}件のメールを送信しました。
          </p>
          {result.errors?.length > 0 && (
            <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-4 text-left mb-6">
              <p className="text-sm font-medium text-red-800 mb-2">⚠️ 一部送信に失敗しました:</p>
              {result.errors.map((e: any, i: number) => (
                <p key={i} className="text-sm text-red-600">{e.error}</p>
              ))}
            </div>
          )}
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => router.push('/takedowns')}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
            >
              進捗を確認する
            </button>
            <button
              onClick={() => router.push('/')}
              className="px-6 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg font-medium hover:bg-gray-200 dark:hover:bg-gray-600 dark:bg-gray-600"
            >
              脅威一覧に戻る
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header + Progress */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">削除申請</h1>
        <p className="text-gray-500 dark:text-gray-400 dark:text-gray-500 mt-1">選択した脅威の管理会社に削除を依頼します</p>
      </div>

      {/* Progress Bar */}
      <div className="flex items-center gap-2">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex items-center gap-2 flex-1">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
              step >= s ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-600 text-gray-500 dark:text-gray-400 dark:text-gray-500'
            }`}>
              {s}
            </div>
            <span className={`text-sm ${step >= s ? 'text-blue-600 font-medium' : 'text-gray-400 dark:text-gray-500'}`}>
              {s === 1 ? '対象確認' : s === 2 ? '申請内容' : '確認・送信'}
            </span>
            {s < 3 && <div className={`flex-1 h-0.5 ${step > s ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-600'}`} />}
          </div>
        ))}
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-4 text-sm text-red-800">
          ⚠️ {error}
        </div>
      )}

      {/* ─── Step 1: 対象確認 ─── */}
      {step === 1 && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-1">申請対象: {activeThreats.length}件</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 mb-4">削除を申請する脅威を確認してください。不要な場合は✕で除外できます。</p>

            <div className="space-y-2">
              {threats.map((t) => {
                const excluded = excludedIds.has(t.threatId);
                const risk = getRiskLevel(t.riskScore);
                return (
                  <div
                    key={t.threatId}
                    className={`flex items-center gap-4 p-3 rounded-lg border ${
                      excluded ? 'opacity-40 bg-gray-50 dark:bg-gray-900 border-gray-100 dark:border-gray-700' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                    }`}
                  >
                    <button
                      onClick={() => {
                        const next = new Set(excludedIds);
                        if (excluded) next.delete(t.threatId);
                        else next.add(t.threatId);
                        setExcludedIds(next);
                      }}
                      className="text-gray-400 dark:text-gray-500 hover:text-red-500 text-lg font-bold w-6"
                      title={excluded ? '戻す' : '除外'}
                    >
                      {excluded ? '↩' : '✕'}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="font-mono text-sm font-medium truncate">{t.domain}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500">{t.categoryDescription}</div>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${risk.color}`}>
                      {risk.label}
                    </span>
                    <div className="text-right text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 min-w-[180px]">
                      <div>→ {t.registrar}</div>
                      <div className="text-gray-400 dark:text-gray-500">
                        {t.abuseEmail ? `(${t.abuseEmail})` : '送信先を手動入力'}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 送信先まとめ */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="font-bold text-gray-900 dark:text-gray-100 mb-3">送信先まとめ</h3>
            {activeGroups.map((g, i) => (
              <div key={i} className="flex items-center gap-3 py-2">
                <span>📧</span>
                <span className="font-medium text-sm">{g.registrar}</span>
                {g.abuseEmail ? (
                  <span className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500">({g.abuseEmail})</span>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-orange-600">⚠️ 送信先を入力してください</span>
                    <input
                      type="email"
                      placeholder="abuse@example.com"
                      value={g.manualEmail || ''}
                      onChange={(e) => {
                        const updated = [...groups];
                        const idx = g.originalIndex ?? groups.indexOf(g);
                        if (idx >= 0) {
                          updated[idx] = { ...updated[idx], manualEmail: e.target.value };
                          setGroups(updated);
                        }
                      }}
                      className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm w-64"
                    />
                  </div>
                )}
                <span className="text-xs text-gray-400 dark:text-gray-500">— {g.threats.filter((t) => !excludedIds.has(t.threatId)).length}件</span>
              </div>
            ))}
          </div>

          <div className="flex justify-between">
            <button
              onClick={() => router.push('/')}
              className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:text-gray-200 text-sm"
            >
              ← 脅威一覧に戻る
            </button>
            <button
              onClick={goToStep2}
              disabled={activeThreats.length === 0}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              次へ: 申請内容 →
            </button>
          </div>
        </div>
      )}

      {/* ─── Step 2: 申請内容 ─── */}
      {step === 2 && (
        <div className="space-y-4">
          <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3 text-sm text-blue-800">
            送信先ごとに文面を自動生成しました。内容を確認・編集してください。
          </div>

          {activeGroups.map((g, i) => {
            const email = g.abuseEmail || g.manualEmail;
            return (
              <div key={i} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                      📧 {g.registrar}
                      <span className="text-sm font-normal text-gray-500 dark:text-gray-400 dark:text-gray-500">({g.threats.length}件)</span>
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500">送信先: {email || '未設定'}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500">言語:</label>
                    <select
                      value={g.language || 'ja'}
                      onChange={(e) => {
                        const updated = [...groups];
                        const idx = g.originalIndex ?? groups.indexOf(g);
                        if (idx >= 0) {
                          updated[idx] = { ...updated[idx], language: e.target.value };
                          setGroups(updated);
                        }
                      }}
                      className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm"
                    >
                      <option value="ja">日本語</option>
                      <option value="en">English</option>
                    </select>
                  </div>
                </div>

                {/* Domain list */}
                <div className="text-sm text-gray-600 dark:text-gray-300">
                  対象: {g.threats.map((t) => t.domain).join(' / ')}
                </div>

                {/* Template */}
                {g.loading ? (
                  <div className="flex items-center gap-2 py-8 justify-center text-gray-500 dark:text-gray-400 dark:text-gray-500">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600" />
                    <span className="text-sm">文面を生成中...</span>
                  </div>
                ) : (
                  <textarea
                    value={g.template || ''}
                    onChange={(e) => {
                      const updated = [...groups];
                      const idx = g.originalIndex ?? groups.indexOf(g);
                      if (idx >= 0) {
                        updated[idx] = { ...updated[idx], template: e.target.value };
                        setGroups(updated);
                      }
                    }}
                    rows={12}
                    className="w-full border border-gray-300 dark:border-gray-600 rounded-lg p-3 text-sm font-mono resize-y"
                  />
                )}

                <div className="flex items-center gap-2">
                  <button
                    onClick={async () => {
                      if (!email) return;
                      const updated = [...groups];
                      const idx = g.originalIndex ?? groups.indexOf(g);
                      if (idx < 0) return;
                      updated[idx] = { ...updated[idx], loading: true };
                      setGroups([...updated]);
                      try {
                        const activeInGroup = g.threats.filter((t) => !excludedIds.has(t.threatId));
                        const res = await generateBatchTemplate({
                          threatIds: activeInGroup.map((t) => t.threatId),
                          abuseEmail: email,
                          registrar: g.registrar,
                          language: g.language || 'ja',
                        });
                        updated[idx] = { ...updated[idx], template: res.template, loading: false };
                      } catch {
                        updated[idx] = { ...updated[idx], loading: false };
                      }
                      setGroups([...updated]);
                    }}
                    className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
                  >
                    🔄 再生成
                  </button>
                </div>

                {/* Evidence */}
                <div>
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">添付エビデンス:</h4>
                  <div className="flex flex-wrap gap-3">
                    {[
                      { key: 'screenshot', label: 'スクリーンショット' },
                      { key: 'trademark', label: '商標登録証明（任意）' },
                      { key: 'whois', label: 'WHOIS情報' },
                    ].map(({ key, label }) => (
                      <label key={key} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={(g.evidenceTypes || []).includes(key)}
                          onChange={(e) => {
                            const updated = [...groups];
                            const idx = g.originalIndex ?? groups.indexOf(g);
                            if (idx < 0) return;
                            const types = [...(g.evidenceTypes || [])];
                            if (e.target.checked) types.push(key);
                            else {
                              const ti = types.indexOf(key);
                              if (ti >= 0) types.splice(ti, 1);
                            }
                            updated[idx] = { ...updated[idx], evidenceTypes: types };
                            setGroups(updated);
                          }}
                          className="rounded border-gray-300 dark:border-gray-600 text-blue-600"
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}

          <div className="flex justify-between">
            <button
              onClick={() => setStep(1)}
              className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:text-gray-200 text-sm"
            >
              ← 戻る
            </button>
            <button
              onClick={() => setStep(3)}
              disabled={activeGroups.some((g) => !g.template || g.loading)}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              次へ: 確認・送信 →
            </button>
          </div>
        </div>
      )}

      {/* ─── Step 3: 確認・送信 ─── */}
      {step === 3 && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">以下の内容で削除申請を送信します</h2>

            {activeGroups.map((g, i) => {
              const email = g.abuseEmail || g.manualEmail;
              return (
                <div key={i} className="border-b border-gray-100 dark:border-gray-700 py-4 last:border-0">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-medium text-gray-900 dark:text-gray-100">
                      📧 {g.registrar} — {g.threats.length}件
                    </h3>
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-300 space-y-1">
                    <div>送信先: <span className="font-mono">{email}</span></div>
                    <div>文面: {g.language === 'ja' ? '日本語' : '英語'}</div>
                    <div>添付: {(g.evidenceTypes || []).map((t) =>
                      t === 'screenshot' ? 'スクショ' : t === 'trademark' ? '商標証明' : 'WHOIS'
                    ).join(' + ') || 'なし'}</div>
                    <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                      対象: {g.threats.map((t) => t.domain).join(', ')}
                    </div>
                  </div>
                </div>
              );
            })}

            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 text-sm text-gray-700 dark:text-gray-200 font-medium">
              合計: {activeThreats.length}件の脅威 → {activeGroups.length}通のメールを送信
            </div>
          </div>

          <div className="flex justify-between">
            <button
              onClick={() => setStep(2)}
              className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:text-gray-200 text-sm"
            >
              ← 戻る
            </button>
            <button
              onClick={handleSubmit}
              disabled={sending}
              className="px-6 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
            >
              {sending ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                  送信中...
                </>
              ) : (
                <>📨 送信する</>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
