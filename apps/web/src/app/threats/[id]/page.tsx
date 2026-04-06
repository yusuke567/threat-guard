'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  getThreat, getThreats, generateTakedown, getAbuseContacts,
  sendTakedownEmail, downloadTakedownPdf, getContentAnalysis,
  triggerProbe, updateThreatStatus,
  getBrowserReports, submitGoogleReport, submitMicrosoftReport,
  getBulkAbuseContacts, generateBatchTemplate, submitBatchTakedown,
} from '@/lib/api';
import { RiskBadgeFull } from '@/components/RiskBadge';
import GlossaryTerm from '@/components/GlossaryTerm';
import { Button, useToast } from '@/components/ui';

// ─── Constants ───────────────────────────────────────────────────────────────

const statusColors: Record<string, string> = {
  new_domain: 'bg-blue-100 text-blue-800',
  analyzing: 'bg-yellow-100 text-yellow-800',
  confirmed_threat: 'bg-red-100 text-red-800',
  false_positive: 'bg-surface-elevated text-gray-800 dark:text-gray-200',
  takedown_sent: 'bg-orange-100 text-orange-800',
  resolved: 'bg-green-100 text-green-800',
};

const statusLabels: Record<string, string> = {
  new_domain: '未対応',
  analyzing: '確認中',
  confirmed_threat: '脅威確認',
  false_positive: '誤検知',
  takedown_sent: '削除申請中',
  resolved: '対応済み',
};

const statusOrder = ['new_domain', 'analyzing', 'confirmed_threat', 'takedown_sent', 'resolved', 'false_positive'];

const categoryLabels: Record<string, string> = {
  phishing: '🎣 フィッシング',
  brand_abuse: '⚠️ ブランド悪用',
  parked: '🅿️ パーク',
  legitimate: '✅ 正規',
  unknown: '❓ 不明',
};

const categoryDescriptions: Record<string, string> = {
  phishing: '御社を装った偽サイトでユーザーの情報を盗む手口です',
  brand_abuse: '御社ブランドを無断使用しています',
  parked: 'ドメインが取得済み（現在未使用）',
  legitimate: '正規サイトと判定されました',
  unknown: '調査中です',
};

type TabId = 'overview' | 'screenshots' | 'technical' | 'history';
type TakedownStep = 'idle' | 'loading_contacts' | 'confirm_recipient' | 'generating' | 'review' | 'sending' | 'sent';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getRiskEmoji(score: number | null): string {
  if (score === null) return '⚪';
  if (score >= 80) return '🔴';
  if (score >= 60) return '🟠';
  if (score >= 40) return '🟡';
  return '🟢';
}

function getRiskLabel(score: number | null): string {
  if (score === null) return '未算出';
  if (score >= 80) return '高';
  if (score >= 60) return '中高';
  if (score >= 40) return '中';
  return '低';
}

function getDangerSummary(threat: any, analysis: any): string {
  const score = threat.riskScore ?? 0;
  const category = analysis?.category;
  const domain = threat.domain;
  const brand = threat.brand?.domain || '';

  if (category === 'phishing' && score >= 80)
    return `「${brand}」を装った偽サイトです。ログイン情報を盗まれる恐れがあります。`;
  if (category === 'phishing')
    return `「${brand}」に似せた不審なサイトです。フィッシングに使われる可能性があります。`;
  if (category === 'brand_abuse')
    return `御社ブランドが無断で使用されています。顧客が誤認する恐れがあります。`;
  if (category === 'parked')
    return `御社名に似たドメインが取得されています。現在は未使用ですが、今後悪用される可能性があります。`;
  if (category === 'legitimate')
    return `現時点で正規サイトと判定されています。`;
  if (score >= 60)
    return `「${brand}」と紛らわしいドメインです。不正利用のリスクがあります。`;
  return `検知されたドメインです。引き続き監視中です。`;
}

function parseJson(data: any): any {
  if (!data) return null;
  if (typeof data === 'string') {
    try { return JSON.parse(data); } catch { return null; }
  }
  return data;
}

function formatDate(d: string | null | undefined): string {
  if (!d) return '—';
  return new Date(d).toLocaleString('ja-JP');
}

