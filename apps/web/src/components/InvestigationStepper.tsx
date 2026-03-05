'use client';

import GlossaryTerm from './GlossaryTerm';

const categoryLabels: Record<string, string> = {
  phishing: '🎣 フィッシング',
  brand_abuse: '⚠️ ブランド悪用',
  parked: '🅿️ パーク',
  legitimate: '✅ 正規',
  unknown: '❓ 不明',
};

interface StepperProps {
  threat: any;
  contentAnalysis: any;
  latestAnalysis: any;
  probing: boolean;
  probeStatus: 'idle' | 'running' | 'done' | 'error';
  onProbe: () => void;
  onStartTakedown: () => void;
  takedownStep: string;
  // Takedown flow props
  takedownError?: string;
  takedownSuccess?: string;
  registrar?: string;
  abuseEmail?: string;
  onAbuseEmailChange?: (email: string) => void;
  onGenerate?: () => void;
  template?: string;
  onTemplateChange?: (text: string) => void;
  onSend?: () => void;
  onResetFlow?: () => void;
  takedownPdfUrl?: string;
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
    action: '→ STEP 3へ進み、削除申請してください',
  };
  if (overallScore >= 30) return {
    label: '不審な兆候あり', color: 'amber', icon: '🟡',
    desc: '不審な内容が見つかりました。経過観察が必要です',
    action: '定期的にサイト調査を実行してください',
  };
  if (domainRiskScore >= 80) return {
    label: '要警戒', color: 'amber', icon: '⚠️',
    desc: '現時点でフィッシングコンテンツは未検出ですが、ドメイン自体は危険です',
    action: 'フィッシングに利用される前に、削除申請をおすすめします',
  };
  return {
    label: '問題なし', color: 'green', icon: '🟢',
    desc: '現時点で危険なコンテンツは見つかりませんでした',
    action: '現時点で対応不要です。自動監視を継続します',
  };
}

