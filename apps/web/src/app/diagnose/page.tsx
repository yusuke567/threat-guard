'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900">
      {/* Header */}
      <header className="border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <Link href="/diagnose" className="text-xl font-bold text-white flex items-center gap-2">
            🛡️ ThreatGuard
          </Link>
          <Link
            href="/login"
            className="text-sm text-blue-300 hover:text-white transition-colors"
          >
            ログイン →
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-12 sm:py-20">
        {/* Hero */}
        <div className="text-center mb-12">
          <h1 className="text-4xl sm:text-5xl font-bold text-white mb-4">
            あなたのブランドは
            <br />
            <span className="text-blue-400">なりすまされていませんか？</span>
          </h1>
          <p className="text-lg text-slate-300 max-w-2xl mx-auto">
            URLを入力するだけで、フィッシングサイトやなりすましドメインの脅威をAIが即座に分析します。
            <br />
            <span className="text-blue-400 font-medium">無料で3回まで診断可能</span>
          </p>
        </div>

        {/* Diagnosis Form */}
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 sm:p-8 max-w-xl mx-auto">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-300 mb-1.5">
                メールアドレス <span className="text-red-400">*</span>
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              />
            </div>

            <div>
              <label htmlFor="targetUrl" className="block text-sm font-medium text-slate-300 mb-1.5">
                診断するURL <span className="text-red-400">*</span>
              </label>
              <input
                id="targetUrl"
                type="text"
                required
                value={targetUrl}
                onChange={(e) => setTargetUrl(e.target.value)}
                placeholder="example.com または https://example.com"
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              />
              <p className="text-xs text-slate-500 mt-1">ドメイン名またはフルURLを入力してください</p>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-red-300 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
                  診断中...
                </>
              ) : (
                <>🔍 無料で診断する</>
              )}
            </button>
          </form>

          <p className="text-xs text-slate-500 text-center mt-4">
            診断結果は7日間保存されます。個人情報は診断目的のみに使用します。
          </p>
        </div>

        {/* Features */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mt-16">
          <div className="text-center">
            <div className="text-3xl mb-3">🤖</div>
            <h3 className="text-white font-semibold mb-1">AI分析</h3>
            <p className="text-slate-400 text-sm">最新のAIがフィッシングサイトの特徴を自動検出</p>
          </div>
          <div className="text-center">
            <div className="text-3xl mb-3">📸</div>
            <h3 className="text-white font-semibold mb-1">スクリーンショット</h3>
            <p className="text-slate-400 text-sm">対象サイトのスクリーンショットを自動キャプチャ</p>
          </div>
          <div className="text-center">
            <div className="text-3xl mb-3">⚡</div>
            <h3 className="text-white font-semibold mb-1">即時レポート</h3>
            <p className="text-slate-400 text-sm">DNS・SSL・コンテンツを一括チェック、数十秒で結果</p>
          </div>
        </div>

        {/* CTA */}
        <div className="mt-16 text-center border-t border-white/10 pt-12">
          <h2 className="text-2xl font-bold text-white mb-3">
            本格的なブランド保護はThreatGuardで
          </h2>
          <p className="text-slate-400 mb-6 max-w-lg mx-auto">
            24時間監視、自動テイクダウン申請、チーム管理機能を備えた有料プランで、ブランドを完全に守ります。
          </p>
          <Link
            href="/register"
            className="inline-block px-8 py-3 bg-white text-slate-900 font-semibold rounded-xl hover:bg-slate-100 transition-colors"
          >
            無料トライアルを始める →
          </Link>
        </div>
      </main>
    </div>
  );
}