function formatDateShort(d: string | null | undefined): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('ja-JP');
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function ThreatDetailPage() {
  const params = useParams();
  const router = useRouter();
  const toast = useToast();
  const [threat, setThreat] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [contentAnalysis, setContentAnalysis] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<TabId>('overview');

  // Navigation
  const [threatIds, setThreatIds] = useState<string[]>([]);
  const [statusUpdating, setStatusUpdating] = useState(false);

  // Probe state
  const [probing, setProbing] = useState(false);

  // Takedown modal
  const [showTakedownModal, setShowTakedownModal] = useState(false);
  const [takedownStep, setTakedownStep] = useState<TakedownStep>('idle');
  const [abuseEmail, setAbuseEmail] = useState('');
  const [registrar, setRegistrar] = useState('');
  const [template, setTemplate] = useState('');
  const [currentTakedownId, setCurrentTakedownId] = useState<string | null>(null);
  const [takedownError, setTakedownError] = useState('');
  const [takedownSuccess, setTakedownSuccess] = useState('');

  // Load threat
  useEffect(() => {
    if (!params.id) return;
    setLoading(true);
    getThreat(params.id as string)
      .then((t) => {
        setThreat(t);
        getContentAnalysis(params.id as string).then(setContentAnalysis).catch(() => {});
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [params.id]);

  // Load threat list for prev/next nav
  useEffect(() => {
    getThreats({ pageSize: '500' })
      .then((res) => {
        const ids = (res.data || []).map((t: any) => t.id);
        setThreatIds(ids);
      })
      .catch(() => {});
  }, []);

  const currentIndex = threatIds.indexOf(params.id as string);
  const prevId = currentIndex > 0 ? threatIds[currentIndex - 1] : null;
  const nextId = currentIndex >= 0 && currentIndex < threatIds.length - 1 ? threatIds[currentIndex + 1] : null;

  // ─── Status Update ──────────────────────────────────────────────────────────
  const handleStatusChange = async (newStatus: string) => {
    if (!threat || statusUpdating) return;
    setStatusUpdating(true);
    try {
      await updateThreatStatus(threat.id, newStatus);
      setThreat({ ...threat, status: newStatus });
    } catch (e) {
      console.error('Status update failed', e);
    } finally {
      setStatusUpdating(false);
    }
  };

  // ─── Mark False Positive ────────────────────────────────────────────────────
  const handleFalsePositive = () => handleStatusChange('false_positive');

  // ─── Probe ──────────────────────────────────────────────────────────────────
  const handleProbe = async () => {
    if (!threat) return;
    setProbing(true);
    try {
      await triggerProbe(threat.id);
      const updated = await getThreat(threat.id);
      setThreat(updated);
      const ca = await getContentAnalysis(threat.id);
      setContentAnalysis(ca);
    } catch (e) {
      console.error('Probe failed', e);
    } finally {
      setProbing(false);
    }
  };

  // ─── Takedown Flow ──────────────────────────────────────────────────────────
  const scrollToTakedownSection = () => {
    const el = document.getElementById('unified-takedown-section');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const openTakedownModal = async () => {
    // Redirect to unified section instead of modal
    scrollToTakedownSection();
  };

  const handleGenerate = async () => {
    if (!abuseEmail) {
      setTakedownError('送信先メールアドレスを入力してください');
      return;
    }
    setTakedownError('');
    setTakedownStep('generating');
    try {
      const result = await generateTakedown(threat.id);
      setTemplate(result.template);
      setCurrentTakedownId(result.id);
      setTakedownStep('review');
      const updated = await getThreat(threat.id);
      setThreat(updated);
    } catch {
      setTakedownError('削除申請文面の生成に失敗しました');
      setTakedownStep('confirm_recipient');
    }
  };

  const handleSend = async () => {
    if (!currentTakedownId) return;
    setTakedownError('');
    setTakedownStep('sending');
    try {
      await sendTakedownEmail(currentTakedownId, abuseEmail);
      setTakedownStep('sent');
      setTakedownSuccess(`削除申請を ${abuseEmail} に送信しました`);
      const updated = await getThreat(threat.id);
      setThreat(updated);
    } catch {
      setTakedownError('メール送信に失敗しました');
      setTakedownStep('review');
    }
  };

  const closeTakedownModal = () => {
    setShowTakedownModal(false);
    setTakedownStep('idle');
    setAbuseEmail('');
    setRegistrar('');
    setTemplate('');
    setCurrentTakedownId(null);
    setTakedownError('');
    setTakedownSuccess('');
  };

  // ─── Loading / Not Found ────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!threat) {
    return <div className="text-center py-20 text-[var(--text-secondary)]">脅威が見つかりません</div>;
  }

  const latestAnalysis = threat.analyses?.[0];
  const whois = parseJson(threat.whoisData);
  const ssl = parseJson(threat.sslInfo);
  const probe = threat.webProbes?.[0];

  const tabs: { id: TabId; label: string }[] = [
    { id: 'overview', label: '概要' },
    { id: 'screenshots', label: 'スクリーンショット' },
    { id: 'technical', label: '技術詳細' },
    { id: 'history', label: '対応履歴' },
  ];

  return (
    <div className="space-y-6">
      {/* ─── Header ──────────────────────────────────────────────────────────── */}
      <div>
        {/* Breadcrumb + Prev/Next */}
        <div className="flex items-center justify-between mb-3">
          <a href="/" className="text-blue-600 hover:text-blue-700 dark:text-blue-300 text-sm font-medium">
            ← 脅威一覧に戻る
          </a>
          <div className="flex items-center gap-2 text-sm">
            {prevId ? (
              <a href={`/threats/${prevId}`} className="text-blue-600 hover:text-blue-700 dark:text-blue-300">← 前の脅威</a>
            ) : (
              <span className="text-gray-300">← 前の脅威</span>
            )}
            <span className="text-gray-300">|</span>
            {nextId ? (
              <a href={`/threats/${nextId}`} className="text-blue-600 hover:text-blue-700 dark:text-blue-300">次の脅威 →</a>
            ) : (
              <span className="text-gray-300">次の脅威 →</span>
            )}
          </div>
        </div>

        {/* Domain + Risk Badge */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-2">
          <h1 className="text-2xl font-bold text-[var(--text-primary)] font-mono">{threat.domain}</h1>
          <span className="shrink-0 text-lg">
            {getRiskEmoji(threat.riskScore)}{' '}
            <span className={`text-sm font-bold ${
              (threat.riskScore ?? 0) >= 80 ? 'text-red-700 dark:text-red-300' :
              (threat.riskScore ?? 0) >= 60 ? 'text-orange-700 dark:text-orange-300' :
              (threat.riskScore ?? 0) >= 40 ? 'text-yellow-700 dark:text-yellow-300' :
              'text-green-700 dark:text-green-300'
            }`}>
              {getRiskLabel(threat.riskScore)}
            </span>
          </span>
        </div>

        {/* One-line summary (Layer 1) */}
        <p className="text-[var(--text-secondary)] mb-3">
          {getDangerSummary(threat, latestAnalysis)}
        </p>

        {/* Action row: Status dropdown + Detection date + Buttons */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Status dropdown */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--text-secondary)]">ステータス:</span>
            <select
              value={threat.status}
              onChange={(e) => handleStatusChange(e.target.value)}
              disabled={statusUpdating}
              className={`px-2 py-1 rounded-full text-xs font-medium border cursor-pointer disabled:opacity-50 ${statusColors[threat.status] || 'bg-surface-elevated'}`}
            >
              {statusOrder.map((s) => (
                <option key={s} value={s}>{statusLabels[s]}</option>
              ))}
            </select>
          </div>

          <span className="text-gray-300">|</span>

          {/* Detection date */}
          <span className="text-xs text-[var(--text-secondary)]">
            検知日: {formatDateShort(threat.firstSeen)}
          </span>

          <span className="text-gray-300">|</span>

          {/* Action buttons */}
          <Button
            variant="danger"
            size="sm"
            onClick={openTakedownModal}
          >
            削除申請
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleFalsePositive}
            disabled={threat.status === 'false_positive'}
          >
            誤検知にする
          </Button>
        </div>
      </div>

      {/* ─── Tabs ────────────────────────────────────────────────────────────── */}
      <div className="border-b border-[var(--border-default)]">
        <nav className="flex gap-0">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* ─── Tab Content ─────────────────────────────────────────────────────── */}
      {activeTab === 'overview' && (
        <OverviewTab
          threat={threat}
          latestAnalysis={latestAnalysis}
          contentAnalysis={contentAnalysis}
          whois={whois}
          ssl={ssl}
          probe={probe}
          probing={probing}
          onProbe={handleProbe}
        />
      )}
      {activeTab === 'screenshots' && (
        <ScreenshotsTab threat={threat} probe={probe} probing={probing} onProbe={handleProbe} />
      )}
      {activeTab === 'technical' && (
        <TechnicalTab threat={threat} whois={whois} ssl={ssl} probe={probe} />
      )}
      {activeTab === 'history' && (
        <HistoryTab threat={threat} />
      )}

      {/* ─── Takedown Modal ──────────────────────────────────────────────────── */}
      {showTakedownModal && (
        <TakedownModal
          threat={threat}
          step={takedownStep}
          error={takedownError}
          success={takedownSuccess}
          registrar={registrar}
          abuseEmail={abuseEmail}
          template={template}
          currentTakedownId={currentTakedownId}
          onAbuseEmailChange={setAbuseEmail}
          onTemplateChange={setTemplate}
          onGenerate={handleGenerate}
          onSend={handleSend}
          onClose={closeTakedownModal}
        />
      )}
    </div>
  );
}

// ─── Tab 1: 概要 (Overview) ─────────────────────────────────────────────────

function OverviewTab({ threat, latestAnalysis, contentAnalysis, whois, ssl, probe, probing, onProbe }: {
  threat: any; latestAnalysis: any; contentAnalysis: any; whois: any; ssl: any; probe: any; probing: boolean; onProbe: () => void;
}) {
  return (
    <div className="space-y-6">
      {/* Risk Score */}
      <RiskBadgeFull score={threat.riskScore} />

      {/* なぜ危険か (Layer 1) */}
      <div className="bg-surface-card rounded-xl border border-[var(--border-default)] p-6">
        <h2 className="text-lg font-bold text-[var(--text-primary)] mb-3">なぜ危険か</h2>
        <p className="text-[var(--text-primary)] leading-relaxed">
          {getDangerSummaryDetailed(threat, latestAnalysis, contentAnalysis, probe)}
        </p>
      </div>

      {/* 判定根拠 (Layer 2) */}
      <div className="bg-surface-card rounded-xl border border-[var(--border-default)] p-6">
        <h2 className="text-lg font-bold text-[var(--text-primary)] mb-4">判定根拠</h2>
        <div className="space-y-3">
          {/* Analysis category & confidence */}
          {latestAnalysis && (
            <EvidenceRow
              label={`脅威の種類: ${categoryLabels[latestAnalysis.category] || latestAnalysis.category}`}
              value={`判定確度 ${Math.round(latestAnalysis.confidence * 100)}%`}
              bar={latestAnalysis.confidence}
            />
          )}

          {/* Content analysis indicators */}
          {contentAnalysis?.imageSimilarity != null && (
            <EvidenceRow
              label="サイト外観の類似度（ロゴ・レイアウト比較）"
              value={`${Math.round(contentAnalysis.imageSimilarity * 100)}%`}
              bar={contentAnalysis.imageSimilarity}
            />
          )}

          {/* URL similarity - derived from risk score presence */}
          {threat.riskScore != null && (
            <EvidenceRow
              label="ドメイン名の類似度（URL類似性）"
              value={`リスクスコア ${threat.riskScore}/100 に反映`}
            />
          )}

          {/* WHOIS anonymization */}
          {whois && (
            <div className="flex items-center gap-3 text-sm">
              <span className={whois.registrantOrganization ? '🟢' : '⚠️'}>
                {whois.registrantOrganization ? '⚪' : '⚠️'}
              </span>
              <span className="text-[var(--text-primary)]">
                {whois.registrantOrganization
                  ? `登録者: ${whois.registrantOrganization}`
                  : '登録者情報が隠されています（WHOIS匿名化）'}
              </span>
            </div>
          )}

          {/* SSL cert age */}
          {ssl?.validFrom && (
            <div className="flex items-center gap-3 text-sm">
              {(() => {
                const daysAgo = Math.floor((Date.now() - new Date(ssl.validFrom).getTime()) / (1000 * 60 * 60 * 24));
                const isNew = daysAgo < 30;
                return (
                  <>
                    <span>{isNew ? '⚠️' : '⚪'}</span>
                    <span className="text-[var(--text-primary)]">
                      <GlossaryTerm term="SSL">SSL証明書</GlossaryTerm>: 発行{daysAgo}日前
                      {isNew && '（取得直後のSSL証明書は偽サイトの特徴です）'}
                    </span>
                  </>
                );
              })()}
            </div>
          )}

          {/* MX records hint */}
          {probe && (
            <div className="flex items-center gap-3 text-sm">
              <span>⚪</span>
              <span className="text-[var(--text-primary)]">
                サイト稼働状態: {probe.httpStatus === 200 ? 'サイトが稼働中です' : probe.dnsResolved ? 'ドメインは存在しますがサイトは応答しません' : 'サーバー未設定'}
              </span>
            </div>
          )}

          {/* AI reasoning */}
          {latestAnalysis?.reasoning && (
            <details className="mt-2">
              <summary className="text-xs text-blue-600 cursor-pointer hover:text-blue-800 font-medium">
                AI分析の詳細を見る
              </summary>
              <p className="mt-2 text-xs text-[var(--text-secondary)] bg-surface-base rounded-lg p-3 leading-relaxed">
                {latestAnalysis.reasoning}
              </p>
            </details>
          )}
        </div>
      </div>

      {/* ドメイン情報 */}
      <div className="bg-surface-card rounded-xl border border-[var(--border-default)] p-6">
        <h2 className="text-lg font-bold text-[var(--text-primary)] mb-4">ドメイン情報</h2>
        <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
          <InfoItem label="ドメイン" value={threat.domain} mono />
          <InfoItem label="ブランド" value={`${threat.brand?.name} (${threat.brand?.domain})`} />
          <InfoItem label="検知元" value={threat.source} />
          <InfoItem
            label="登録日"
            value={whois?.creationDate ? formatDateShort(whois.creationDate) : '—'}
          />
          <InfoItem
            label={<GlossaryTerm term="レジストラ">レジストラ</GlossaryTerm>}
            value={whois?.registrar || '—'}
          />
          <InfoItem label="ホスティング" value={probe?.ip || '—'} mono />
          <InfoItem label="IPアドレス" value={probe?.ip || '—'} mono />
          <InfoItem label="国" value={whois?.registrantCountry || '—'} />
          <InfoItem label="初回検知" value={formatDate(threat.firstSeen)} />
        </dl>
      </div>

      {/* 統合削除申請セクション */}
      <UnifiedTakedownSection threat={threat} />
    </div>
  );
}

// ─── Unified Takedown Section ───────────────────────────────────────────────

function UnifiedTakedownSection({ threat }: { threat: any }) {
  // Browser reports state
  const [browserReports, setBrowserReports] = useState<any[]>([]);
  const [manualUrls, setManualUrls] = useState<{ google?: string; microsoft?: string }>({});
  const [loadingBrowser, setLoadingBrowser] = useState(false);
  const [submittingGoogle, setSubmittingGoogle] = useState(false);
  const [submittingMicrosoft, setSubmittingMicrosoft] = useState(false);

  // Registrar/Police/JPCERT state
  const [registrar, setRegistrar] = useState('');
  const [abuseEmail, setAbuseEmail] = useState('');
  const [policeRecipient, setPoliceRecipient] = useState<{ name: string; email: string } | null>(null);
  const [jpcertRecipient, setJpcertRecipient] = useState<{ name: string; email: string } | null>(null);
  const [loadingContacts, setLoadingContacts] = useState(false);

  // Selection state
  const [sendToRegistrar, setSendToRegistrar] = useState(true);
  const [sendToPolice, setSendToPolice] = useState(false);
  const [sendToJpcert, setSendToJpcert] = useState(false);

  // Template generation state
  const [registrarTemplate, setRegistrarTemplate] = useState('');
  const [policeTemplate, setPoliceTemplate] = useState('');
  const [jpcertTemplate, setJpcertTemplate] = useState('');
  const [generatingRegistrar, setGeneratingRegistrar] = useState(false);
  const [generatingPolice, setGeneratingPolice] = useState(false);
  const [generatingJpcert, setGeneratingJpcert] = useState(false);

  // Submission state
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Expanded sections
  const [expandedSection, setExpandedSection] = useState<'browser' | 'registrar' | 'police' | 'jpcert' | null>(null);

  // Fetch browser reports
  const fetchBrowserReports = useCallback(async () => {
    setLoadingBrowser(true);
    try {
      const data = await getBrowserReports(threat.id);
      setBrowserReports(data.reports || []);
      setManualUrls(data.manualUrls || {});
    } catch {
      // silently fail
    } finally {
      setLoadingBrowser(false);
    }
  }, [threat.id]);

  // Fetch abuse contacts
  const fetchAbuseContacts = useCallback(async () => {
    setLoadingContacts(true);
    try {
      const data = await getBulkAbuseContacts([threat.id]);
      if (data.threats?.length > 0) {
        const t = data.threats[0];
        setRegistrar(t.registrar || '');
        setAbuseEmail(t.abuseEmail || '');
      }
      if (data.policeRecipient) {
        setPoliceRecipient(data.policeRecipient);
      }
      if (data.jpcertRecipient) {
        setJpcertRecipient(data.jpcertRecipient);
      }
    } catch {
      // silently fail
    } finally {
      setLoadingContacts(false);
    }
  }, [threat.id]);

  useEffect(() => {
    fetchBrowserReports();
    fetchAbuseContacts();
  }, [fetchBrowserReports, fetchAbuseContacts]);

  const googleReport = browserReports.find((r: any) => r.provider === 'GOOGLE_SAFE_BROWSING');
  const microsoftReport = browserReports.find((r: any) => r.provider === 'MICROSOFT_SMARTSCREEN');

  const handleSubmitGoogle = async () => {
    setSubmittingGoogle(true);
    setError('');
    setSuccess('');
    try {
      await submitGoogleReport(threat.id);
      setSuccess('Google Safe Browsingへの申請が完了しました');
      await fetchBrowserReports();
    } catch (e: any) {
      setError(e.message || 'Google Safe Browsingへの申請に失敗しました');
    } finally {
      setSubmittingGoogle(false);
    }
  };

  const handleSubmitMicrosoft = async () => {
    setSubmittingMicrosoft(true);
    setError('');
    setSuccess('');
    try {
      await submitMicrosoftReport(threat.id);
      setSuccess('Microsoft SmartScreenへの申請が完了しました');
      await fetchBrowserReports();
    } catch (e: any) {
      setError(e.message || 'Microsoft SmartScreenへの申請に失敗しました');
    } finally {
      setSubmittingMicrosoft(false);
    }
  };

  const generateTemplate = async (type: 'registrar' | 'police' | 'jpcert') => {
    const setGenerating = type === 'registrar' ? setGeneratingRegistrar : type === 'police' ? setGeneratingPolice : setGeneratingJpcert;
    const setTemplate = type === 'registrar' ? setRegistrarTemplate : type === 'police' ? setPoliceTemplate : setJpcertTemplate;
    const email = type === 'registrar' ? abuseEmail : type === 'police' ? policeRecipient?.email : jpcertRecipient?.email;

    if (!email) return;

    setGenerating(true);
    setError('');
    try {
      const res = await generateBatchTemplate({
        threatIds: [threat.id],
        abuseEmail: email,
        registrar: registrar,
        language: 'ja',
        recipientType: type,
      });
      setTemplate(res.template);
    } catch (e: any) {
      setError(`テンプレート生成に失敗しました: ${e.message}`);
    } finally {
      setGenerating(false);
    }
  };

  const handleSendTakedown = async (type: 'registrar' | 'police' | 'jpcert') => {
    const template = type === 'registrar' ? registrarTemplate : type === 'police' ? policeTemplate : jpcertTemplate;
    const email = type === 'registrar' ? abuseEmail : type === 'police' ? policeRecipient?.email : jpcertRecipient?.email;
    const recipientName = type === 'registrar' ? registrar : type === 'police' ? policeRecipient?.name : jpcertRecipient?.name;

    if (!email || !template) return;

    setSubmitting(true);
    setError('');
    try {
      await submitBatchTakedown([{
        threatId: threat.id,
        abuseEmail: email,
        template,
        language: 'ja',
        evidenceTypes: 'screenshot,whois',
        recipientType: type,
        recipientName,
      }]);
      const labels = { registrar: 'レジストラ', police: '警視庁', jpcert: 'JPCERT/CC' };
      setSuccess(`${labels[type]}への削除申請を送信しました`);
      setExpandedSection(null);
    } catch (e: any) {
      setError(e.message || '送信に失敗しました');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (report: any) => {
    if (!report) {
      return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-surface-elevated text-[var(--text-secondary)]">未申請</span>;
    }
    if (report.status === 'error') {
      return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300">エラー</span>;
    }
    if (report.status === 'confirmed') {
      return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300">確認済み</span>;
    }
    return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">申請済み</span>;
  };

  return (
    <div id="unified-takedown-section" className="bg-surface-card rounded-xl border border-[var(--border-default)] p-6">
      <h2 className="text-lg font-bold text-[var(--text-primary)] mb-2">
        📋 削除申請
      </h2>
      <p className="text-sm text-[var(--text-secondary)] mb-4">
        この脅威を削除するために、以下の機関・サービスに申請できます。
      </p>

      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300 text-sm">{error}</div>
      )}
      {success && (
        <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg text-green-700 dark:text-green-300 text-sm">{success}</div>
      )}

      <div className="space-y-3">
        {/* 1. ブラウザ削除申請 */}
        <div className="border border-[var(--border-default)] rounded-lg overflow-hidden">
          <button
            onClick={() => setExpandedSection(expandedSection === 'browser' ? null : 'browser')}
            className="w-full flex items-center justify-between p-4 bg-surface-base hover:bg-surface-elevated transition-colors"
          >
            <div className="flex items-center gap-3">
              <span className="text-xl">🛡️</span>
              <div className="text-left">
                <h3 className="font-medium text-[var(--text-primary)]">ブラウザ削除申請</h3>
                <p className="text-xs text-[var(--text-secondary)]">Google Safe Browsing / Microsoft SmartScreen</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {getStatusBadge(googleReport)}
              {getStatusBadge(microsoftReport)}
              <span className="text-gray-400">{expandedSection === 'browser' ? '▲' : '▼'}</span>
            </div>
          </button>
          {expandedSection === 'browser' && (
            <div className="p-4 border-t border-[var(--border-default)] space-y-3">
              <p className="text-sm text-[var(--text-secondary)] mb-3">
                ブラウザのフィッシング保護機能にこのURLを報告し、ユーザーがアクセスした際に警告を表示させます。
              </p>
              {loadingBrowser ? (
                <div className="flex items-center gap-2 py-4 justify-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600" />
                  <span className="text-sm text-[var(--text-secondary)]">読み込み中...</span>
                </div>
              ) : (
                <>
                  {/* Google Safe Browsing */}
                  <div className="flex items-center justify-between p-3 bg-surface-card rounded-lg border border-[var(--border-default)]">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">Google Safe Browsing</span>
                      {getStatusBadge(googleReport)}
                    </div>
                    <div className="flex items-center gap-2">
                      {manualUrls.google && (
                        <a href={manualUrls.google} target="_blank" rel="noopener noreferrer" className="px-3 py-1 text-xs text-blue-600 border border-blue-200 rounded">手動申請</a>
                      )}
                      {(!googleReport || googleReport.status === 'error') && (
                        <button onClick={handleSubmitGoogle} disabled={submittingGoogle} className="px-3 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 disabled:opacity-50">
                          {submittingGoogle ? '申請中...' : '申請'}
                        </button>
                      )}
                    </div>
                  </div>
                  {/* Microsoft SmartScreen */}
                  <div className="flex items-center justify-between p-3 bg-surface-card rounded-lg border border-[var(--border-default)]">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">Microsoft SmartScreen</span>
                      {getStatusBadge(microsoftReport)}
                    </div>
                    <div className="flex items-center gap-2">
                      {manualUrls.microsoft && (
                        <a href={manualUrls.microsoft} target="_blank" rel="noopener noreferrer" className="px-3 py-1 text-xs text-blue-600 border border-blue-200 rounded">手動申請</a>
                      )}
                      {(!microsoftReport || microsoftReport.status === 'error') && (
                        <button onClick={handleSubmitMicrosoft} disabled={submittingMicrosoft} className="px-3 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 disabled:opacity-50">
                          {submittingMicrosoft ? '申請中...' : '申請'}
                        </button>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* 2. レジストラ削除申請 */}
        <div className="border border-[var(--border-default)] rounded-lg overflow-hidden">
          <button
            onClick={() => setExpandedSection(expandedSection === 'registrar' ? null : 'registrar')}
            className="w-full flex items-center justify-between p-4 bg-surface-base hover:bg-surface-elevated transition-colors"
          >
            <div className="flex items-center gap-3">
              <span className="text-xl">📧</span>
              <div className="text-left">
                <h3 className="font-medium text-[var(--text-primary)]">レジストラ削除申請</h3>
                <p className="text-xs text-[var(--text-secondary)]">{registrar || 'ドメイン登録管理会社'}に直接削除を依頼</p>
              </div>
            </div>
            <span className="text-gray-400">{expandedSection === 'registrar' ? '▲' : '▼'}</span>
          </button>
          {expandedSection === 'registrar' && (
            <div className="p-4 border-t border-[var(--border-default)] space-y-4">
              {loadingContacts ? (
                <div className="flex items-center gap-2 py-4 justify-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600" />
                  <span className="text-sm text-[var(--text-secondary)]">連絡先を取得中...</span>
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">レジストラ</label>
                    <p className="text-sm">{registrar || '不明'}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">通報先メールアドレス</label>
                    <input
                      type="email"
                      value={abuseEmail}
                      onChange={(e) => setAbuseEmail(e.target.value)}
                      placeholder="abuse@registrar.com"
                      className="w-full px-3 py-2 border border-[var(--border-default)] rounded-lg text-sm"
                    />
                  </div>
                  {!registrarTemplate ? (
                    <Button variant="primary" onClick={() => generateTemplate('registrar')} disabled={generatingRegistrar || !abuseEmail}>
                      {generatingRegistrar ? '生成中...' : '削除申請文面を生成'}
                    </Button>
                  ) : (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">申請内容（編集可能）</label>
                        <textarea value={registrarTemplate} onChange={(e) => setRegistrarTemplate(e.target.value)} rows={10} className="w-full px-3 py-2 border border-[var(--border-default)] rounded-lg text-xs font-mono" />
                      </div>
                      <div className="flex gap-2">
                        <Button variant="ghost" onClick={() => generateTemplate('registrar')} disabled={generatingRegistrar}>再生成</Button>
                        <Button variant="danger" onClick={() => handleSendTakedown('registrar')} disabled={submitting}>
                          {submitting ? '送信中...' : '申請を送信'}
                        </Button>
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* 3. 警視庁へのフィッシング報告 */}
        {policeRecipient && (
          <div className="border border-[var(--border-default)] rounded-lg overflow-hidden">
            <button
              onClick={() => setExpandedSection(expandedSection === 'police' ? null : 'police')}
              className="w-full flex items-center justify-between p-4 bg-surface-base hover:bg-surface-elevated transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="text-xl">🚔</span>
                <div className="text-left">
                  <h3 className="font-medium text-[var(--text-primary)]">警視庁へのフィッシング報告</h3>
                  <p className="text-xs text-[var(--text-secondary)]">{policeRecipient.name}</p>
                </div>
              </div>
              <span className="text-gray-400">{expandedSection === 'police' ? '▲' : '▼'}</span>
            </button>
            {expandedSection === 'police' && (
              <div className="p-4 border-t border-[var(--border-default)] space-y-4">
                <p className="text-sm text-[var(--text-secondary)]">
                  警視庁サイバー犯罪対策課に情報提供します。フィッシングサイトの捜査・対応に活用されます。
                </p>
                <div className="text-sm">
                  <span className="text-[var(--text-secondary)]">送信先: </span>
                  <span className="font-mono">{policeRecipient.email}</span>
                </div>
                {!policeTemplate ? (
                  <Button variant="primary" onClick={() => generateTemplate('police')} disabled={generatingPolice}>
                    {generatingPolice ? '生成中...' : 'フィッシング報告文面を生成'}
                  </Button>
                ) : (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">情報提供内容（編集可能）</label>
                      <textarea value={policeTemplate} onChange={(e) => setPoliceTemplate(e.target.value)} rows={10} className="w-full px-3 py-2 border border-[var(--border-default)] rounded-lg text-xs font-mono" />
                    </div>
                    <div className="flex gap-2">
                      <Button variant="ghost" onClick={() => generateTemplate('police')} disabled={generatingPolice}>再生成</Button>
                      <Button variant="danger" onClick={() => handleSendTakedown('police')} disabled={submitting}>
                        {submitting ? '送信中...' : '情報提供を送信'}
                      </Button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* 4. JPCERT/CCへのフィッシング報告 */}
        {jpcertRecipient && (
          <div className="border border-[var(--border-default)] rounded-lg overflow-hidden">
            <button
              onClick={() => setExpandedSection(expandedSection === 'jpcert' ? null : 'jpcert')}
              className="w-full flex items-center justify-between p-4 bg-surface-base hover:bg-surface-elevated transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="text-xl">🛡️</span>
                <div className="text-left">
                  <h3 className="font-medium text-[var(--text-primary)]">JPCERT/CCへのフィッシング報告</h3>
                  <p className="text-xs text-[var(--text-secondary)]">日本のセキュリティインシデント対応機関</p>
                </div>
              </div>
              <span className="text-gray-400">{expandedSection === 'jpcert' ? '▲' : '▼'}</span>
            </button>
            {expandedSection === 'jpcert' && (
              <div className="p-4 border-t border-[var(--border-default)] space-y-4">
                <p className="text-sm text-[var(--text-secondary)]">
                  JPCERT/CCはフィッシングサイトの早期閉鎖を支援する機関です。報告することで対応が促進されます。
                </p>
                <div className="text-sm">
                  <span className="text-[var(--text-secondary)]">送信先: </span>
                  <span className="font-mono">{jpcertRecipient.email}</span>
                </div>
                {!jpcertTemplate ? (
                  <Button variant="primary" onClick={() => generateTemplate('jpcert')} disabled={generatingJpcert}>
                    {generatingJpcert ? '生成中...' : 'フィッシング報告文面を生成'}
                  </Button>
                ) : (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">報告内容（編集可能）</label>
                      <textarea value={jpcertTemplate} onChange={(e) => setJpcertTemplate(e.target.value)} rows={10} className="w-full px-3 py-2 border border-[var(--border-default)] rounded-lg text-xs font-mono" />
                    </div>
                    <div className="flex gap-2">
                      <Button variant="ghost" onClick={() => generateTemplate('jpcert')} disabled={generatingJpcert}>再生成</Button>
                      <Button variant="danger" onClick={() => handleSendTakedown('jpcert')} disabled={submitting}>
                        {submitting ? '送信中...' : '報告を送信'}
                      </Button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Browser Report Section (deprecated, kept for reference) ────────────────

function BrowserReportSection({ threat }: { threat: any }) {
  const [reports, setReports] = useState<any[]>([]);
  const [manualUrls, setManualUrls] = useState<{ google?: string; microsoft?: string }>({});
  const [loadingReports, setLoadingReports] = useState(false);
  const [submittingGoogle, setSubmittingGoogle] = useState(false);
  const [submittingMicrosoft, setSubmittingMicrosoft] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fetchReports = useCallback(async () => {
    setLoadingReports(true);
    try {
      const data = await getBrowserReports(threat.id);
      setReports(data.reports || []);
      setManualUrls(data.manualUrls || {});
    } catch {
      // silently fail — section will show empty state
    } finally {
      setLoadingReports(false);
    }
  }, [threat.id]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const googleReport = reports.find((r: any) => r.provider === 'GOOGLE_SAFE_BROWSING');
  const microsoftReport = reports.find((r: any) => r.provider === 'MICROSOFT_SMARTSCREEN');

  const handleSubmitGoogle = async () => {
    setSubmittingGoogle(true);
    setError('');
    setSuccess('');
    try {
      await submitGoogleReport(threat.id);
      setSuccess('Google Safe Browsingへの申請が完了しました');
      await fetchReports();
    } catch (e: any) {
      setError(e.message || 'Google Safe Browsingへの申請に失敗しました');
    } finally {
      setSubmittingGoogle(false);
    }
  };

  const handleSubmitMicrosoft = async () => {
    setSubmittingMicrosoft(true);
    setError('');
    setSuccess('');
    try {
      await submitMicrosoftReport(threat.id);
      setSuccess('Microsoft SmartScreenへの申請が完了しました');
      await fetchReports();
    } catch (e: any) {
      setError(e.message || 'Microsoft SmartScreenへの申請に失敗しました');
    } finally {
      setSubmittingMicrosoft(false);
    }
  };

  const getStatusBadge = (report: any) => {
    if (!report) {
      return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-surface-elevated text-[var(--text-secondary)]">未申請</span>;
    }
    if (report.status === 'error') {
      return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300">エラー</span>;
    }
    if (report.status === 'confirmed') {
      return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300">確認済み</span>;
    }
    return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">申請済み</span>;
  };

  return (
    <div className="bg-surface-card rounded-xl border border-[var(--border-default)] p-6">
      <h2 className="text-lg font-bold text-[var(--text-primary)] mb-4 flex items-center gap-2">
        🛡️ ブラウザ削除申請
      </h2>
      <p className="text-sm text-[var(--text-secondary)] mb-4">
        ブラウザのフィッシング保護機能にこのURLを報告し、ユーザーがアクセスした際に警告を表示させます。
      </p>

      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300 text-sm">{error}</div>
      )}
      {success && (
        <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg text-green-700 dark:text-green-300 text-sm">{success}</div>
      )}

      {loadingReports ? (
        <div className="flex items-center gap-3 py-4 justify-center">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600" />
          <span className="text-sm text-[var(--text-secondary)]">読み込み中...</span>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Google Safe Browsing */}
          <div className="flex items-center justify-between p-4 bg-surface-base rounded-lg border border-[var(--border-default)]">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-medium text-[var(--text-primary)]">Google Safe Browsing</span>
                {getStatusBadge(googleReport)}
              </div>
              {googleReport?.submittedAt && (
                <p className="text-xs text-[var(--text-secondary)]">申請日: {formatDate(googleReport.submittedAt)}</p>
              )}
              {googleReport?.status === 'error' && googleReport.errorMessage && (
                <p className="text-xs text-red-600 dark:text-red-400 mt-1">{googleReport.errorMessage}</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              {manualUrls.google && (
                <a
                  href={manualUrls.google}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 border border-blue-200 dark:border-blue-800 rounded-lg"
                >
                  手動申請
                </a>
              )}
              {(!googleReport || googleReport.status === 'error') && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleSubmitGoogle}
                  disabled={submittingGoogle}
                >
                  {submittingGoogle ? '申請中...' : googleReport?.status === 'error' ? '再申請' : 'Google Safe Browsingに申請'}
                </Button>
              )}
            </div>
          </div>

          {/* Microsoft SmartScreen */}
          <div className="flex items-center justify-between p-4 bg-surface-base rounded-lg border border-[var(--border-default)]">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-medium text-[var(--text-primary)]">Microsoft SmartScreen</span>
                {getStatusBadge(microsoftReport)}
              </div>
              {microsoftReport?.submittedAt && (
                <p className="text-xs text-[var(--text-secondary)]">申請日: {formatDate(microsoftReport.submittedAt)}</p>
              )}
              {microsoftReport?.status === 'error' && microsoftReport.errorMessage && (
                <p className="text-xs text-red-600 dark:text-red-400 mt-1">{microsoftReport.errorMessage}</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              {manualUrls.microsoft && (
                <a
                  href={manualUrls.microsoft}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 border border-blue-200 dark:border-blue-800 rounded-lg"
                >
                  手動申請
                </a>
              )}
              {(!microsoftReport || microsoftReport.status === 'error') && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleSubmitMicrosoft}
                  disabled={submittingMicrosoft}
                >
                  {submittingMicrosoft ? '申請中...' : microsoftReport?.status === 'error' ? '再申請' : 'SmartScreenに申請'}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tab 2: スクリーンショット (Screenshots) ────────────────────────────────

function ScreenshotsTab({ threat, probe, probing, onProbe }: {
  threat: any; probe: any; probing: boolean; onProbe: () => void;
}) {
  return (
    <div className="space-y-6">
      {/* Detected site screenshot */}
      <div className="bg-surface-card rounded-xl border border-red-200 dark:border-red-800 p-6">
        <div className="flex items-center gap-2 mb-3">
          <span className="px-2 py-0.5 bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 rounded text-xs font-bold">検知サイト</span>
          <h3 className="text-sm font-bold text-[var(--text-primary)] font-mono">{threat.domain}</h3>
        </div>
        {threat.screenshotUrl ? (
          <>
            <img
              src={threat.screenshotUrl}
              alt={`${threat.domain} のスクリーンショット`}
              className="w-full max-w-2xl rounded-lg border border-[var(--border-default)]"
            />
            {probe?.probeAt && (
              <p className="text-xs text-[var(--text-tertiary)] mt-2">
                撮影日時: {formatDate(probe.probeAt)}
              </p>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-48 bg-surface-base rounded-lg border border-dashed border-[var(--border-default)]">
            <p className="text-[var(--text-tertiary)] text-sm mb-3">スクリーンショット未取得</p>
            <Button
              variant="primary"
              onClick={onProbe}
              disabled={probing}
            >
              {probing ? '取得中...' : 'サイトを調査して取得'}
            </Button>
          </div>
        )}
      </div>

      {/* Re-probe button */}
      <div className="flex justify-center gap-3">
        {threat.screenshotUrl && (
          <Button
            variant="ghost"
            onClick={onProbe}
            disabled={probing}
          >
            {probing ? '再取得中...' : 'スクリーンショットを再取得'}
          </Button>
        )}
      </div>
    </div>
  );
}

// ─── Tab 3: 技術詳細 (Technical Details) ────────────────────────────────────

function TechnicalTab({ threat, whois, ssl, probe }: {
  threat: any; whois: any; ssl: any; probe: any;
}) {
  const handleExportJson = () => {
    const data = {
      domain: threat.domain,
      riskScore: threat.riskScore,
      status: threat.status,
      firstSeen: threat.firstSeen,
      lastSeen: threat.lastSeen,
      whoisData: whois,
      sslInfo: ssl,
      webProbe: probe ? {
        httpStatus: probe.httpStatus,
        finalUrl: probe.finalUrl,
        ip: probe.ip,
        dnsResolved: probe.dnsResolved,
        headers: parseJson(probe.headers),
        probeAt: probe.probeAt,
      } : null,
      analyses: threat.analyses,
      takedowns: threat.takedowns,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `threat-${threat.domain}-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportCsv = () => {
    const rows = [
      ['項目', '値'],
      ['ドメイン', threat.domain],
      ['リスクスコア', String(threat.riskScore ?? '')],
      ['ステータス', statusLabels[threat.status] || threat.status],
      ['初回検知', threat.firstSeen],
      ['レジストラ', whois?.registrar || ''],
      ['登録日', whois?.creationDate || ''],
      ['IPアドレス', probe?.ip || ''],
      ['HTTP応答', String(probe?.httpStatus ?? '')],
      ['SSL発行者', ssl?.issuer || ''],
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `threat-${threat.domain}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const probeHeaders = parseJson(probe?.headers);

  return (
    <div className="space-y-6">
      {/* Export buttons */}
      <div className="flex gap-3">
        <Button variant="ghost" onClick={handleExportJson}>
          JSONエクスポート
        </Button>
        <Button variant="ghost" onClick={handleExportCsv}>
          CSVエクスポート
        </Button>
      </div>

      {/* DNS / Web Probe */}
      <TechSection title="DNS / Web Probe">
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm mb-3">
          <InfoItem label="DNS解決" value={probe?.dnsResolved ? '解決済み' : '未解決'} />
          <InfoItem label="IPアドレス" value={probe?.ip || '—'} mono />
          <InfoItem label="HTTP Status" value={probe?.httpStatus != null ? String(probe.httpStatus) : '—'} mono />
          <InfoItem label="最終URL" value={probe?.finalUrl || '—'} mono />
        </dl>
      </TechSection>

      {/* Full WHOIS */}
      <TechSection title="WHOIS">
        {whois ? (
          <pre className="text-xs text-[var(--text-secondary)] overflow-x-auto whitespace-pre-wrap max-h-80 bg-surface-base rounded-lg p-3">
            {JSON.stringify(whois, null, 2)}
          </pre>
        ) : (
          <p className="text-sm text-[var(--text-tertiary)]">WHOIS情報未取得</p>
        )}
      </TechSection>

      {/* HTTP Response Headers */}
      <TechSection title="HTTP レスポンスヘッダー">
        {probeHeaders ? (
          <pre className="text-xs text-[var(--text-secondary)] overflow-x-auto whitespace-pre-wrap max-h-80 bg-surface-base rounded-lg p-3">
            {JSON.stringify(probeHeaders, null, 2)}
          </pre>
        ) : (
          <p className="text-sm text-[var(--text-tertiary)]">ヘッダー情報未取得</p>
        )}
      </TechSection>

      {/* SSL Certificate */}
      <TechSection title="SSL証明書">
        {ssl ? (
          <>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm mb-3">
              <InfoItem label="発行者 (Issuer)" value={ssl.issuer || '—'} />
              <InfoItem label="有効開始 (Valid From)" value={ssl.validFrom ? formatDate(ssl.validFrom) : '—'} />
              <InfoItem label="有効期限 (Valid To)" value={ssl.validTo ? formatDate(ssl.validTo) : '—'} />
              <InfoItem label="SAN" value={ssl.subjectAlternativeName || ssl.san || '—'} />
            </dl>
            <details>
              <summary className="text-xs text-blue-600 cursor-pointer hover:text-blue-800 font-medium">Raw SSL Data</summary>
              <pre className="mt-2 text-xs text-[var(--text-secondary)] overflow-x-auto whitespace-pre-wrap max-h-60 bg-surface-base rounded-lg p-3">
                {JSON.stringify(ssl, null, 2)}
              </pre>
            </details>
          </>
        ) : (
          <p className="text-sm text-[var(--text-tertiary)]">SSL情報未取得</p>
        )}
      </TechSection>

      {/* Raw HTML snippet */}
      {probe?.htmlSnippet && (
        <TechSection title="HTMLスニペット">
          <pre className="text-xs text-[var(--text-secondary)] overflow-x-auto whitespace-pre-wrap max-h-60 bg-surface-base rounded-lg p-3">
            {probe.htmlSnippet}
          </pre>
        </TechSection>
      )}
    </div>
  );
}

// ─── Tab 4: 対応履歴 (Response History) ─────────────────────────────────────

function HistoryTab({ threat }: { threat: any }) {
  // Build timeline from detection + analyses + probes + takedowns
  const events: Array<{ date: string; type: string; title: string; detail: string; color: string }> = [];

  // Detection
  events.push({
    date: threat.firstSeen,
    type: '検知',
    title: 'ドメインを検知しました',
    detail: `検知元: ${threat.source}`,
    color: 'blue',
  });

  // Analyses
  threat.analyses?.forEach((a: any) => {
    events.push({
      date: a.analyzedAt,
      type: '分析',
      title: `AI分析完了: ${categoryLabels[a.category] || a.category}`,
      detail: `判定確度 ${Math.round(a.confidence * 100)}%`,
      color: a.confidence >= 0.8 ? 'red' : 'yellow',
    });
  });

  // Web probes
  threat.webProbes?.forEach((p: any) => {
    events.push({
      date: p.probeAt,
      type: '調査',
      title: `サイト調査実施`,
      detail: p.httpStatus ? `HTTP ${p.httpStatus}${p.dnsResolved ? '' : '（DNS未解決）'}` : (p.error || 'エラー'),
      color: p.httpStatus === 200 ? 'orange' : 'gray',
    });
  });

  // Takedowns
  threat.takedowns?.forEach((td: any) => {
    events.push({
      date: td.createdAt,
      type: '削除申請',
      title: `削除申請を作成: ${td.registrar}`,
      detail: td.abuseEmail ? `送信先: ${td.abuseEmail}` : '',
      color: 'red',
    });
    if (td.sentAt) {
      events.push({
        date: td.sentAt,
        type: '送信',
        title: '削除申請を送信しました',
        detail: `送信先: ${td.abuseEmail || td.registrar}`,
        color: 'orange',
      });
    }
    if (td.respondedAt) {
      events.push({
        date: td.respondedAt,
        type: '回答',
        title: 'レジストラから回答がありました',
        detail: `ステータス: ${td.status}`,
        color: td.status === 'completed' ? 'green' : 'yellow',
      });
    }
  });

  // Status changes
  threat.statusLogs?.forEach((log: any) => {
    events.push({
      date: log.createdAt,
      type: 'ステータス変更',
      title: `${statusLabels[log.fromStatus] || log.fromStatus} → ${statusLabels[log.toStatus] || log.toStatus}`,
      detail: log.changedBy ? `変更者: ${log.changedBy}` : '',
      color: log.toStatus === 'resolved' ? 'green' : log.toStatus === 'false_positive' ? 'gray' : 'blue',
    });
  });

  // Sort by date descending (newest first)
  events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const colorMap: Record<string, string> = {
    blue: 'bg-blue-500',
    red: 'bg-red-500',
    orange: 'bg-orange-500',
    yellow: 'bg-yellow-500',
    green: 'bg-green-500',
    gray: 'bg-gray-400',
  };

  if (events.length === 0) {
    return <p className="text-center py-12 text-[var(--text-tertiary)]">対応履歴はまだありません</p>;
  }

  return (
    <div className="bg-surface-card rounded-xl border border-[var(--border-default)] p-6">
      <div className="space-y-0">
        {events.map((ev, i) => (
          <div key={i} className="relative pl-8 pb-6 last:pb-0">
            {/* Connector line */}
            {i < events.length - 1 && (
              <div className="absolute left-[11px] top-6 bottom-0 w-0.5 bg-[var(--border-default)]" />
            )}
            {/* Dot */}
            <div className={`absolute left-0 top-1 w-6 h-6 rounded-full ${colorMap[ev.color]} flex items-center justify-center`}>
              <div className="w-2 h-2 bg-surface-card rounded-full" />
            </div>

            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-xs font-bold text-[var(--text-secondary)]">{ev.type}</span>
                <span className="text-xs text-[var(--text-tertiary)]">{formatDate(ev.date)}</span>
              </div>
              <p className="text-sm font-medium text-[var(--text-primary)]">{ev.title}</p>
              {ev.detail && <p className="text-xs text-[var(--text-secondary)] mt-0.5">{ev.detail}</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Takedown Modal ─────────────────────────────────────────────────────────

function TakedownModal({ threat, step, error, success, registrar, abuseEmail, template, currentTakedownId, onAbuseEmailChange, onTemplateChange, onGenerate, onSend, onClose }: {
  threat: any;
  step: TakedownStep;
  error: string;
  success: string;
  registrar: string;
  abuseEmail: string;
  template: string;
  currentTakedownId: string | null;
  onAbuseEmailChange: (v: string) => void;
  onTemplateChange: (v: string) => void;
  onGenerate: () => void;
  onSend: () => void;
  onClose: () => void;
}) {
  const toast = useToast();
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-surface-card rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="p-6">
          {/* Modal header */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-[var(--text-primary)]">削除申請</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-[var(--text-secondary)] text-xl">&times;</button>
          </div>

          {/* Target info */}
          <div className="bg-surface-base rounded-lg p-3 mb-4">
            <div className="flex items-center gap-3">
              <span className="font-mono text-sm font-medium">{threat.domain}</span>
              <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                (threat.riskScore ?? 0) >= 80 ? 'bg-red-100 text-red-700 dark:text-red-300' :
                (threat.riskScore ?? 0) >= 60 ? 'bg-orange-100 text-orange-700 dark:text-orange-300' :
                'bg-yellow-100 text-yellow-700 dark:text-yellow-300'
              }`}>
                {getRiskEmoji(threat.riskScore)} {getRiskLabel(threat.riskScore)}
              </span>
            </div>
          </div>

          {/* Error / Success messages */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300 text-sm">{error}</div>
          )}
          {success && (
            <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg text-green-700 dark:text-green-300 text-sm">{success}</div>
          )}

          {/* Step: Loading contacts */}
          {step === 'loading_contacts' && (
            <div className="flex items-center gap-3 py-8 justify-center">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600" />
              <span className="text-sm text-[var(--text-secondary)]">WHOIS情報から通報先を取得中...</span>
            </div>
          )}

          {/* Step: Confirm recipient */}
          {step === 'confirm_recipient' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">
                  <GlossaryTerm term="レジストラ">レジストラ</GlossaryTerm>
                </label>
                <p className="text-sm font-medium text-[var(--text-primary)]">{registrar || '不明'}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">
                  <GlossaryTerm term="abuse連絡先">通報先メールアドレス</GlossaryTerm>
                </label>
                <input
                  type="email"
                  value={abuseEmail}
                  onChange={(e) => onAbuseEmailChange(e.target.value)}
                  placeholder="abuse@registrar.com"
                  className="w-full px-3 py-2 border border-[var(--border-default)] rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                {abuseEmail
                  ? <p className="mt-1 text-xs text-green-600">WHOISから自動取得しました（変更可能）</p>
                  : <p className="mt-1 text-xs text-amber-600">自動取得できませんでした。手動で入力してください。</p>
                }
              </div>

              <div className="flex gap-3 pt-2">
                <Button variant="primary" onClick={onGenerate}>
                  削除申請文面を生成
                </Button>
                <Button variant="ghost" onClick={onClose}>
                  キャンセル
                </Button>
              </div>
            </div>
          )}

          {/* Step: Generating */}
          {step === 'generating' && (
            <div className="flex items-center gap-3 py-8 justify-center">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600" />
              <span className="text-sm text-[var(--text-secondary)]">AIが削除申請文面を生成中...（30秒ほど）</span>
            </div>
          )}

          {/* Step: Review */}
          {step === 'review' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-[var(--text-secondary)]">送信先:</span>{' '}
                  <span className="font-medium">{abuseEmail}</span>
                </div>
                <div>
                  <span className="text-[var(--text-secondary)]">レジストラ:</span>{' '}
                  <span className="font-medium">{registrar}</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">申請内容（編集可能）</label>
                <textarea
                  value={template}
                  onChange={(e) => onTemplateChange(e.target.value)}
                  rows={12}
                  className="w-full px-3 py-2 border border-[var(--border-default)] rounded-lg text-xs font-mono focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex gap-3 pt-2">
                {currentTakedownId && (
                  <Button
                    variant="ghost"
                    onClick={async () => {
                      try {
                        const token = typeof window !== 'undefined' ? localStorage.getItem('threatguard_token') : null;
                        const res = await fetch(downloadTakedownPdf(currentTakedownId), {
                          headers: token ? { Authorization: `Bearer ${token}` } : {},
                        });
                        if (!res.ok) throw new Error('PDF取得に失敗しました');
                        const blob = await res.blob();
                        const url = URL.createObjectURL(blob);
                        window.open(url, '_blank');
                      } catch (e) {
                        console.error('PDF download failed:', e);
                        toast.error('PDFの取得に失敗しました。');
                      }
                    }}
                  >
                    プレビュー (PDF)
                  </Button>
                )}
                <Button variant="ghost" onClick={onClose}>
                  キャンセル
                </Button>
                <Button variant="danger" onClick={onSend} className="ml-auto">
                  申請送信
                </Button>
              </div>
            </div>
          )}

          {/* Step: Sending */}
          {step === 'sending' && (
            <div className="flex items-center gap-3 py-8 justify-center">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600" />
              <span className="text-sm text-[var(--text-secondary)]">メールを送信中...</span>
            </div>
          )}

          {/* Step: Sent */}
          {step === 'sent' && (
            <div className="text-center py-6">
              <p className="text-green-700 dark:text-green-300 font-medium mb-4">削除申請の送信が完了しました</p>
              <Button variant="ghost" onClick={onClose}>
                閉じる
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Shared Sub-components ──────────────────────────────────────────────────

function InfoItem({ label, value, mono }: { label: React.ReactNode; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-[var(--text-secondary)] text-xs">{label}</dt>
      <dd className={`mt-0.5 font-medium text-[var(--text-primary)] ${mono ? 'font-mono text-xs' : ''}`}>{value}</dd>
    </div>
  );
}

function EvidenceRow({ label, value, bar }: { label: string; value: string; bar?: number }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm text-[var(--text-primary)]">{label}</span>
      <div className="flex items-center gap-2 shrink-0">
        {bar != null && (
          <div className="w-20 h-2 bg-[var(--border-default)] rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${bar >= 0.8 ? 'bg-red-500' : bar >= 0.6 ? 'bg-orange-500' : 'bg-yellow-500'}`}
              style={{ width: `${Math.round(bar * 100)}%` }}
            />
          </div>
        )}
        <span className="text-xs font-medium text-[var(--text-secondary)]">{value}</span>
      </div>
    </div>
  );
}

function TechSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-surface-card rounded-xl border border-[var(--border-default)] p-6">
      <h3 className="text-sm font-bold text-[var(--text-primary)] mb-3">{title}</h3>
      {children}
    </div>
  );
}

// ─── Extended danger summary for overview tab ───────────────────────────────

function getDangerSummaryDetailed(threat: any, analysis: any, contentAnalysis: any, probe: any): string {
  const parts: string[] = [];
  const brand = threat.brand?.domain || '';
  const category = analysis?.category;

  if (category === 'phishing') {
    parts.push(`このドメイン「${threat.domain}」は、御社サイト「${brand}」を模倣したフィッシングサイトと判定されています。`);
  } else if (category === 'brand_abuse') {
    parts.push(`このドメインは御社ブランドを無断で使用しており、顧客が誤って信頼する可能性があります。`);
  } else if (category === 'parked') {
    parts.push(`このドメインは現在未使用ですが、御社名に酷似しているため、今後フィッシングに使われるリスクがあります。`);
  } else {
    parts.push(`このドメインは御社ブランドとの関連性が疑われるため、監視対象に追加されました。`);
  }

  if (contentAnalysis?.hasLoginForm) {
    parts.push('偽のログイン画面が検出されています。');
  }
  if (contentAnalysis?.logoDetected) {
    parts.push('御社ロゴの無断使用が疑われます。');
  }
  if (probe?.httpStatus === 200) {
    parts.push('現在もサイトが稼働中であり、早急な対応が推奨されます。');
  }

  return parts.join('');
}
