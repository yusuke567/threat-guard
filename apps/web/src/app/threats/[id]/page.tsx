'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { getThreat, generateTakedown, getAbuseContacts, sendTakedownEmail, downloadTakedownPdf } from '@/lib/api';
import { RiskBadgeFull } from '@/components/RiskBadge';

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
  takedown_sent: 'テイクダウン済',
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
        .then(setThreat)
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [params.id]);

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
      setError('テイクダウン文面の生成に失敗しました');
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
      setSuccessMsg(`テイクダウン申請を ${abuseEmail} に送信しました`);
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

      {/* Risk Score */}
      <RiskBadgeFull score={threat.riskScore} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Domain Info */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-bold mb-4">ドメイン情報</h2>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
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

          {/* Analysis */}
          {latestAnalysis && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-lg font-bold mb-4">AI分析結果</h2>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{categoryLabels[latestAnalysis.category]?.split(' ')[0]}</span>
                  <div>
                    <div className="font-medium">
                      {categoryLabels[latestAnalysis.category] || latestAnalysis.category}
                    </div>
                    <div className="text-sm text-gray-500">
                      信頼度: {Math.round(latestAnalysis.confidence * 100)}%
                    </div>
                  </div>
                </div>
                <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-4">
                  {latestAnalysis.reasoning}
                </p>
              </div>
            </div>
          )}

          {/* Takedown Section */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <h2 className="text-lg font-bold">テイクダウン申請</h2>
              {step === 'idle' && (
                <button
                  onClick={handleStartTakedown}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium"
                >
                  🚨 テイクダウン申請を開始
                </button>
              )}
            </div>

            {/* Error */}
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {error}
              </div>
            )}

            {/* Success */}
            {successMsg && (
              <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
                ✅ {successMsg}
              </div>
            )}

            {/* Step: Loading contacts */}
            {step === 'loading_contacts' && (
              <div className="flex items-center gap-3 py-4">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600" />
                <span className="text-sm text-gray-600">WHOIS情報からabuse連絡先を取得中...</span>
              </div>
            )}

            {/* Step: Confirm recipient */}
            {step === 'confirm_recipient' && (
              <div className="space-y-4 border border-blue-200 rounded-lg p-4 bg-blue-50/50">
                <h3 className="font-medium text-sm">📧 送信先の確認</h3>
                <div className="text-sm text-gray-600">
                  レジストラ: <span className="font-medium text-gray-900">{registrar}</span>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Abuse連絡先メールアドレス
                  </label>
                  <input
                    type="email"
                    value={abuseEmail}
                    onChange={(e) => setAbuseEmail(e.target.value)}
                    placeholder="abuse@registrar.com"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  {!abuseEmail && (
                    <p className="mt-1 text-xs text-amber-600">
                      ⚠️ WHOISからabuse連絡先を自動取得できませんでした。手動で入力してください。
                    </p>
                  )}
                  {abuseEmail && (
                    <p className="mt-1 text-xs text-green-600">
                      ✅ WHOISから自動取得しました（変更可能）
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleGenerate}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
                  >
                    📝 テイクダウン文面を生成
                  </button>
                  <button
                    onClick={resetFlow}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm"
                  >
                    キャンセル
                  </button>
                </div>
              </div>
            )}

            {/* Step: Generating */}
            {step === 'generating' && (
              <div className="flex items-center gap-3 py-4">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600" />
                <span className="text-sm text-gray-600">Claude AIがテイクダウン文面を生成中...（30秒ほどかかります）</span>
              </div>
            )}

            {/* Step: Review & Confirm */}
            {step === 'review' && (
              <div className="space-y-4">
                <div className="border border-amber-200 rounded-lg p-4 bg-amber-50/50">
                  <h3 className="font-medium text-sm mb-3">📋 内容を確認してください</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm mb-3">
                    <div>
                      <span className="text-gray-500">送信先:</span>{' '}
                      <span className="font-medium">{abuseEmail}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">レジストラ:</span>{' '}
                      <span className="font-medium">{registrar}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">対象ドメイン:</span>{' '}
                      <span className="font-mono font-medium">{threat.domain}</span>
                    </div>
                  </div>
                  <textarea
                    value={template}
                    onChange={(e) => setTemplate(e.target.value)}
                    rows={15}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleSend}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium"
                  >
                    ✅ 確認して送信
                  </button>
                  <a
                    href={currentTakedownId ? downloadTakedownPdf(currentTakedownId) : '#'}
                    target="_blank"
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm inline-flex items-center"
                  >
                    📄 PDF保存
                  </a>
                  <button
                    onClick={resetFlow}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm"
                  >
                    キャンセル
                  </button>
                </div>
              </div>
            )}

            {/* Step: Sending */}
            {step === 'sending' && (
              <div className="flex items-center gap-3 py-4">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600" />
                <span className="text-sm text-gray-600">メールを送信中...</span>
              </div>
            )}

            {/* Step: Sent */}
            {step === 'sent' && (
              <div className="space-y-3">
                <button
                  onClick={resetFlow}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm"
                >
                  新しいテイクダウン申請を作成
                </button>
              </div>
            )}

            {/* Existing takedowns list */}
            {threat.takedowns?.length > 0 && step === 'idle' && (
              <div className="space-y-4 mt-4">
                <h3 className="text-sm font-medium text-gray-500">過去の申請</h3>
                {threat.takedowns.map((td: any) => (
                  <div key={td.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-sm">
                        <span className="font-medium">レジストラ: {td.registrar}</span>
                        {td.abuseEmail && (
                          <span className="text-gray-500 ml-2">→ {td.abuseEmail}</span>
                        )}
                      </div>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        td.status === 'draft' ? 'bg-gray-100 text-gray-800' :
                        td.status === 'sent' ? 'bg-blue-100 text-blue-800' :
                        td.status === 'completed' ? 'bg-green-100 text-green-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {td.status === 'draft' ? '下書き' :
                         td.status === 'sent' ? '送信済' :
                         td.status === 'completed' ? '完了' :
                         td.status}
                      </span>
                    </div>
                    <div className="text-xs text-gray-400">
                      {new Date(td.createdAt).toLocaleString('ja-JP')}
                    </div>
                    <pre className="text-xs text-gray-600 bg-gray-50 rounded p-3 overflow-x-auto whitespace-pre-wrap max-h-40 mt-2">
                      {td.template}
                    </pre>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {threat.screenshotUrl && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-sm font-bold mb-3">スクリーンショット</h3>
              <img src={threat.screenshotUrl} alt="Screenshot" className="rounded-lg border" />
            </div>
          )}
          {threat.whoisData && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-sm font-bold mb-3">WHOIS情報</h3>
              <pre className="text-xs text-gray-600 overflow-x-auto whitespace-pre-wrap">
                {typeof threat.whoisData === 'string'
                  ? (() => { try { return JSON.stringify(JSON.parse(threat.whoisData), null, 2); } catch { return threat.whoisData; } })()
                  : JSON.stringify(threat.whoisData, null, 2)}
              </pre>
            </div>
          )}
          {threat.sslInfo && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-sm font-bold mb-3">SSL情報</h3>
              <pre className="text-xs text-gray-600 overflow-x-auto">
                {JSON.stringify(threat.sslInfo, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