export default function InvestigationStepper({ threat, contentAnalysis, latestAnalysis, probing, probeStatus, onProbe, onStartTakedown, takedownStep, takedownError, takedownSuccess, registrar, abuseEmail, onAbuseEmailChange, onGenerate, template, onTemplateChange, onSend, onResetFlow, takedownPdfUrl }: StepperProps) {
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
    red: 'border-red-300 bg-red-50 dark:bg-red-900/30',
    orange: 'border-orange-300 bg-orange-50 dark:bg-orange-900/30',
    yellow: 'border-yellow-300 bg-yellow-50 dark:bg-yellow-900/30',
    amber: 'border-amber-300 bg-amber-50',
    green: 'border-green-300 bg-green-50 dark:bg-green-900/30',
  };

  const textColorMap: Record<string, string> = {
    red: 'text-red-700 dark:text-red-300',
    orange: 'text-orange-700 dark:text-orange-300',
    yellow: 'text-yellow-700 dark:text-yellow-300',
    amber: 'text-amber-700',
    green: 'text-green-700 dark:text-green-300',
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
      <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-5">📋 この脅威の調査状況</h2>

      <div className="space-y-0">
        {/* STEP 1: ドメイン分析 */}
        <div className="relative pl-8 pb-6">
          {/* Connector line */}
          <div className="absolute left-3 top-6 bottom-0 w-0.5 bg-gray-200 dark:bg-gray-600" />
          {/* Step icon */}
          <div className="absolute left-0 top-0.5 w-6 h-6 rounded-full bg-green-500 text-white text-xs font-bold flex items-center justify-center">
            ✓
          </div>

          <div className="mb-2">
            <span className="text-sm font-bold text-gray-900 dark:text-gray-100">STEP 1: ドメイン分析</span>
            <span className="text-xs text-gray-400 dark:text-gray-500 ml-2">ドメイン名・登録情報をAIが分析しました</span>
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

          {/* Collapsible: AI analysis details */}
          {latestAnalysis && (
            <details className="mt-3">
              <summary className="text-xs text-blue-600 cursor-pointer hover:text-blue-800 font-medium">📋 分析の詳細を見る</summary>
              <div className="mt-3 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
                <h4 className="text-xs font-bold text-gray-700 dark:text-gray-200 mb-2">AI分析結果</h4>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">{categoryLabels[latestAnalysis.category]?.split(' ')[0]}</span>
                  <span className="text-sm font-medium">{categoryLabels[latestAnalysis.category] || latestAnalysis.category}</span>
                  <span className="text-xs text-gray-400 dark:text-gray-500">（判定確度: {Math.round(latestAnalysis.confidence * 100)}%）</span>
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-900 rounded-lg p-3">
                  {latestAnalysis.reasoning}
                </p>
              </div>
            </details>
          )}

          {domainRiskScore >= 40 && !step2Done && (
            <p className="text-xs text-blue-600 font-medium mt-2">👇 STEP 2 でサイトの実態を調査してください</p>
          )}
        </div>

        {/* STEP 2: サイト調査 */}
        <div className="relative pl-8 pb-6">
          {/* Connector line */}
          <div className="absolute left-3 top-6 bottom-0 w-0.5 bg-gray-200 dark:bg-gray-600" />
          {/* Step icon */}
          <div className={`absolute left-0 top-0.5 w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center ${
            step2Done ? 'bg-green-500 text-white' : currentStep === 2 ? 'bg-blue-500 text-white' : 'bg-gray-200 dark:bg-gray-600 text-gray-500 dark:text-gray-400 dark:text-gray-500'
          }`}>
            {step2Done ? '✓' : '2'}
          </div>

          <div className="mb-2">
            <span className="text-sm font-bold text-gray-900 dark:text-gray-100">STEP 2: <GlossaryTerm term="プローブ">サイト調査</GlossaryTerm></span>
            <span className="text-xs text-gray-400 dark:text-gray-500 ml-2">実際にサイトにアクセスして内容を調べます</span>
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
              <div className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 mt-2 space-y-1">
                <div>🔴 サイトの稼働状況: {probe?.httpStatus === 200 ? 'サイトが稼働中です' : probe?.dnsResolved ? 'ドメインは存在しますがサイトは正常に表示されません' : 'サーバー未設定'}</div>
                {probe?.finalUrl && <div>↗️ 転送先: <span className="font-mono text-[10px]">{probe.finalUrl}</span></div>}
                <div className="text-gray-400 dark:text-gray-500">最終調査: {new Date(probe.probeAt).toLocaleString('ja-JP')}</div>
              </div>

              <button
                onClick={onProbe}
                disabled={probing}
                className="mt-2 px-3 py-1 rounded-lg text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 dark:bg-gray-600 disabled:opacity-50"
              >
                {probeStatus === 'running' ? '⏳ 再調査中...' : '🔄 再調査する'}
              </button>

              {/* Collapsible details: threat indicators + screenshot */}
              <details className="mt-3">
                <summary className="text-xs text-blue-600 cursor-pointer hover:text-blue-800 font-medium">📋 調査の詳細を見る</summary>
                <div className="mt-3 space-y-3">
                  {/* Threat Indicators */}
                  {contentAnalysis && (
                    <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3">
                      <h4 className="text-xs font-bold text-gray-700 dark:text-gray-200 mb-2">危険な兆候チェック</h4>
                      <div className="space-y-2 text-xs">
                        <div className="flex items-center gap-2">
                          <span>{contentAnalysis.hasLoginForm ? '⚠️' : '✅'}</span>
                          <span className={contentAnalysis.hasLoginForm ? 'text-red-700 dark:text-red-300' : 'text-gray-600 dark:text-gray-300'}>
                            ログイン画面の模倣: {contentAnalysis.hasLoginForm ? '検出されました' : '検出なし'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span>{contentAnalysis.hasPasswordField ? '⚠️' : '✅'}</span>
                          <span className={contentAnalysis.hasPasswordField ? 'text-red-700 dark:text-red-300' : 'text-gray-600 dark:text-gray-300'}>
                            パスワード入力欄: {contentAnalysis.hasPasswordField ? '検出されました' : '検出なし'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span>{contentAnalysis.logoDetected ? '⚠️' : '✅'}</span>
                          <span className={contentAnalysis.logoDetected ? 'text-amber-700' : 'text-gray-600 dark:text-gray-300'}>
                            自社ロゴの無断使用: {contentAnalysis.logoDetected ? '検出の可能性あり' : '検出なし'}
                          </span>
                        </div>
                        {contentAnalysis.imageSimilarity !== null && contentAnalysis.imageSimilarity !== undefined && (
                          <div className="flex items-center gap-2">
                            <span>{contentAnalysis.imageSimilarity > 0.7 ? '⚠️' : '✅'}</span>
                            <span className={contentAnalysis.imageSimilarity > 0.7 ? 'text-red-700 dark:text-red-300' : 'text-gray-600 dark:text-gray-300'}>
                              自社サイトとの類似度: {Math.round(contentAnalysis.imageSimilarity * 100)}%
                            </span>
                          </div>
                        )}
                        {contentAnalysis.keywordMatches?.length > 0 && (
                          <div className="flex items-start gap-2">
                            <span>⚠️</span>
                            <div>
                              <span className="text-red-700 dark:text-red-300">不審なキーワード: </span>
                              {contentAnalysis.keywordMatches.map((kw: string) => (
                                <span key={kw} className="px-1.5 py-0.5 bg-red-100 text-red-700 dark:text-red-300 rounded text-[10px] mr-1">{kw}</span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Screenshot */}
                  {threat.screenshotUrl && (
                    <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3">
                      <h4 className="text-xs font-bold text-gray-700 dark:text-gray-200 mb-2">サイトの画面キャプチャ</h4>
                      <img
                        src={threat.screenshotUrl.startsWith('/') ? threat.screenshotUrl : threat.screenshotUrl}
                        alt="サイトの画面キャプチャ"
                        className="rounded border w-full"
                      />
                      {probe?.probeAt && (
                        <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">{new Date(probe.probeAt).toLocaleString('ja-JP')} 取得</p>
                      )}
                    </div>
                  )}
                </div>
              </details>
            </>
          ) : (
            <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/30 p-3">
              <p className="text-xs text-blue-700 dark:text-blue-300 mb-2">まだサイトを調査していません。ボタンを押して調査を開始してください。</p>
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

        {/* STEP 3: 削除申請 */}
        <div className="relative pl-8">
          {/* Step icon */}
          <div className={`absolute left-0 top-0.5 w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center ${
            step3Done ? 'bg-green-500 text-white' : shouldRecommendTakedown ? 'bg-red-500 text-white animate-pulse' : 'bg-gray-200 dark:bg-gray-600 text-gray-500 dark:text-gray-400 dark:text-gray-500'
          }`}>
            {step3Done ? '✓' : '3'}
          </div>

          <div className="mb-2">
            <span className="text-sm font-bold text-gray-900 dark:text-gray-100">STEP 3: 削除申請</span>
            <span className="text-xs text-gray-400 dark:text-gray-500 ml-2">ドメインの停止を<GlossaryTerm term="レジストラ">レジストラ</GlossaryTerm>に依頼します</span>
          </div>

          {/* Error / Success */}
          {takedownError && (
            <div className="mb-2 p-2 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300 text-xs">{takedownError}</div>
          )}
          {takedownSuccess && (
            <div className="mb-2 p-2 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg text-green-700 dark:text-green-300 text-xs">✅ {takedownSuccess}</div>
          )}

          {step3Done ? (
            <div className="rounded-lg border border-green-300 bg-green-50 dark:bg-green-900/30 p-3">
              <div className="flex items-center gap-2">
                <span>✅</span>
                <span className="font-bold text-sm text-green-700 dark:text-green-300">削除申請済み</span>
              </div>
              <p className="text-xs text-green-600 mt-1">
                {threat.takedowns?.[0]?.status === 'sent' ? 'レジストラからの回答を待っています' :
                 threat.takedowns?.[0]?.status === 'completed' ? 'ドメインの停止が完了しました' :
                 '申請が進行中です'}
              </p>
            </div>
          ) : takedownStep === 'loading_contacts' ? (
            <div className="flex items-center gap-3 py-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600" />
              <span className="text-xs text-gray-600 dark:text-gray-300">WHOIS情報からabuse連絡先を取得中...</span>
            </div>
          ) : takedownStep === 'confirm_recipient' ? (
            <div className="space-y-3 border border-blue-200 dark:border-blue-800 rounded-lg p-3 bg-blue-50 dark:bg-blue-900/30/50">
              <div className="text-xs text-gray-600 dark:text-gray-300">
                <GlossaryTerm term="レジストラ">レジストラ</GlossaryTerm>: <span className="font-medium text-gray-900 dark:text-gray-100">{registrar}</span>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-200 mb-1">
                  <GlossaryTerm term="abuse連絡先">Abuse連絡先</GlossaryTerm>メールアドレス
                </label>
                <input
                  type="email"
                  value={abuseEmail || ''}
                  onChange={(e) => onAbuseEmailChange?.(e.target.value)}
                  placeholder="abuse@registrar.com"
                  className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                {!abuseEmail && <p className="mt-1 text-[10px] text-amber-600">⚠️ 自動取得できませんでした。手動で入力してください。</p>}
                {abuseEmail && <p className="mt-1 text-[10px] text-green-600">✅ WHOISから自動取得しました（変更可能）</p>}
              </div>
              <div className="flex gap-2">
                <button onClick={onGenerate} className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-xs font-medium">📝 削除申請文面を生成</button>
                <button onClick={onResetFlow} className="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 dark:bg-gray-600 text-xs">キャンセル</button>
              </div>
            </div>
          ) : takedownStep === 'generating' ? (
            <div className="flex items-center gap-3 py-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600" />
              <span className="text-xs text-gray-600 dark:text-gray-300">AIが削除申請文面を生成中...（30秒ほど）</span>
            </div>
          ) : takedownStep === 'review' ? (
            <div className="space-y-3">
              <div className="border border-amber-200 rounded-lg p-3 bg-amber-50/50">
                <h4 className="text-xs font-medium mb-2">📋 内容を確認してください</h4>
                <div className="grid grid-cols-2 gap-1 text-[10px] text-gray-500 dark:text-gray-400 dark:text-gray-500 mb-2">
                  <div>送信先: <span className="font-medium text-gray-900 dark:text-gray-100">{abuseEmail}</span></div>
                  <div>レジストラ: <span className="font-medium text-gray-900 dark:text-gray-100">{registrar}</span></div>
                </div>
                <textarea
                  value={template || ''}
                  onChange={(e) => onTemplateChange?.(e.target.value)}
                  rows={10}
                  className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-[10px] font-mono focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex gap-2">
                <button onClick={onSend} className="px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 text-xs font-medium">✅ 確認して送信</button>
                {takedownPdfUrl && <a href={takedownPdfUrl} target="_blank" className="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 dark:bg-gray-600 text-xs">📄 PDF</a>}
                <button onClick={onResetFlow} className="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 dark:bg-gray-600 text-xs">キャンセル</button>
              </div>
            </div>
          ) : takedownStep === 'sending' ? (
            <div className="flex items-center gap-3 py-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600" />
              <span className="text-xs text-gray-600 dark:text-gray-300">メールを送信中...</span>
            </div>
          ) : takedownStep === 'sent' ? (
            <div className="space-y-2">
              <button onClick={onResetFlow} className="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 dark:bg-gray-600 text-xs">新しい削除申請を作成</button>
            </div>
          ) : (
            <div className={`rounded-lg border p-3 ${shouldRecommendTakedown ? 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/30' : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900'}`}>
              {shouldRecommendTakedown ? (
                <>
                  <p className="text-xs text-red-700 dark:text-red-300 mb-2 font-medium">⚡ 削除申請が推奨されています</p>
                  <button
                    onClick={onStartTakedown}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium"
                  >
                    🚨 削除申請を開始
                  </button>
                </>
              ) : (
                <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500">STEP 1・2 の結果に基づいて、削除申請が必要か判断します</p>
              )}
            </div>
          )}

          {/* Past takedowns */}
          {threat.takedowns?.length > 0 && takedownStep === 'idle' && (
            <details className="mt-3">
              <summary className="text-xs text-blue-600 cursor-pointer hover:text-blue-800 font-medium">📋 過去の申請を見る</summary>
              <div className="mt-2 space-y-2">
                {threat.takedowns.map((td: any) => (
                  <div key={td.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium">レジストラ: {td.registrar}</span>
                      <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${
                        td.status === 'sent' ? 'bg-blue-100 text-blue-800' :
                        td.status === 'completed' ? 'bg-green-100 text-green-800' :
                        'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
                      }`}>{td.status === 'draft' ? '下書き' : td.status === 'sent' ? '送信済' : td.status === 'completed' ? '完了' : td.status}</span>
                    </div>
                    <div className="text-[10px] text-gray-400 dark:text-gray-500">{new Date(td.createdAt).toLocaleString('ja-JP')}</div>
                    <pre className="text-[10px] text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-900 rounded p-2 overflow-x-auto whitespace-pre-wrap max-h-32 mt-1">{td.template}</pre>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      </div>
    </div>
  );
}
