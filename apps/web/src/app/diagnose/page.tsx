'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

// フィッシング報告件数データ（フィッシング対策協議会）
const phishingData = [
  { year: '2019', count: 55787, label: '5.6万' },
  { year: '2020', count: 224676, label: '22.5万' },
  { year: '2021', count: 526504, label: '52.7万' },
  { year: '2022', count: 968832, label: '96.9万' },
  { year: '2023', count: 1196390, label: '119.6万' },
  { year: '2024', count: 1718036, label: '171.8万' },
];
const maxCount = Math.max(...phishingData.map((d) => d.count));

function PhishingChart() {
  const [animated, setAnimated] = useState(false);
  const chartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setAnimated(true);
          observer.disconnect();
        }
      },
      { threshold: 0.3 }
    );
    if (chartRef.current) observer.observe(chartRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={chartRef} className="w-full max-w-2xl mx-auto">
      <div className="flex items-end gap-3 sm:gap-5 h-64 sm:h-72">
        {phishingData.map((d) => {
          const heightPct = (d.count / maxCount) * 100;
          return (
            <div key={d.year} className="flex-1 flex flex-col items-center justify-end h-full">
              <span className="text-xs sm:text-sm font-bold text-red-600 mb-1">{d.label}件</span>
              <div
                className="w-full rounded-t-lg transition-all duration-1000 ease-out"
                style={{
                  height: animated ? `${heightPct}%` : '0%',
                  background:
                    d.year === '2024'
                      ? 'linear-gradient(to top, #dc2626, #ef4444)'
                      : 'linear-gradient(to top, #1e40af, #3b82f6)',
                }}
              />
              <span className="text-xs text-slate-500 mt-2">{d.year}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ダッシュボードUIモック（ファーストビュー用）
function DashboardMock() {
  return (
    <div className="relative mx-auto max-w-4xl mt-12">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden">
        {/* ブラウザフレーム */}
        <div className="bg-slate-100 border-b border-slate-200 px-4 py-2 flex items-center gap-2">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-400" />
            <div className="w-3 h-3 rounded-full bg-yellow-400" />
            <div className="w-3 h-3 rounded-full bg-green-400" />
          </div>
          <div className="flex-1 mx-4">
            <div className="bg-white rounded px-3 py-1 text-xs text-slate-400 border border-slate-200">
              https://app.threatguard.jp/dashboard
            </div>
          </div>
        </div>
        {/* ダッシュボード本体 */}
        <div className="flex min-h-[320px]">
          {/* サイドバー */}
          <div className="w-48 bg-slate-50 border-r border-slate-200 p-4 hidden sm:block">
            <div className="text-sm font-bold text-slate-800 mb-4">ThreatGuard</div>
            <nav className="space-y-2 text-sm">
              <div className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded font-medium">ダッシュボード</div>
              <div className="px-3 py-1.5 text-slate-500">脅威一覧</div>
              <div className="px-3 py-1.5 text-slate-500">ブランド管理</div>
              <div className="px-3 py-1.5 text-slate-500">削除申請</div>
              <div className="px-3 py-1.5 text-slate-500">レポート</div>
            </nav>
          </div>
          {/* メインコンテンツ */}
          <div className="flex-1 p-6">
            <div className="text-lg font-bold text-slate-800 mb-4">脅威モニタリング</div>
            {/* ステータスカード */}
            <div className="grid grid-cols-3 gap-3 mb-6">
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <div className="text-2xl font-bold text-red-600">3</div>
                <div className="text-xs text-red-500">要対応</div>
              </div>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <div className="text-2xl font-bold text-yellow-600">7</div>
                <div className="text-xs text-yellow-500">監視中</div>
              </div>
              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <div className="text-2xl font-bold text-green-600">12</div>
                <div className="text-xs text-green-500">対応済み</div>
              </div>
            </div>
            {/* 脅威テーブル */}
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr className="text-left text-slate-500">
                    <th className="px-3 py-2 font-medium">ドメイン</th>
                    <th className="px-3 py-2 font-medium hidden sm:table-cell">リスク</th>
                    <th className="px-3 py-2 font-medium">ステータス</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr>
                    <td className="px-3 py-2 text-slate-700">example-login.net</td>
                    <td className="px-3 py-2 hidden sm:table-cell"><span className="text-xs font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-700">高</span></td>
                    <td className="px-3 py-2"><span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">削除申請中</span></td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 text-slate-700">examp1e-secure.com</td>
                    <td className="px-3 py-2 hidden sm:table-cell"><span className="text-xs font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-700">高</span></td>
                    <td className="px-3 py-2"><span className="text-xs font-medium px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700">要確認</span></td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 text-slate-700">example-support.org</td>
                    <td className="px-3 py-2 hidden sm:table-cell"><span className="text-xs font-medium px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700">中</span></td>
                    <td className="px-3 py-2"><span className="text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-700">対応済み</span></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
      {/* シャドウ装飾 */}
      <div className="absolute -inset-4 bg-gradient-to-b from-blue-100/50 to-transparent -z-10 rounded-2xl blur-2xl" />
    </div>
  );
}

export default function DiagnosePage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [targetUrl, setTargetUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/public/diagnose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, targetUrl }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : '入力内容を確認してください');
        return;
      }

      router.push(`/diagnose/result/${data.id}`);
    } catch {
      setError('通信エラーが発生しました。もう一度お試しください。');
    } finally {
      setLoading(false);
    }
  };

  const DiagnoseForm = ({ id, dark }: { id?: string; dark?: boolean }) => (
    <form onSubmit={handleSubmit} className="space-y-4" id={id}>
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="メールアドレス"
          className={`flex-1 px-4 py-3 rounded-lg text-sm transition focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            dark
              ? 'bg-white/10 border border-white/20 text-white placeholder-slate-400'
              : 'bg-white border border-slate-300 text-slate-800 placeholder-slate-400'
          }`}
        />
        <input
          type="text"
          required
          value={targetUrl}
          onChange={(e) => setTargetUrl(e.target.value)}
          placeholder="診断したいURL（例: example.com）"
          className={`flex-1 px-4 py-3 rounded-lg text-sm transition focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            dark
              ? 'bg-white/10 border border-white/20 text-white placeholder-slate-400'
              : 'bg-white border border-slate-300 text-slate-800 placeholder-slate-400'
          }`}
        />
        <button
          type="submit"
          disabled={loading}
          className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 whitespace-nowrap"
        >
          {loading ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
              診断中...
            </>
          ) : (
            '無料で診断する'
          )}
        </button>
      </div>
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-red-700 text-sm">
          {error}
        </div>
      )}
    </form>
  );

  return (
    <div className="min-h-screen bg-white">
      {/* ヘッダー — ロゴのみ */}
      <header className="border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <span className="text-xl font-bold text-slate-800">ThreatGuard</span>
        </div>
      </header>

      <main>
        {/* 1. ヒーロー（ファーストビュー） */}
        <section className="bg-gradient-to-b from-slate-50 to-white">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-16 sm:pt-24 pb-8 text-center">
            <h1 className="text-3xl sm:text-5xl font-bold text-slate-900 leading-tight mb-4">
              フィッシングサイトの検知から
              <br />
              削除申請まで、すべて自動で。
            </h1>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto mb-10">
              ドメインを登録するだけ。セットアップ不要、最短当日から監視を開始できます。
            </p>

            <div className="max-w-3xl mx-auto mb-2">
              <DiagnoseForm />
            </div>
            <p className="text-sm text-slate-400">
              無料診断 &#8212; 御社ドメインのリスクを30秒で可視化します
            </p>
          </div>

          {/* プロダクトUIイメージ */}
          <div className="max-w-5xl mx-auto px-4 sm:px-6 pb-16 sm:pb-24">
            <DashboardMock />
          </div>
        </section>

        {/* 2. 課題提起 — フィッシング急増グラフ */}
        <section className="bg-slate-50 border-y border-slate-200 py-16 sm:py-20">
          <div className="max-w-4xl mx-auto px-4 sm:px-6">
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 text-center mb-3">
              フィッシング被害は、5年で8倍に
            </h2>
            <p className="text-slate-500 text-center mb-10 max-w-lg mx-auto">
              国内のフィッシング報告件数は毎年過去最高を更新。2024年は171万件を突破しました。
            </p>

            <PhishingChart />

            <p className="text-xs text-slate-400 text-center mt-4">
              出典: フィッシング対策協議会 2024年度報告
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mt-12">
              <div className="text-center">
                <p className="text-slate-500 text-sm mb-1">攻撃者の構築時間</p>
                <p className="text-3xl sm:text-4xl font-bold text-slate-900">16分</p>
                <p className="text-xs text-slate-400 mt-1">偽サイトは瞬時に作られる</p>
              </div>
              <div className="text-center">
                <p className="text-slate-500 text-sm mb-1">企業が検知するまで</p>
                <p className="text-3xl sm:text-4xl font-bold text-slate-900">平均21時間</p>
                <p className="text-xs text-slate-400 mt-1">その間、顧客情報が流出</p>
              </div>
              <div className="text-center">
                <p className="text-slate-500 text-sm mb-1">2024年の不正送金被害額</p>
                <p className="text-3xl sm:text-4xl font-bold text-slate-900">86.9億円</p>
                <p className="text-xs text-slate-400 mt-1">警察庁発表</p>
              </div>
            </div>
          </div>
        </section>

        {/* 3. ThreatGuardが選ばれる理由（3つの便益） */}
        <section className="py-16 sm:py-20">
          <div className="max-w-4xl mx-auto px-4 sm:px-6">
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 text-center mb-3">
              ThreatGuardが選ばれる理由
            </h2>
            <p className="text-slate-500 text-center mb-12 max-w-lg mx-auto">
              検知から対応まで、ブランド保護を一気通貫で実現します。
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
              <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                  <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                  </svg>
                </div>
                <h3 className="text-slate-900 font-bold text-lg mb-2">導入の手軽さ</h3>
                <p className="text-slate-500 text-sm leading-relaxed">
                  ドメインとキーワードを登録するだけ。長期の導入プロジェクトは不要です。CT監視・DNS・SNSの24時間スキャンが即日開始されます。
                </p>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                  <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z" />
                  </svg>
                </div>
                <h3 className="text-slate-900 font-bold text-lg mb-2">削除申請の自動化</h3>
                <p className="text-slate-500 text-sm leading-relaxed">
                  検知した脅威に対し、AIがレジストラ・ホスティング事業者向けの通知文を自動生成。ワンクリックで削除申請を送信できます。
                </p>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                  <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18 9 11.25l4.306 4.306a11.95 11.95 0 0 1 5.814-5.518l2.74-1.22m0 0-5.94-2.281m5.94 2.28-2.28 5.941" />
                  </svg>
                </div>
                <h3 className="text-slate-900 font-bold text-lg mb-2">運用コストの削減</h3>
                <p className="text-slate-500 text-sm leading-relaxed">
                  AI活用により、従来のアナリスト工数を大幅に削減。海外の同等サービスと比較して、導入コストを抑えた価格体系を実現しています。
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* 4. 3ステップ（How It Works） */}
        <section className="bg-slate-50 border-y border-slate-200 py-16 sm:py-20">
          <div className="max-w-4xl mx-auto px-4 sm:px-6">
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 text-center mb-12">
              3ステップで運用開始
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
              <div className="text-center">
                <div className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-lg mx-auto mb-4">1</div>
                <h3 className="text-slate-900 font-bold mb-2">ブランド登録</h3>
                <p className="text-slate-500 text-sm">
                  保護対象のドメイン・キーワードを登録。設定は5分で完了します。
                </p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-lg mx-auto mb-4">2</div>
                <h3 className="text-slate-900 font-bold mb-2">自動スキャン</h3>
                <p className="text-slate-500 text-sm">
                  CT証明書、DNS、SNSを24時間監視。類似ドメインを自動検出します。
                </p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-lg mx-auto mb-4">3</div>
                <h3 className="text-slate-900 font-bold mb-2">検知・対応</h3>
                <p className="text-slate-500 text-sm">
                  リスクスコア付きで通知。削除申請をワンクリックで実行できます。
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* 5. 検知精度と対応スピード */}
        <section className="py-16 sm:py-20">
          <div className="max-w-4xl mx-auto px-4 sm:px-6">
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 text-center mb-12">
              検知精度と対応スピード
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              <div className="bg-white border border-slate-200 rounded-xl p-6 text-center shadow-sm">
                <p className="text-3xl sm:text-4xl font-bold text-blue-600 mb-2">平均5分</p>
                <p className="text-slate-500 text-sm">類似ドメインの検知速度</p>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-6 text-center shadow-sm">
                <p className="text-3xl sm:text-4xl font-bold text-blue-600 mb-2">90%</p>
                <p className="text-slate-500 text-sm">削除申請の自動生成率</p>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-6 text-center shadow-sm">
                <p className="text-3xl sm:text-4xl font-bold text-blue-600 mb-2">24時間</p>
                <p className="text-slate-500 text-sm">365日の継続監視</p>
              </div>
            </div>
          </div>
        </section>

        {/* 6. 2回目のCTA */}
        <section className="bg-slate-900 py-16 sm:py-20">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">
              まずは御社ドメインのリスクを確認しませんか
            </h2>
            <p className="text-slate-300 mb-8 max-w-lg mx-auto">
              30秒で診断結果を表示。アカウント登録は不要です。
            </p>

            <div className="max-w-3xl mx-auto">
              <DiagnoseForm id="cta-form" dark />
            </div>
          </div>
        </section>

        {/* 7. FAQ */}
        <section className="py-16 sm:py-20">
          <div className="max-w-3xl mx-auto px-4 sm:px-6">
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 text-center mb-12">
              よくある質問
            </h2>

            <div className="space-y-4">
              {[
                {
                  q: '無料診断で何がわかりますか？',
                  a: '入力されたURLに対して、DNS解決チェック、Webサイトの稼働確認、スクリーンショット取得、AIによるフィッシング・ブランド悪用リスクの分析を行います。リスクスコアと分析結果をレポートとしてご確認いただけます。',
                },
                {
                  q: '有料プランとの違いは？',
                  a: '無料診断は単発のURL診断です。有料プランでは、ブランドに対する24時間365日の継続監視、類似ドメインの自動検出、削除申請の自動生成・送信、Slack/メール通知、チーム管理機能、詳細レポートなど、本格的なブランド保護機能をご利用いただけます。',
                },
                {
                  q: '削除申請の成功率は？',
                  a: 'ホスティング事業者やレジストラへの削除申請は、適切な証拠と法的根拠を添えることで高い成功率を実現しています。ThreatGuardはAIによるエビデンス収集と申請書の自動生成により、このプロセスを大幅に効率化します。',
                },
                {
                  q: '導入までどのくらいかかりますか？',
                  a: 'アカウント作成後、ブランドとドメインを登録するだけで監視が開始されます。初期設定は5分程度で完了し、即日からご利用いただけます。長期の導入プロジェクトは必要ありません。',
                },
                {
                  q: 'セキュリティ体制について教えてください',
                  a: 'すべての通信はSSL/TLSで暗号化されています。お客様のデータは厳格なアクセス制御のもとで管理され、第三者への提供は行いません。',
                },
              ].map((faq, i) => (
                <details
                  key={i}
                  className="group bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm"
                >
                  <summary className="flex items-center justify-between px-6 py-4 cursor-pointer text-slate-900 font-medium hover:bg-slate-50 transition-colors">
                    <span>{faq.q}</span>
                    <span className="text-slate-400 group-open:rotate-180 transition-transform ml-4 flex-shrink-0">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                      </svg>
                    </span>
                  </summary>
                  <div className="px-6 pb-4 text-slate-500 text-sm leading-relaxed">
                    {faq.a}
                  </div>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* 8. フッター */}
        <footer className="border-t border-slate-200 py-8 bg-slate-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <span className="text-sm text-slate-400">&copy; 2026 ThreatGuard. All rights reserved.</span>
            <div className="flex gap-6 text-sm text-slate-400">
              <Link href="#" className="hover:text-slate-600 transition-colors">プライバシーポリシー</Link>
              <Link href="#" className="hover:text-slate-600 transition-colors">利用規約</Link>
              <Link href="#" className="hover:text-slate-600 transition-colors">特定商取引法に基づく表記</Link>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}
