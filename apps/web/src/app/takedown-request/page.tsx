'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { getBulkAbuseContacts, generateBatchTemplate, submitBatchTakedown, submitBulkBrowserReports } from '@/lib/api';
import { Button, ShieldLogo } from '@/components/ui';

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

interface JpcertRecipient {
  type: 'jpcert';
  name: string;
  email: string;
  pgpKeyUrl?: string;
}

interface AbuseGroup {
  abuseEmail: string | null;
  registrar: string;
  threats: ThreatInfo[];
  recipientType?: 'registrar' | 'jpcert' | 'hosting';
  recipientName?: string;
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
  if (score === null) return { label: '—', color: 'bg-surface-elevated text-[var(--text-secondary)]' };
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
  const [jpcertRecipient, setJpcertRecipient] = useState<JpcertRecipient | null>(null);
  const [sendToJpcert, setSendToJpcert] = useState(true);
  const [sendToBrowser, setSendToBrowser] = useState(true);
  const [browserProviders, setBrowserProviders] = useState<string[]>(['GOOGLE_SAFE_BROWSING', 'MICROSOFT_SMARTSCREEN']);
  const [hostingGroups, setHostingGroups] = useState<AbuseGroup[]>([]);
  const [sendToHosting, setSendToHosting] = useState(true);
  const [registrarExpanded, setRegistrarExpanded] = useState(false);
  const [hostingExpanded, setHostingExpanded] = useState(false);

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
          recipientType: 'registrar' as const,
          language: 'ja',
          evidenceTypes: ['screenshot'],
          template: '',
          manualEmail: '',
        })));
        if (data.jpcertRecipient) {
          setJpcertRecipient(data.jpcertRecipient);
        }
        if (data.hostingGroups) {
          setHostingGroups(data.hostingGroups.map((g: any) => ({
            ...g,
            recipientType: 'hosting' as const,
            language: 'ja',
            evidenceTypes: ['screenshot'],
            template: '',
            manualEmail: '',
          })));
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [router]);

  const activeThreats = threats.filter((t) => !excludedIds.has(t.threatId));

  // Build groups: registrar groups + optional JPCERT/hosting groups
  const registrarGroups = groups
    .map((g, originalIndex) => ({
      ...g,
      originalIndex,
      recipientType: 'registrar' as const,
      threats: g.threats.filter((t) => !excludedIds.has(t.threatId)),
    }))
    .filter((g) => g.threats.length > 0);

  // JPCERT group: all active threats combined into one group
  const jpcertGroup: AbuseGroup & { originalIndex: number } | null =
    sendToJpcert && jpcertRecipient && activeThreats.length > 0
      ? {
          abuseEmail: jpcertRecipient.email,
          registrar: '',
          recipientType: 'jpcert' as const,
          recipientName: jpcertRecipient.name,
          threats: activeThreats,
          language: 'ja',
          evidenceTypes: ['screenshot', 'whois'],
          template: '',
          manualEmail: '',
          originalIndex: -2, // sentinel for jpcert group
        }
      : null;

  // Hosting groups: group by hosting provider, filter excluded threats
  const activeHostingGroups = sendToHosting
    ? hostingGroups
        .map((g, originalIndex) => ({
          ...g,
          originalIndex,
          recipientType: 'hosting' as const,
          threats: g.threats.filter((t) => !excludedIds.has(t.threatId)),
        }))
        .filter((g) => g.threats.length > 0)
    : [];

  const activeGroups = [
    ...registrarGroups,
    ...(jpcertGroup ? [jpcertGroup] : []),
    ...activeHostingGroups,
  ];

  const unresolvedCount = registrarGroups.filter((g) => !g.abuseEmail && !g.manualEmail).length;

  // JPCERT group state (separate from registrar groups since it's virtual)
  const [jpcertGroupState, setJpcertGroupState] = useState<{
    template: string;
    loading: boolean;
    language: string;
    evidenceTypes: string[];
  }>({ template: '', loading: false, language: 'ja', evidenceTypes: ['screenshot', 'whois'] });

  // Hosting group states (one per hosting provider group)
  const [hostingGroupStates, setHostingGroupStates] = useState<
    Array<{ template: string; loading: boolean; language: string; evidenceTypes: string[] }>
  >([]);

  // Step 2: Generate templates for all groups
  // Each API call updates state independently on completion (no Promise.all blocking)
  const generateTemplates = useCallback(async () => {
    const TIMEOUT_MS = 30_000;

    // Helper: fetch with timeout
    const fetchWithTimeout = async (data: Parameters<typeof generateBatchTemplate>[0]) => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
      try {
        const res = await generateBatchTemplate(data, { signal: controller.signal });
        return res.template;
      } finally {
        clearTimeout(timer);
      }
    };

    // 1. Set all registrar groups to loading (functional update to avoid stale state)
    const snapshot = [...groups]; // capture for API calls
    setGroups((prev) =>
      prev.map((g) => {
        const active = g.threats.filter((t) => !excludedIds.has(t.threatId));
        const email = g.abuseEmail || g.manualEmail;
        return (active.length > 0 && email) ? { ...g, loading: true } : g;
      }),
    );

    if (sendToJpcert && jpcertRecipient && activeThreats.length > 0) {
      setJpcertGroupState((prev) => ({ ...prev, loading: true }));
    }

    // Set hosting groups to loading
    if (sendToHosting && activeHostingGroups.length > 0) {
      setHostingGroupStates(activeHostingGroups.map(() => ({
        template: '', loading: true, language: 'ja', evidenceTypes: ['screenshot'],
      })));
    }

    // 2. Fire API calls — each one updates state independently on completion
    for (let i = 0; i < snapshot.length; i++) {
      const g = snapshot[i];
      const active = g.threats.filter((t) => !excludedIds.has(t.threatId));
      const email = g.abuseEmail || g.manualEmail;
      if (active.length === 0 || !email) continue;

      const idx = i; // capture index for closure
      fetchWithTimeout({
        threatIds: active.map((t) => t.threatId),
        abuseEmail: email,
        registrar: g.registrar,
        language: g.language || 'ja',
        recipientType: 'registrar',
      }).then((template) => {
        setGroups((prev) => prev.map((p, j) => j === idx ? { ...p, template, loading: false } : p));
      }).catch(() => {
        setGroups((prev) => prev.map((p, j) =>
          j === idx ? { ...p, template: '(テンプレート生成に失敗しました。手動で入力してください。)', loading: false } : p,
        ));
      });
    }

    // JPCERT
    if (sendToJpcert && jpcertRecipient && activeThreats.length > 0) {
      fetchWithTimeout({
        threatIds: activeThreats.map((t) => t.threatId),
        abuseEmail: jpcertRecipient.email,
        registrar: '',
        language: 'ja',
        recipientType: 'jpcert',
      }).then((template) => {
        setJpcertGroupState((prev) => ({ ...prev, template, loading: false }));
      }).catch(() => {
        setJpcertGroupState((prev) => ({
          ...prev,
          template: '(テンプレート生成に失敗しました。手動で入力してください。)',
          loading: false,
        }));
      });
    }
    // Hosting
    if (sendToHosting && activeHostingGroups.length > 0) {
      for (let i = 0; i < activeHostingGroups.length; i++) {
        const hg = activeHostingGroups[i];
        const email = hg.abuseEmail || hg.manualEmail;
        if (!email || hg.threats.length === 0) continue;
        const idx = i;
        fetchWithTimeout({
          threatIds: hg.threats.map((t) => t.threatId),
          abuseEmail: email,
          registrar: hg.registrar,
          language: 'ja',
          recipientType: 'hosting',
        }).then((template) => {
          setHostingGroupStates((prev) => prev.map((s, j) => j === idx ? { ...s, template, loading: false } : s));
        }).catch(() => {
          setHostingGroupStates((prev) => prev.map((s, j) =>
            j === idx ? { ...s, template: '(テンプレート生成に失敗しました。手動で入力してください。)', loading: false } : s,
          ));
        });
      }
    }
  }, [groups, excludedIds, sendToJpcert, jpcertRecipient, sendToHosting, activeHostingGroups, activeThreats]);

  // Move to step 2
  const goToStep2 = () => {
    setStep(2);
    generateTemplates();
  };

  // Submit (Step 3 → send)
  const handleSubmit = async () => {
    setSending(true);
    setError(null);
    try {
      const items: Array<{ threatId: string; abuseEmail: string; template: string; language: string; evidenceTypes: string; recipientType?: string; recipientName?: string }> = [];

      // Registrar items
      const skippedItems: Array<{ threatId: string; registrar: string }> = [];
      const skippedRegistrars: Array<{ registrar: string; domains: string[] }> = [];
      for (const g of registrarGroups) {
        const email = g.abuseEmail || g.manualEmail;
        if (!email || !g.template) {
          // Track skipped groups (no email)
          if (!email) {
            const domains: string[] = [];
            for (const t of g.threats) {
              skippedItems.push({ threatId: t.threatId, registrar: g.registrar });
              domains.push(t.domain);
            }
            skippedRegistrars.push({ registrar: g.registrar, domains });
          }
          continue;
        }
        for (const t of g.threats) {
          items.push({
            threatId: t.threatId,
            abuseEmail: email,
            template: g.template,
            language: g.language || 'en',
            evidenceTypes: (g.evidenceTypes || []).join(','),
            recipientType: 'registrar',
          });
        }
      }

      // JPCERT items
      if (sendToJpcert && jpcertRecipient && jpcertGroupState.template) {
        for (const t of activeThreats) {
          items.push({
            threatId: t.threatId,
            abuseEmail: jpcertRecipient.email,
            template: jpcertGroupState.template,
            language: 'ja',
            evidenceTypes: jpcertGroupState.evidenceTypes.join(','),
            recipientType: 'jpcert',
            recipientName: jpcertRecipient.name,
          });
        }
      }

      // Hosting items
      if (sendToHosting && activeHostingGroups.length > 0) {
        for (let i = 0; i < activeHostingGroups.length; i++) {
          const hg = activeHostingGroups[i];
          const state = hostingGroupStates[i];
          const email = hg.abuseEmail || hg.manualEmail;
          if (!email || !state?.template) continue;
          for (const t of hg.threats) {
            items.push({
              threatId: t.threatId,
              abuseEmail: email,
              template: state.template,
              language: state.language || 'ja',
              evidenceTypes: (state.evidenceTypes || []).join(','),
              recipientType: 'hosting',
              recipientName: hg.registrar,
            });
          }
        }
      }

      if (items.length === 0 && skippedItems.length === 0 && !(sendToBrowser && browserProviders.length > 0)) {
        setError('送信可能な申請がありません。送信先メールアドレスと文面を確認してください。');
        setSending(false);
        return;
      }

      // Send takedown emails and browser reports in parallel
      const [takedownRes, browserRes] = await Promise.all([
        (items.length > 0 || skippedItems.length > 0) ? submitBatchTakedown(items, skippedItems) : null,
        sendToBrowser && browserProviders.length > 0
          ? submitBulkBrowserReports(activeThreats.map((t) => t.threatId), browserProviders).catch((err: any) => ({
              results: [],
              summary: { total: 0, success: 0, error: activeThreats.length * browserProviders.length },
              error: err.message,
            }))
          : null,
      ]);

      setResult({ ...takedownRes, browserReport: browserRes, skippedRegistrars });
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
        <div className="bg-surface-card rounded-xl border border-[var(--border-default)] p-8 text-center">
          <div className="text-5xl mb-4">✅</div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-2">削除申請を送信しました</h1>
          <p className="text-[var(--text-secondary)] mb-6">
            {result.sentCount != null ? `${result.sentCount}/${result.totalCount}件のメールを送信しました。` : ''}
            {result.browserReport && (
              <span>
                {result.sentCount != null ? ' ' : ''}
                ブラウザ報告: {result.browserReport.summary?.success ?? 0}/{result.browserReport.summary?.total ?? 0}件成功
              </span>
            )}
          </p>
          {result.errors?.length > 0 && (
            <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-4 text-left mb-6">
              <p className="text-sm font-medium text-red-800 mb-2">⚠️ 一部送信に失敗しました:</p>
              {result.errors.map((e: any, i: number) => (
                <p key={i} className="text-sm text-red-600">{e.error}</p>
              ))}
            </div>
          )}
          {result.browserReport?.error && (
            <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-4 text-left mb-6">
              <p className="text-sm font-medium text-red-800 mb-2">⚠️ ブラウザ報告でエラーが発生しました:</p>
              <p className="text-sm text-red-600">{result.browserReport.error}</p>
            </div>
          )}
          {result.skippedRegistrars?.length > 0 && (
            <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-300 dark:border-orange-700 rounded-lg p-4 text-left mb-6">
              <p className="text-sm font-medium text-orange-800 dark:text-orange-200 mb-2">
                ⚠️ 送信先メールアドレスが不明のため、以下のレジストラへの削除申請は送信されていません:
              </p>
              <ul className="list-disc list-inside text-sm text-orange-700 dark:text-orange-300 space-y-1">
                {result.skippedRegistrars.map((s: any, i: number) => (
                  <li key={i}>
                    <span className="font-medium">{s.registrar}</span>
                    <span className="text-orange-600 dark:text-orange-400">（{s.domains.length}件: {s.domains.join(', ')}）</span>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-orange-600 dark:text-orange-400 mt-2">
                進捗一覧で「未申請（送信先不明）」として記録されています。送信先が判明次第、個別に申請してください。
              </p>
            </div>
          )}
          <div className="flex gap-3 justify-center">
            <Button
              variant="primary"
              onClick={() => router.push('/takedowns')}
              className="px-4 sm:px-6"
            >
              進捗を確認する
            </Button>
            <button
              onClick={() => router.push('/')}
              className="px-4 sm:px-6 py-2 bg-surface-elevated text-[var(--text-primary)] rounded-lg font-medium hover:bg-gray-200 dark:hover:bg-gray-600"
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
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">削除申請</h1>
        <p className="text-[var(--text-secondary)] mt-1">選択した脅威の管理会社に削除を依頼します</p>
      </div>

      {/* Progress Bar */}
      <div className="flex items-center gap-2">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex items-center gap-2 flex-1">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
              step >= s ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-600 text-[var(--text-secondary)]'
            }`}>
              {s}
            </div>
            <span className={`text-sm ${step >= s ? 'text-blue-600 font-medium' : 'text-[var(--text-tertiary)]'}`}>
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
          <div className="bg-surface-card rounded-xl border border-[var(--border-default)] p-6">
            <h2 className="text-lg font-bold text-[var(--text-primary)] mb-1">申請対象: {activeThreats.length}件</h2>
            <p className="text-sm text-[var(--text-secondary)] mb-4">削除を申請する脅威を確認してください。不要な場合は✕で除外できます。</p>

            <div className="space-y-2">
              {threats.map((t) => {
                const excluded = excludedIds.has(t.threatId);
                const risk = getRiskLevel(t.riskScore);
                return (
                  <div
                    key={t.threatId}
                    className={`flex items-center gap-4 p-3 rounded-lg border ${
                      excluded ? 'opacity-40 bg-surface-base border-[var(--border-subtle)]' : 'bg-surface-card border-[var(--border-default)]'
                    }`}
                  >
                    <button
                      onClick={() => {
                        const next = new Set(excludedIds);
                        if (excluded) next.delete(t.threatId);
                        else next.add(t.threatId);
                        setExcludedIds(next);
                      }}
                      className="text-[var(--text-tertiary)] hover:text-red-500 text-lg font-bold w-6"
                      title={excluded ? '戻す' : '除外'}
                    >
                      {excluded ? '↩' : '✕'}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="font-mono text-sm font-medium truncate">{t.domain}</div>
                      <div className="text-xs text-[var(--text-secondary)]">{t.categoryDescription}</div>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${risk.color}`}>
                      {risk.label}
                    </span>
                    <div className="text-right text-xs text-[var(--text-secondary)] min-w-[180px]">
                      <div>→ {t.registrar}</div>
                      <div className="text-[var(--text-tertiary)]">
                        {t.abuseEmail ? `(${t.abuseEmail})` : '送信先を手動入力'}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 送信先まとめ */}
          <div className="bg-surface-card rounded-xl border border-[var(--border-default)] p-6 space-y-4">
            <h3 className="font-bold text-[var(--text-primary)]">送信先を選択</h3>
            <p className="text-sm text-[var(--text-secondary)]">削除申請の送信先を選択してください。複数の送信先を同時に選択できます。</p>

            {/* 1. ブラウザベンダーへの報告 */}
            <div className={`border rounded-lg p-4 transition-colors ${sendToBrowser ? 'border-purple-300 dark:border-purple-700 bg-purple-50/50 dark:bg-purple-900/20' : 'border-[var(--border-default)]'}`}>
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={sendToBrowser}
                  onChange={(e) => setSendToBrowser(e.target.checked)}
                  className="rounded border-[var(--border-default)] text-purple-600 w-4 h-4 mt-1"
                />
                <div className="flex-1">
                  <h4 className="font-medium text-[var(--text-primary)] flex items-center gap-2">
                    <span className="text-lg">🌐</span>
                    ブラウザベンダーへの報告
                  </h4>
                  <p className="text-xs text-[var(--text-secondary)] mt-1">
                    Google Safe Browsing / Microsoft SmartScreen にフィッシングURLを報告します
                  </p>
                  <p className="text-xs text-[var(--text-tertiary)] mt-1">
                    ※ ブラウザがフィッシングサイトへのアクセスを警告・ブロックするようになります（API自動送信）
                  </p>
                  {sendToBrowser && (
                    <div className="flex flex-wrap gap-4 mt-3 pl-1">
                      {[
                        { key: 'GOOGLE_SAFE_BROWSING', label: 'Google Safe Browsing' },
                        { key: 'MICROSOFT_SMARTSCREEN', label: 'Microsoft SmartScreen' },
                      ].map(({ key, label }) => (
                        <label key={key} className="flex items-center gap-2 text-sm cursor-pointer">
                          <input
                            type="checkbox"
                            checked={browserProviders.includes(key)}
                            onChange={(e) => {
                              setBrowserProviders((prev) =>
                                e.target.checked ? [...prev, key] : prev.filter((p) => p !== key)
                              );
                            }}
                            className="rounded border-[var(--border-default)] text-purple-600"
                          />
                          {label}
                        </label>
                      ))}
                    </div>
                  )}
                </div>
                <span className="text-xs text-[var(--text-tertiary)] bg-surface-elevated px-2 py-0.5 rounded">{activeThreats.length}件</span>
              </label>
            </div>

            {/* 2. ドメインレジストラへの削除申請 */}
            <div className="border border-[var(--border-default)] rounded-lg p-4">
              <button
                type="button"
                onClick={() => setRegistrarExpanded(!registrarExpanded)}
                className="w-full flex items-center justify-between"
              >
                <div>
                  <h4 className="font-medium text-[var(--text-primary)] flex items-center gap-2">
                    <span className="text-lg">📧</span>
                    ドメインレジストラへの削除申請
                    <span className="text-xs font-normal text-[var(--text-tertiary)] bg-surface-elevated px-2 py-0.5 rounded">{registrarGroups.length}社</span>
                  </h4>
                  <p className="text-xs text-[var(--text-secondary)] mt-1 text-left">
                    各ドメインのレジストラ（登録管理会社）に直接削除を依頼します
                  </p>
                </div>
                <span className="text-gray-400 ml-2">{registrarExpanded ? '▲' : '▼'}</span>
              </button>
              {registrarExpanded && (
                registrarGroups.length > 0 ? (
                  <div className="space-y-2 pl-2 mt-3">
                    {registrarGroups.map((g, i) => (
                      <div key={`reg-${i}`} className="flex items-center gap-3 py-1.5 bg-surface-base rounded px-3">
                        <span className="font-medium text-sm flex-1">{g.registrar}</span>
                        {g.abuseEmail ? (
                          <span className="text-xs text-[var(--text-secondary)]">({g.abuseEmail})</span>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-orange-600">⚠️ 送信先を入力</span>
                            <input
                              type="email"
                              placeholder="abuse@example.com"
                              value={g.manualEmail || ''}
                              onChange={(e) => {
                                const updated = [...groups];
                                const idx = g.originalIndex;
                                if (idx >= 0) {
                                  updated[idx] = { ...updated[idx], manualEmail: e.target.value };
                                  setGroups(updated);
                                }
                              }}
                              className="border border-[var(--border-default)] rounded px-2 py-1 text-sm w-56"
                            />
                          </div>
                        )}
                        <span className="text-xs text-[var(--text-tertiary)] bg-surface-elevated px-2 py-0.5 rounded">{g.threats.length}件</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-[var(--text-tertiary)] pl-2 mt-3">対象のドメインがありません</p>
                )
              )}
            </div>

            {/* 3. ホスティング事業者への削除申請 */}
            {activeHostingGroups.length > 0 && (
              <div className={`border rounded-lg p-4 transition-colors ${sendToHosting ? 'border-green-300 dark:border-green-700 bg-green-50/50 dark:bg-green-900/20' : 'border-[var(--border-default)]'}`}>
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={sendToHosting}
                    onChange={(e) => setSendToHosting(e.target.checked)}
                    className="rounded border-[var(--border-default)] text-green-600 w-4 h-4 mt-1 cursor-pointer"
                  />
                  <div className="flex-1">
                    <button
                      type="button"
                      onClick={() => setHostingExpanded(!hostingExpanded)}
                      className="w-full flex items-center justify-between"
                    >
                      <div className="text-left">
                        <h4 className="font-medium text-[var(--text-primary)] flex items-center gap-2">
                          <span className="text-lg">🖥️</span>
                          ホスティング事業者への削除申請
                          <span className="text-xs font-normal text-[var(--text-tertiary)] bg-surface-elevated px-2 py-0.5 rounded">{activeHostingGroups.length}社</span>
                        </h4>
                        <p className="text-xs text-[var(--text-secondary)] mt-1">
                          フィッシングサイトをホストしているサーバー管理会社にコンテンツ削除を依頼します
                        </p>
                      </div>
                      <span className="text-gray-400 ml-2">{hostingExpanded ? '▲' : '▼'}</span>
                    </button>
                    {hostingExpanded && sendToHosting && (
                      <div className="space-y-2 mt-3 pl-1">
                        {activeHostingGroups.map((hg, i) => (
                          <div key={`hosting-${i}`} className="flex items-center gap-3 py-1.5 bg-surface-base rounded px-3">
                            <span className="font-medium text-sm flex-1">{hg.registrar}</span>
                            {hg.abuseEmail ? (
                              <span className="text-xs text-[var(--text-secondary)]">({hg.abuseEmail})</span>
                            ) : (
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-orange-600">⚠️ 送信先を入力</span>
                                <input
                                  type="email"
                                  placeholder="abuse@example.com"
                                  value={hg.manualEmail || ''}
                                  onChange={(e) => {
                                    const updated = [...hostingGroups];
                                    const idx = hg.originalIndex;
                                    if (idx >= 0) {
                                      updated[idx] = { ...updated[idx], manualEmail: e.target.value };
                                      setHostingGroups(updated);
                                    }
                                  }}
                                  className="border border-[var(--border-default)] rounded px-2 py-1 text-sm w-56"
                                />
                              </div>
                            )}
                            <span className="text-xs text-[var(--text-tertiary)] bg-surface-elevated px-2 py-0.5 rounded">{hg.threats.length}件</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* 4. JPCERT/CCへの報告 */}
            {jpcertRecipient && (
              <div className={`border rounded-lg p-4 transition-colors ${sendToJpcert ? 'border-blue-300 dark:border-blue-700 bg-blue-50/50 dark:bg-blue-900/20' : 'border-[var(--border-default)]'}`}>
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={sendToJpcert}
                    onChange={(e) => setSendToJpcert(e.target.checked)}
                    className="rounded border-[var(--border-default)] text-blue-600 w-4 h-4 mt-1"
                  />
                  <div className="flex-1">
                    <h4 className="font-medium text-[var(--text-primary)] flex items-center gap-2">
                      <ShieldLogo size={20} />
                      JPCERT/CCへのフィッシング報告
                    </h4>
                    <p className="text-xs text-[var(--text-secondary)] mt-1">
                      {jpcertRecipient.name}（{jpcertRecipient.email}）にフィッシング報告を送信します
                    </p>
                    <p className="text-xs text-[var(--text-tertiary)] mt-1">
                      ※ JPCERT/CCは日本のセキュリティインシデント対応機関で、フィッシングサイトの早期閉鎖を支援します
                    </p>
                  </div>
                  <span className="text-xs text-[var(--text-tertiary)] bg-surface-elevated px-2 py-0.5 rounded">{activeThreats.length}件</span>
                </label>
              </div>
            )}
          </div>

          <div className="flex justify-between">
            <Button
              variant="ghost"
              onClick={() => router.push('/')}
            >
              ← 脅威一覧に戻る
            </Button>
            <Button
              variant="primary"
              onClick={goToStep2}
              disabled={activeThreats.length === 0}
              className="px-4 sm:px-6"
            >
              次へ: 申請内容 →
            </Button>
          </div>
        </div>
      )}

      {/* ─── Step 2: 申請内容 ─── */}
      {step === 2 && (
        <div className="space-y-4">
          <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3 text-sm text-blue-800">
            送信先ごとに文面を自動生成しました。内容を確認・編集してください。
          </div>

          {/* Browser report note */}
          {sendToBrowser && browserProviders.length > 0 && (
            <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-xl p-6">
              <h3 className="font-bold text-[var(--text-primary)] flex items-center gap-2 mb-2">
                🌐 ブラウザベンダーへの報告
                <span className="text-sm font-normal text-[var(--text-secondary)]">({activeThreats.length}件)</span>
              </h3>
              <p className="text-sm text-[var(--text-secondary)]">
                ブラウザベンダーへの報告はAPIを通じて自動送信されます。テンプレートの編集は不要です。
              </p>
              <div className="flex gap-2 mt-2">
                {browserProviders.includes('GOOGLE_SAFE_BROWSING') && (
                  <span className="px-2 py-0.5 bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 rounded text-xs font-medium">Google Safe Browsing</span>
                )}
                {browserProviders.includes('MICROSOFT_SMARTSCREEN') && (
                  <span className="px-2 py-0.5 bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 rounded text-xs font-medium">Microsoft SmartScreen</span>
                )}
              </div>
            </div>
          )}

          {/* Registrar groups */}
          {registrarGroups.map((g, i) => {
            const email = g.abuseEmail || g.manualEmail;
            return (
              <div key={`reg-${i}`} className="bg-surface-card rounded-xl border border-[var(--border-default)] p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-[var(--text-primary)] flex items-center gap-2">
                      📧 {g.registrar}
                      <span className="text-sm font-normal text-[var(--text-secondary)]">({g.threats.length}件)</span>
                    </h3>
                    <p className="text-xs text-[var(--text-secondary)]">送信先: {email || '未設定'}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="text-xs text-[var(--text-secondary)]">言語:</label>
                    <select
                      value={g.language || 'ja'}
                      onChange={(e) => {
                        const updated = [...groups];
                        const idx = g.originalIndex;
                        if (idx >= 0) {
                          updated[idx] = { ...updated[idx], language: e.target.value };
                          setGroups(updated);
                        }
                      }}
                      className="border border-[var(--border-default)] rounded px-2 py-1 text-sm"
                    >
                      <option value="ja">日本語</option>
                      <option value="en">English</option>
                    </select>
                  </div>
                </div>

                <div className="text-sm text-[var(--text-secondary)]">
                  対象: {g.threats.map((t) => t.domain).join(' / ')}
                </div>

                {g.loading ? (
                  <div className="flex items-center gap-2 py-8 justify-center text-[var(--text-secondary)]">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600" />
                    <span className="text-sm">文面を生成中...</span>
                  </div>
                ) : (
                  <textarea
                    value={g.template || ''}
                    onChange={(e) => {
                      const updated = [...groups];
                      const idx = g.originalIndex;
                      if (idx >= 0) {
                        updated[idx] = { ...updated[idx], template: e.target.value };
                        setGroups(updated);
                      }
                    }}
                    rows={12}
                    className="w-full border border-[var(--border-default)] rounded-lg p-3 text-sm font-mono resize-y"
                  />
                )}

                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={async () => {
                      if (!email) return;
                      const updated = [...groups];
                      const idx = g.originalIndex;
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
                          recipientType: 'registrar',
                        });
                        updated[idx] = { ...updated[idx], template: res.template, loading: false };
                      } catch {
                        updated[idx] = { ...updated[idx], loading: false };
                      }
                      setGroups([...updated]);
                    }}
                    className="text-blue-600 hover:text-blue-800"
                  >
                    🔄 再生成
                  </Button>
                </div>

                <div>
                  <h4 className="text-sm font-medium text-[var(--text-primary)] mb-2">添付エビデンス:</h4>
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
                            const idx = g.originalIndex;
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
                          className="rounded border-[var(--border-default)] text-blue-600"
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}

          {/* Hosting provider groups */}
          {sendToHosting && activeHostingGroups.map((hg, i) => {
            const state = hostingGroupStates[i];
            if (!state) return null;
            const email = hg.abuseEmail || hg.manualEmail;
            return (
              <div key={`hosting-${i}`} className="bg-surface-card rounded-xl border-2 border-green-300 dark:border-green-700 p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-[var(--text-primary)] flex items-center gap-2">
                      🖥️ {hg.registrar}
                      <span className="text-sm font-normal text-[var(--text-secondary)]">({hg.threats.length}件)</span>
                    </h3>
                    <p className="text-xs text-[var(--text-secondary)]">送信先: {email || '未設定'}</p>
                  </div>
                  <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 rounded text-xs font-bold">ホスティング事業者</span>
                </div>

                <div className="text-sm text-[var(--text-secondary)]">
                  対象: {hg.threats.map((t) => t.domain).join(' / ')}
                </div>

                {state.loading ? (
                  <div className="flex items-center gap-2 py-8 justify-center text-[var(--text-secondary)]">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-green-600" />
                    <span className="text-sm">ホスティング事業者向け削除申請文を生成中...</span>
                  </div>
                ) : (
                  <textarea
                    value={state.template}
                    onChange={(e) => {
                      setHostingGroupStates((prev) => prev.map((s, j) => j === i ? { ...s, template: e.target.value } : s));
                    }}
                    rows={14}
                    className="w-full border border-[var(--border-default)] rounded-lg p-3 text-sm font-mono resize-y"
                  />
                )}

                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={async () => {
                      if (!email) return;
                      setHostingGroupStates((prev) => prev.map((s, j) => j === i ? { ...s, loading: true } : s));
                      try {
                        const res = await generateBatchTemplate({
                          threatIds: hg.threats.map((t) => t.threatId),
                          abuseEmail: email,
                          registrar: hg.registrar,
                          language: 'ja',
                          recipientType: 'hosting',
                        });
                        setHostingGroupStates((prev) => prev.map((s, j) => j === i ? { ...s, template: res.template, loading: false } : s));
                      } catch {
                        setHostingGroupStates((prev) => prev.map((s, j) => j === i ? { ...s, loading: false } : s));
                      }
                    }}
                    className="text-green-600 hover:text-green-800"
                  >
                    🔄 再生成
                  </Button>
                </div>

                <div>
                  <h4 className="text-sm font-medium text-[var(--text-primary)] mb-2">添付エビデンス:</h4>
                  <div className="flex flex-wrap gap-3">
                    {[
                      { key: 'screenshot', label: 'スクリーンショット' },
                      { key: 'whois', label: 'WHOIS情報' },
                    ].map(({ key, label }) => (
                      <label key={key} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={state.evidenceTypes.includes(key)}
                          onChange={(e) => {
                            setHostingGroupStates((prev) => prev.map((s, j) => {
                              if (j !== i) return s;
                              const types = [...s.evidenceTypes];
                              if (e.target.checked) types.push(key);
                              else {
                                const ti = types.indexOf(key);
                                if (ti >= 0) types.splice(ti, 1);
                              }
                              return { ...s, evidenceTypes: types };
                            }));
                          }}
                          className="rounded border-[var(--border-default)] text-green-600"
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}

          {/* JPCERT group */}
          {sendToJpcert && jpcertRecipient && (
            <div className="bg-surface-card rounded-xl border-2 border-green-300 dark:border-green-700 p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-[var(--text-primary)] flex items-center gap-2">
                    <ShieldLogo size={18} className="inline-block" /> {jpcertRecipient.name}
                    <span className="text-sm font-normal text-[var(--text-secondary)]">({activeThreats.length}件)</span>
                  </h3>
                  <p className="text-xs text-[var(--text-secondary)]">送信先: {jpcertRecipient.email}</p>
                </div>
                <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 rounded text-xs font-bold">JPCERT報告</span>
              </div>

              <div className="text-sm text-[var(--text-secondary)]">
                対象: {activeThreats.map((t) => t.domain).join(' / ')}
              </div>

              {jpcertGroupState.loading ? (
                <div className="flex items-center gap-2 py-8 justify-center text-[var(--text-secondary)]">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-green-600" />
                  <span className="text-sm">JPCERT向けフィッシング報告文を生成中...</span>
                </div>
              ) : (
                <textarea
                  value={jpcertGroupState.template}
                  onChange={(e) => setJpcertGroupState((prev) => ({ ...prev, template: e.target.value }))}
                  rows={14}
                  className="w-full border border-[var(--border-default)] rounded-lg p-3 text-sm font-mono resize-y"
                />
              )}

              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={async () => {
                    setJpcertGroupState((prev) => ({ ...prev, loading: true }));
                    try {
                      const res = await generateBatchTemplate({
                        threatIds: activeThreats.map((t) => t.threatId),
                        abuseEmail: jpcertRecipient.email,
                        registrar: '',
                        language: 'ja',
                        recipientType: 'jpcert',
                      });
                      setJpcertGroupState((prev) => ({ ...prev, template: res.template, loading: false }));
                    } catch {
                      setJpcertGroupState((prev) => ({ ...prev, loading: false }));
                    }
                  }}
                  className="text-green-600 hover:text-green-800"
                >
                  🔄 再生成
                </Button>
              </div>

              <div>
                <h4 className="text-sm font-medium text-[var(--text-primary)] mb-2">添付エビデンス:</h4>
                <div className="flex flex-wrap gap-3">
                  {[
                    { key: 'screenshot', label: 'スクリーンショット' },
                    { key: 'whois', label: 'WHOIS情報' },
                  ].map(({ key, label }) => (
                    <label key={key} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={jpcertGroupState.evidenceTypes.includes(key)}
                        onChange={(e) => {
                          setJpcertGroupState((prev) => {
                            const types = [...prev.evidenceTypes];
                            if (e.target.checked) types.push(key);
                            else {
                              const ti = types.indexOf(key);
                              if (ti >= 0) types.splice(ti, 1);
                            }
                            return { ...prev, evidenceTypes: types };
                          });
                        }}
                        className="rounded border-[var(--border-default)] text-green-600"
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-between">
            <Button
              variant="ghost"
              onClick={() => setStep(1)}
            >
              ← 戻る
            </Button>
            <Button
              variant="primary"
              onClick={() => setStep(3)}
              disabled={
                registrarGroups.some((g) => !g.template || g.loading) ||
                (sendToJpcert && (!jpcertGroupState.template || jpcertGroupState.loading))
              }
              className="px-4 sm:px-6"
            >
              次へ: 確認・送信 →
            </Button>
          </div>
        </div>
      )}

      {/* ─── Step 3: 確認・送信 ─── */}
      {step === 3 && (
        <div className="space-y-4">
          <div className="bg-surface-card rounded-xl border border-[var(--border-default)] p-6">
            <h2 className="text-lg font-bold text-[var(--text-primary)] mb-4">以下の内容で削除申請を送信します</h2>

            {/* Browser report */}
            {sendToBrowser && browserProviders.length > 0 && (
              <div className="border-b border-[var(--border-subtle)] py-4 last:border-0">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium text-[var(--text-primary)]">
                    🌐 ブラウザベンダーへの報告 — {activeThreats.length}件
                  </h3>
                  <span className="px-2 py-0.5 bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 rounded text-xs font-bold">ブラウザ報告</span>
                </div>
                <div className="text-sm text-[var(--text-secondary)] space-y-1">
                  <div>送信先: {browserProviders.map((p) =>
                    p === 'GOOGLE_SAFE_BROWSING' ? 'Google Safe Browsing' : 'Microsoft SmartScreen'
                  ).join(' / ')}</div>
                  <div>送信方法: API自動送信</div>
                  <div className="text-xs text-[var(--text-tertiary)] mt-1">
                    対象: {activeThreats.map((t) => t.domain).join(', ')}
                  </div>
                </div>
              </div>
            )}

            {/* Registrar groups */}
            {registrarGroups.map((g, i) => {
              const email = g.abuseEmail || g.manualEmail;
              return (
                <div key={`reg-${i}`} className="border-b border-[var(--border-subtle)] py-4 last:border-0">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-medium text-[var(--text-primary)]">
                      📧 {g.registrar} — {g.threats.length}件
                    </h3>
                  </div>
                  <div className="text-sm text-[var(--text-secondary)] space-y-1">
                    <div>送信先: <span className="font-mono">{email}</span></div>
                    <div>文面: {g.language === 'ja' ? '日本語' : '英語'}</div>
                    <div>添付: {(g.evidenceTypes || []).map((t) =>
                      t === 'screenshot' ? 'スクショ' : t === 'trademark' ? '商標証明' : 'WHOIS'
                    ).join(' + ') || 'なし'}</div>
                    <div className="text-xs text-[var(--text-tertiary)] mt-1">
                      対象: {g.threats.map((t) => t.domain).join(', ')}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Hosting groups */}
            {sendToHosting && activeHostingGroups.map((hg, i) => {
              const state = hostingGroupStates[i];
              const email = hg.abuseEmail || hg.manualEmail;
              return (
                <div key={`hosting-summary-${i}`} className="border-b border-[var(--border-subtle)] py-4 last:border-0">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-medium text-[var(--text-primary)]">
                      🖥️ {hg.registrar} — {hg.threats.length}件
                    </h3>
                    <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 rounded text-xs font-bold">ホスティング事業者</span>
                  </div>
                  <div className="text-sm text-[var(--text-secondary)] space-y-1">
                    <div>送信先: <span className="font-mono">{email || '未設定'}</span></div>
                    <div>文面: 日本語</div>
                    <div>添付: {(state?.evidenceTypes || []).map((t) =>
                      t === 'screenshot' ? 'スクショ' : t === 'whois' ? 'WHOIS' : t
                    ).join(' + ') || 'なし'}</div>
                    <div className="text-xs text-[var(--text-tertiary)] mt-1">
                      対象: {hg.threats.map((t) => t.domain).join(', ')}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* JPCERT group */}
            {sendToJpcert && jpcertRecipient && (
              <div className="border-b border-[var(--border-subtle)] py-4 last:border-0">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium text-[var(--text-primary)]">
                    <ShieldLogo size={18} className="inline-block" /> {jpcertRecipient.name} — {activeThreats.length}件
                  </h3>
                  <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 rounded text-xs font-bold">JPCERT報告</span>
                </div>
                <div className="text-sm text-[var(--text-secondary)] space-y-1">
                  <div>送信先: <span className="font-mono">{jpcertRecipient.email}</span></div>
                  <div>文面: 日本語（フィッシング報告様式）</div>
                  <div>添付: {jpcertGroupState.evidenceTypes.map((t) =>
                    t === 'screenshot' ? 'スクショ' : t === 'whois' ? 'WHOIS' : t
                  ).join(' + ') || 'なし'}</div>
                  <div className="text-xs text-[var(--text-tertiary)] mt-1">
                    対象: {activeThreats.map((t) => t.domain).join(', ')}
                  </div>
                </div>
              </div>
            )}

            <div className="mt-4 pt-4 border-t border-[var(--border-default)] text-sm text-[var(--text-primary)] font-medium">
              合計: {activeThreats.length}件の脅威 → {sendToBrowser && browserProviders.length > 0 ? `ブラウザ報告（${browserProviders.length}社） + ` : ''}{registrarGroups.length + activeHostingGroups.length + (sendToJpcert ? 1 : 0)}通のメールを送信
            </div>
          </div>

          <div className="flex justify-between">
            <Button
              variant="ghost"
              onClick={() => setStep(2)}
            >
              ← 戻る
            </Button>
            <Button
              variant="danger"
              onClick={handleSubmit}
              disabled={sending}
              className="px-4 sm:px-6 flex items-center gap-2"
            >
              {sending ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                  送信中...
                </>
              ) : (
                <>📨 送信する</>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
