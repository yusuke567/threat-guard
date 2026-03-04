'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { getThreat, generateTakedown, getAbuseContacts, sendTakedownEmail, downloadTakedownPdf, getContentAnalysis, triggerProbe } from '@/lib/api';
import { RiskBadgeFull } from '@/components/RiskBadge';
import GlossaryTerm from '@/components/GlossaryTerm';
import InvestigationStepper from '@/components/InvestigationStepper';

const statusColors: Record<string, string> = {
  new_domain: 'bg-blue-100 text-blue-800',
  analyzing: 'bg-yellow-100 text-yellow-800',
  confirmed_threat: 'bg-red-100 text-red-800',
  false_positive: 'bg-gray-100 text-gray-800',
  takedown_sent: 'bg-orange-100 text-orange-800',
  resolved: 'bg-green-100 text-green-800',
};

const statusLabels: Record<string, string> = {
  new_domain: '新規',
  analyzing: '分析中',
  confirmed_threat: '脅威確認',
  false_positive: '誤検知',
  takedown_sent: '削除申請中',
  resolved: '解決済',
};

const categoryLabels: Record<string, string> = {
  phishing: '🎣 フィッシング',
  brand_abuse: '⚠️ ブランド悪用',
  parked: '🅿️ パーク',
  legitimate: '✅ 正規',
  unknown: '❓ 不明',
};

type TakedownStep = 'idle' | 'loading_contacts' | 'confirm_recipient' | 'generating' | 'review' | 'sending' | 'sent';

