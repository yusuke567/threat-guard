'use client';

import GlossaryTerm from './GlossaryTerm';

interface StepperProps {
  threat: any;
  contentAnalysis: any;
  probing: boolean;
  probeStatus: 'idle' | 'running' | 'done' | 'error';
  onProbe: () => void;
  onStartTakedown: () => void;
  takedownStep: string;
}

function getDomainRiskConfig(score: number) {
  if (score >= 80) return { label: '危険', color: 'red', icon: '🔴', desc: 'このドメインはフィッシングに使われる可能性が非常に高いです' };
  if (score >= 60) return { label: '高', color: 'orange', icon: '🟠', desc: '不審なドメインです。偽サイトに使われる可能性があります' };
  if (score >= 40) return { label: '中', color: 'yellow', icon: '🟡', desc: '注意が必要なドメインです。状況が変わる可能性があります' };
  return { label: '低', color: 'green', icon: '🟢', desc: '現時点で危険性は低いドメインです' };
}

function getSiteInvestigationResult(contentAnalysis: any, domainRiskScore: number, probe: any) {
  if (!probe) return null;

  const riskScore = contentAnalysis?.contentRiskScore ?? 0;
  const similarity = contentAnalysis?.imageSimilarity ? Math.round(contentAnalysis.imageSimilarity * 100) : 0;
  const isLive = probe?.httpStatus === 200;
  const overallScore = Math.max(riskScore, isLive && similarity > 70 ? 80 : 0);

  if (overallScore >= 70) return {
    label: '危険なサイト', color: 'red', icon: '🔴',
    desc: '偽のログイン画面や御社ロゴの無断使用が検出されました',
    action: '→ STEP 3へ進み、テイクダウン申請してください',
  };
  if (overallScore >= 30) return {
    label: '不審な兆候あり', color: 'amber', icon: '🟡',
    desc: '不審な内容が見つかりました。経過観察が必要です',
    action: '定期的にサイト調査を実行してください',
  };
  if (domainRiskScore >= 80) return {
    label: '要警戒', color: 'amber', icon: '⚠️',
    desc: '現時点でフィッシングコンテンツは未検出ですが、ドメイン自体は危険です',
    action: 'フィッシングに利用される前に、テイクダウン申請をおすすめします',
  };
  return {
    label: '問題なし', color: 'green', icon: '🟢',
    desc: '現時点で危険なコンテンツは見つかりませんでした',
    action: '現時点で対応不要です。自動監視を継続します',
  };
}

