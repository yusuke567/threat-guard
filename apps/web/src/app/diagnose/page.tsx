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
              <span className="text-xs sm:text-sm font-bold text-red-400 mb-1">{d.label}件</span>
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
              <span className="text-xs text-slate-400 mt-2">{d.year}</span>
            </div>
          );
        })}
      </div>
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

  const DiagnoseForm = ({ id }: { id?: string }) => (
    <form onSubmit={handleSubmit} className="space-y-4" id={id}>
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="メールアドレス"
          className="flex-1 px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition text-sm"
        />
        <input
          type="text"
          required
          value={targetUrl}
          onChange={(e) => setTargetUrl(e.target.value)}
          placeholder="調査するURL（例: example.com）"
          className="flex-1 px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition text-sm"
        />
        <button
          type="submit"
          disabled={loading}
          className="px-6 py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 whitespace-nowrap"
        >
          {loading ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
              診断中...
            </>
          ) : (
            <>🔍 無料で診断する</>
          )}
        </button>
      </div>
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-red-300 text-sm">
          {error}
        </div>
      )}
    </form>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900">
      {/* ① ヒーロー */}
      <header className="border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <span className="text-xl font-bold text-white flex items-center gap-2">
            🛡️ ThreatGuard
          </span>
        </div>
      </header>

      <main>
        {/* ヒーローセクション */}
        <section className="max-w-4xl mx-auto px-4 sm:px-6 py-16 sm:py-24 text-center">
          <h1 className="text-3xl sm:text-5xl font-bold text-white leading-tight mb-4">
            あなたのブランド、
            <br />
            <span className="text-red-400">今この瞬間も狙われています</span>
          </h1>
          <p className="text-lg text-slate-300 max-w-2xl mx-auto mb-10">
            フィッシングサイトは平均16分で構築され、発見まで平均21時間。
            <br />
            その間に、御社の顧客が被害に遭っているかもしれません。
          </p>

          <div className="max-w-3xl mx-auto">
            <DiagnoseForm />
          </div>
        </section>

        {/* ③ 恐怖セクション — フィッシング急増グラフ */}
        <section className="bg-white/[0.03] border-y border-white/10 py-16 sm:py-20">
          <div className="max-w-4xl mx-auto px-4 sm:px-6">
            <h2 className="text-2xl sm:text-3xl font-bold text-white text-center mb-3">
              フィッシング被害は<span className="text-red-400">5年で30倍</span>に急増
            </h2>
            <p className="text-slate-400 text-center mb-10 max-w-lg mx-auto">
              日本国内のフィッシング報告件数は毎年過去最高を更新し続けています。
              2024年は171万件を突破しました。
            </p>

            <PhishingChart />

            <p className="text-xs text-slate-600 text-center mt-4">
              出典: フィッシング対策協議会「フィッシングレポート 2025」
              <br />
              ※ 報告件数はフィッシング対策協議会に寄せられた件数
            </p>

            {/* 被害額 */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mt-12">
              <div className="text-center">
                <p className="text-3xl sm:text-4xl font-bold text-red-400">171万件</p>
                <p className="text-sm text-slate-400 mt-1">2024年の報告件数</p>
                <p className="text-xs text-slate-600">過去最高（前年比1.44倍）</p>
              </div>
              <div className="text-center">
                <p className="text-3xl sm:text-4xl font-bold text-red-400">86.9億円</p>
                <p className="text-sm text-slate-400 mt-1">不正送金被害額</p>
                <p className="text-xs text-slate-600">2024年（警察庁発表）</p>
              </div>
              <div className="text-center">
                <p className="text-3xl sm:text-4xl font-bold text-red-400">16分</p>
                <p className="text-sm text-slate-400 mt-1">フィッシングサイト構築時間</p>
                <p className="text-xs text-slate-600">AI活用で更に短縮傾向</p>
              </div>
            </div>
          </div>
        </section>

        {/* ④ 解決策 — ThreatGuardの価値提案 */}
        <section className="py-16 sm:py-20">
          <div className="max-w-4xl mx-auto px-4 sm:px-6">
            <h2 className="text-2xl sm:text-3xl font-bold text-white text-center mb-3">
              ThreatGuardが御社のブランドを<span className="text-blue-400">24時間</span>守ります
            </h2>
            <p className="text-slate-400 text-center mb-12 max-w-lg mx-auto">
              AIによる自動検知から削除申請まで、ブランド保護を一気通貫で実現
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
              <div className="bg-white/5 border border-white/10 rounded-2xl p-6 text-center">
                <div className="text-4xl mb-4">🔍</div>
                <h3 className="text-white font-bold text-lg mb-2">自動検知</h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                  AIが類似ドメイン・フィッシングサイトを24時間自動スキャン。
                  新たな脅威を即座にキャッチします。
                </p>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-2xl p-6 text-center">
                <div className="text-4xl mb-4">⚡</div>
                <h3 className="text-white font-bold text-lg mb-2">リスク分析</h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                  検知したサイトをAIが自動分析し、リスクスコアを算出。
                  対応の優先順位が一目でわかります。
                </p>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-2xl p-6 text-center">
                <div className="text-4xl mb-4">🗑️</div>
                <h3 className="text-white font-bold text-lg mb-2">削除申請</h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                  ワンクリックで削除申請書を自動生成。
                  ホスティング事業者への送信まで一括対応します。
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ⑤ 仕組み（How It Works） */}
        <section className="bg-white/[0.03] border-y border-white/10 py-16 sm:py-20">
          <div className="max-w-4xl mx-auto px-4 sm:px-6">
            <h2 className="text-2xl sm:text-3xl font-bold text-white text-center mb-12">
              導入は<span className="text-blue-400">3ステップ</span>で完了
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
              <div className="text-center">
                <div className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-lg mx-auto mb-4">1</div>
                <h3 className="text-white font-bold mb-2">ブランドを登録</h3>
                <p className="text-slate-400 text-sm">
                  保護したいブランド名とドメインを登録するだけ。
                  設定は5分で完了します。
                </p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-lg mx-auto mb-4">2</div>
                <h3 className="text-white font-bold mb-2">自動スキャン開始</h3>
                <p className="text-slate-400 text-sm">
                  CT監視・DNS・SNSを24時間自動監視。
                  不審なドメインを即座に検出します。
                </p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-lg mx-auto mb-4">3</div>
                <h3 className="text-white font-bold mb-2">脅威を検知＆対応</h3>
                <p className="text-slate-400 text-sm">
                  Slack・メール通知で即座に把握。
                  削除申請をワンクリックで生成・送信。
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ⑥ 導入事例 / 数値実績 */}
        <section className="py-16 sm:py-20">
          <div className="max-w-4xl mx-auto px-4 sm:px-6">
            <h2 className="text-2xl sm:text-3xl font-bold text-white text-center mb-12">
              ThreatGuardの実力
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="bg-gradient-to-br from-blue-600/20 to-blue-800/10 border border-blue-500/20 rounded-2xl p-6">
                <p className="text-blue-400 text-sm font-medium mb-2">検知スピード</p>
                <p className="text-2xl font-bold text-white mb-2">
                  脅威検知から通知まで<span className="text-blue-400">平均5分</span>
                </p>
                <p className="text-slate-400 text-sm">
                  24時間の自動スキャンにより、新たなフィッシングサイトの出現を即座に検知。
                  人手による監視では不可能なスピードで対応を開始できます。
                </p>
              </div>
              <div className="bg-gradient-to-br from-green-600/20 to-green-800/10 border border-green-500/20 rounded-2xl p-6">
                <p className="text-green-400 text-sm font-medium mb-2">削除申請の効率化</p>
                <p className="text-2xl font-bold text-white mb-2">
                  申請書作成を<span className="text-green-400">90%自動化</span>
                </p>
                <p className="text-slate-400 text-sm">
                  レジストラ情報の自動取得、証拠収集、申請書テンプレートの自動生成により、
                  従来数時間かかっていた作業を数分で完了します。
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ⑦ 無料診断CTA（2回目） */}
        <section className="bg-gradient-to-r from-blue-600/20 to-purple-600/20 border-y border-blue-500/20 py-16 sm:py-20">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">
              まずは無料で、御社のリスクを確認しませんか？
            </h2>
            <p className="text-slate-300 mb-8 max-w-lg mx-auto">
              メールアドレスとURLを入力するだけ。30秒でAIがリスクを診断します。
            </p>

            <div className="max-w-3xl mx-auto">
              <DiagnoseForm id="cta-form" />
            </div>
          </div>
        </section>

        {/* ⑧ FAQ */}
        <section className="py-16 sm:py-20">
          <div className="max-w-3xl mx-auto px-4 sm:px-6">
            <h2 className="text-2xl sm:text-3xl font-bold text-white text-center mb-12">
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
                  a: 'アカウント作成後、ブランドとドメインを登録するだけで監視が開始されます。初期設定は5分程度で完了し、即日からご利用いただけます。',
                },
                {
                  q: 'セキュリティは大丈夫ですか？',
                  a: 'すべての通信はSSL/TLSで暗号化されています。お客様のデータは厳格なアクセス制御のもとで管理され、第三者への提供は行いません。',
                },
              ].map((faq, i) => (
                <details
                  key={i}
                  className="group bg-white/5 border border-white/10 rounded-xl overflow-hidden"
                >
                  <summary className="flex items-center justify-between px-6 py-4 cursor-pointer text-white font-medium hover:bg-white/5 transition-colors">
                    <span>{faq.q}</span>
                    <span className="text-slate-500 group-open:rotate-180 transition-transform">▼</span>
                  </summary>
                  <div className="px-6 pb-4 text-slate-400 text-sm leading-relaxed">
                    {faq.a}
                  </div>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* ⑨ フッター */}
        <footer className="border-t border-white/10 py-8">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <span className="text-sm text-slate-500">© 2026 ThreatGuard. All rights reserved.</span>
            <div className="flex gap-6 text-sm text-slate-500">
              <Link href="#" className="hover:text-slate-300 transition-colors">プライバシーポリシー</Link>
              <Link href="#" className="hover:text-slate-300 transition-colors">利用規約</Link>
              <Link href="#" className="hover:text-slate-300 transition-colors">特定商取引法に基づく表記</Link>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}