export default function ThreatDetailPage() {
  const params = useParams();
  const [threat, setThreat] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [contentAnalysis, setContentAnalysis] = useState<any>(null);
  const [probing, setProbing] = useState(false);
  const [probeStatus, setProbeStatus] = useState<'idle' | 'running' | 'done' | 'error'>('idle');

  // Takedown flow state
  const [step, setStep] = useState<TakedownStep>('idle');
  const [abuseEmail, setAbuseEmail] = useState('');
  const [registrar, setRegistrar] = useState('');
  const [template, setTemplate] = useState('');
  const [currentTakedownId, setCurrentTakedownId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    if (params.id) {
      getThreat(params.id as string)
        .then((t) => {
          setThreat(t);
          getContentAnalysis(params.id as string).then(setContentAnalysis).catch(() => {});
        })
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [params.id]);

  const handleProbe = async () => {
    if (!threat) return;
    setProbing(true);
    setProbeStatus('running');
    try {
      await triggerProbe(threat.id);
      const updated = await getThreat(threat.id);
      setThreat(updated);
      const ca = await getContentAnalysis(threat.id);
      setContentAnalysis(ca);
      setProbeStatus('done');
      setTimeout(() => setProbeStatus('idle'), 3000);
    } catch (e) {
      console.error('Probe failed', e);
      setProbeStatus('error');
      setTimeout(() => setProbeStatus('idle'), 3000);
    } finally {
      setProbing(false);
    }
  };

  // Step 1: Start takedown — fetch abuse contacts
  const handleStartTakedown = async () => {
    setError('');
    setStep('loading_contacts');
    try {
      const contacts = await getAbuseContacts(threat.id);
      setRegistrar(contacts.registrar);
      setAbuseEmail(contacts.abuseEmail || '');
      setStep('confirm_recipient');
    } catch (e: any) {
      setError('Abuse連絡先の取得に失敗しました');
      setStep('idle');
    }
  };

  // Step 2: Generate takedown template
  const handleGenerate = async () => {
    if (!abuseEmail) {
      setError('送信先メールアドレスを入力してください');
      return;
    }
    setError('');
    setStep('generating');
    try {
      const result = await generateTakedown(threat.id);
      setTemplate(result.template);
      setCurrentTakedownId(result.id);
      setStep('review');
      // Reload threat to get updated takedowns
      const updated = await getThreat(threat.id);
      setThreat(updated);
    } catch (e: any) {
      setError('削除申請文面の生成に失敗しました');
      setStep('confirm_recipient');
    }
  };

  // Step 3: Send takedown email
  const handleSend = async () => {
    if (!currentTakedownId) return;
    setError('');
    setStep('sending');
    try {
      await sendTakedownEmail(currentTakedownId, abuseEmail);
      setStep('sent');
      setSuccessMsg(`削除申請を ${abuseEmail} に送信しました`);
      // Reload threat
      const updated = await getThreat(threat.id);
      setThreat(updated);
    } catch (e: any) {
      setError('メール送信に失敗しました');
      setStep('review');
    }
  };

  const resetFlow = () => {
    setStep('idle');
    setAbuseEmail('');
    setRegistrar('');
    setTemplate('');
    setCurrentTakedownId(null);
    setError('');
    setSuccessMsg('');
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!threat) {
    return <div className="text-center py-20 text-gray-500">脅威が見つかりません</div>;
  }

  const latestAnalysis = threat.analyses?.[0];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <a href="/threats" className="text-blue-600 hover:text-blue-700 text-sm">← 脅威一覧</a>
        <h1 className="text-2xl font-bold text-gray-900 mt-2 font-mono">{threat.domain}</h1>
        <p className="text-gray-500 mt-1">
          ブランド: {threat.brand?.name} ({threat.brand?.domain})
        </p>
      </div>

      {/* Investigation Stepper */}
      <InvestigationStepper
        threat={threat}
        contentAnalysis={contentAnalysis}
        latestAnalysis={latestAnalysis}
        probing={probing}
        probeStatus={probeStatus}
        onProbe={handleProbe}
        onStartTakedown={handleStartTakedown}
        takedownStep={step}
        takedownError={error}
        takedownSuccess={successMsg}
        registrar={registrar}
        abuseEmail={abuseEmail}
        onAbuseEmailChange={setAbuseEmail}
        onGenerate={handleGenerate}
        template={template}
        onTemplateChange={setTemplate}
        onSend={handleSend}
        onResetFlow={resetFlow}
        takedownPdfUrl={currentTakedownId ? downloadTakedownPdf(currentTakedownId) : undefined}
      />

      {/* Domain Info */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-bold mb-4">ドメイン情報</h2>
        <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
          <div>
            <dt className="text-gray-500">ステータス</dt>
            <dd className="mt-1">
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[threat.status] || 'bg-gray-100'}`}>
                {statusLabels[threat.status] || threat.status}
              </span>
            </dd>
          </div>
          <div>
            <dt className="text-gray-500">検知元</dt>
            <dd className="mt-1 font-medium">{threat.source}</dd>
          </div>
          <div>
            <dt className="text-gray-500">初回検知</dt>
            <dd className="mt-1">{new Date(threat.firstSeen).toLocaleString('ja-JP')}</dd>
          </div>
          <div>
            <dt className="text-gray-500">最終確認</dt>
            <dd className="mt-1">{new Date(threat.lastSeen).toLocaleString('ja-JP')}</dd>
          </div>
        </dl>
      </div>

      {/* WHOIS / SSL - collapsible */}
      {(threat.whoisData || threat.sslInfo) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {threat.whoisData && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-sm font-bold mb-3"><GlossaryTerm term="WHOIS">WHOIS情報</GlossaryTerm></h3>
              <pre className="text-xs text-gray-600 overflow-x-auto whitespace-pre-wrap max-h-60">
                {typeof threat.whoisData === 'string'
                  ? (() => { try { return JSON.stringify(JSON.parse(threat.whoisData), null, 2); } catch { return threat.whoisData; } })()
                  : JSON.stringify(threat.whoisData, null, 2)}
              </pre>
            </div>
          )}
          {threat.sslInfo && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-sm font-bold mb-3"><GlossaryTerm term="SSL">SSL情報</GlossaryTerm></h3>
              <pre className="text-xs text-gray-600 overflow-x-auto whitespace-pre-wrap max-h-60">
                {JSON.stringify(threat.sslInfo, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}


    </div>
  );
}