export default function InvestigationStepper({ threat, contentAnalysis, probing, probeStatus, onProbe, onStartTakedown, takedownStep }: StepperProps) {
  const domainRiskScore = threat.riskScore ?? 0;
  const domainRisk = getDomainRiskConfig(domainRiskScore);
  const probe = threat.webProbes?.[0];
  const siteResult = getSiteInvestigationResult(contentAnalysis, domainRiskScore, probe);
  const hasTakedown = threat.takedowns?.length > 0;

  // Determine step states
  const step1Done = domainRiskScore > 0;
  const step2Done = !!probe;
  const step2NeedsAction = !probe;
  const step3Done = hasTakedown || takedownStep === 'sent';
  const shouldRecommendTakedown = siteResult && (siteResult.color === 'red' || siteResult.color === 'amber');

  // Current step indicator
  const currentStep = !step1Done ? 1 : !step2Done ? 2 : !step3Done ? 3 : 3;

  const colorMap: Record<string, string> = {
    red: 'border-red-300 bg-red-50',
    orange: 'border-orange-300 bg-orange-50',
    yellow: 'border-yellow-300 bg-yellow-50',
    amber: 'border-amber-300 bg-amber-50',
    green: 'border-green-300 bg-green-50',
  };

  const textColorMap: Record<string, string> = {
    red: 'text-red-700',
    orange: 'text-orange-700',
    yellow: 'text-yellow-700',
    amber: 'text-amber-700',
    green: 'text-green-700',
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h2 className="text-lg font-bold text-gray-900 mb-5">📋 この脅威の調査状況</h2>

      <div className="space-y-0">
        {/* STEP 1: ドメイン分析 */}
        <div className="relative pl-8 pb-6">
          {/* Connector line */}
          <div className="absolute left-3 top-6 bottom-0 w-0.5 bg-gray-200" />
          {/* Step icon */}
          <div className="absolute left-0 top-0.5 w-6 h-6 rounded-full bg-green-500 text-white text-xs font-bold flex items-center justify-center">
            ✓
          </div>

          <div className="mb-2">
            <span className="text-sm font-bold text-gray-900">STEP 1: ドメイン分析</span>
            <span className="text-xs text-gray-400 ml-2">ドメイン名・登録情報をAIが分析しました</span>
          </div>

          <div className={`rounded-lg border p-3 ${colorMap[domainRisk.color]}`}>
            <div className="flex items-center gap-2 mb-1">
              <span>{domainRisk.icon}</span>
              <span className={`font-bold text-sm ${textColorMap[domainRisk.color]}`}>
                危険度: {domainRiskScore}（{domainRisk.label}）
              </span>
            </div>
            <p className={`text-xs ${textColorMap[domainRisk.color]}`}>{domainRisk.desc}</p>
          </div>

          {domainRiskScore >= 40 && !step2Done && (
            <p className="text-xs text-blue-600 font-medium mt-2">👇 STEP 2 でサイトの実態を調査してください</p>
          )}
        </div>

        {/* STEP 2: サイト調査 */}
        <div className="relative pl-8 pb-6">
          {/* Connector line */}
          <div className="absolute left-3 top-6 bottom-0 w-0.5 bg-gray-200" />
          {/* Step icon */}
          <div className={`absolute left-0 top-0.5 w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center ${
            step2Done ? 'bg-green-500 text-white' : currentStep === 2 ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-500'
          }`}>
            {step2Done ? '✓' : '2'}
          </div>

          <div className="mb-2">
            <span className="text-sm font-bold text-gray-900">STEP 2: <GlossaryTerm term="プローブ">サイト調査</GlossaryTerm></span>
            <span className="text-xs text-gray-400 ml-2">実際にサイトにアクセスして内容を調べます</span>
          </div>

          {step2Done && siteResult ? (
            <>
              <div className={`rounded-lg border p-3 ${colorMap[siteResult.color]}`}>
                <div className="flex items-center gap-2 mb-1">
                  <span>{siteResult.icon}</span>
                  <span className={`font-bold text-sm ${textColorMap[siteResult.color]}`}>{siteResult.label}</span>
                </div>
                <p className={`text-xs ${textColorMap[siteResult.color]}`}>{siteResult.desc}</p>
                <p className={`text-xs font-medium mt-1.5 ${textColorMap[siteResult.color]}`}>💡 {siteResult.action}</p>
              </div>

              {/* Site status details */}
              <div className="text-xs text-gray-500 mt-2 space-y-1">
                <div>🔴 サイトの稼働状況: {probe?.httpStatus === 200 ? 'サイトが稼働中です' : probe?.dnsResolved ? 'ドメインは存在しますがサイトは正常に表示されません' : 'サーバー未設定'}</div>
                {probe?.finalUrl && <div>↗️ 転送先: <span className="font-mono text-[10px]">{probe.finalUrl}</span></div>}
                <div className="text-gray-400">最終調査: {new Date(probe.probeAt).toLocaleString('ja-JP')}</div>
              </div>

              <button
                onClick={onProbe}
                disabled={probing}
                className="mt-2 px-3 py-1 rounded-lg text-xs font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-50"
              >
                {probeStatus === 'running' ? '⏳ 再調査中...' : '🔄 再調査する'}
              </button>
            </>
          ) : (
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
              <p className="text-xs text-blue-700 mb-2">まだサイトを調査していません。ボタンを押して調査を開始してください。</p>
              <button
                onClick={onProbe}
                disabled={probing}
                className={`px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 transition-all ${
                  probeStatus === 'done' ? 'bg-green-600 text-white' :
                  probeStatus === 'error' ? 'bg-red-600 text-white' :
                  'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                {probeStatus === 'running' ? '⏳ 調査中...' :
                 probeStatus === 'done' ? '✅ 完了！' :
                 probeStatus === 'error' ? '❌ エラー' :
                 '🔍 サイトを調査する'}
              </button>
            </div>
          )}
        </div>

        {/* STEP 3: テイクダウン申請 */}
        <div className="relative pl-8">
          {/* Step icon */}
          <div className={`absolute left-0 top-0.5 w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center ${
            step3Done ? 'bg-green-500 text-white' : shouldRecommendTakedown ? 'bg-red-500 text-white animate-pulse' : 'bg-gray-200 text-gray-500'
          }`}>
            {step3Done ? '✓' : '3'}
          </div>

          <div className="mb-2">
            <span className="text-sm font-bold text-gray-900">STEP 3: <GlossaryTerm term="テイクダウン">テイクダウン</GlossaryTerm>申請</span>
            <span className="text-xs text-gray-400 ml-2">ドメインの停止を<GlossaryTerm term="レジストラ">レジストラ</GlossaryTerm>に依頼します</span>
          </div>

          {step3Done ? (
            <div className="rounded-lg border border-green-300 bg-green-50 p-3">
              <div className="flex items-center gap-2">
                <span>✅</span>
                <span className="font-bold text-sm text-green-700">テイクダウン申請済み</span>
              </div>
              <p className="text-xs text-green-600 mt-1">
                {threat.takedowns?.[0]?.status === 'sent' ? 'レジストラからの回答を待っています' :
                 threat.takedowns?.[0]?.status === 'completed' ? 'ドメインの停止が完了しました' :
                 '申請が進行中です'}
              </p>
            </div>
          ) : takedownStep !== 'idle' ? (
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
              <p className="text-xs text-blue-700">テイクダウン申請を作成中です...</p>
            </div>
          ) : (
            <div className={`rounded-lg border p-3 ${shouldRecommendTakedown ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-gray-50'}`}>
              {shouldRecommendTakedown ? (
                <>
                  <p className="text-xs text-red-700 mb-2 font-medium">⚡ テイクダウン申請が推奨されています</p>
                  <button
                    onClick={onStartTakedown}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium"
                  >
                    🚨 テイクダウン申請を開始
                  </button>
                </>
              ) : (
                <p className="text-xs text-gray-500">STEP 1・2 の結果に基づいて、テイクダウンが必要か判断します</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
