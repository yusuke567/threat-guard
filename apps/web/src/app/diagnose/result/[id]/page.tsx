'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

type DiagnosisResult = {
  id: string;
  targetUrl: string;
  domain: string;
  status: string;
  riskScore: number | null;
  category: string | null;
  confidence: number | null;
  reasoning: string | null;
  screenshotUrl: string | null;
  dnsResolved: boolean;
  httpStatus: number | null;
  finalUrl: string | null;
  ip: string | null;
  sslInfo: string | null;
  whoisData: string | null;
  htmlSnippet: string | null;
  error: string | null;
  expiresAt: string;
  createdAt: string;
  remainingCount: number;
  limit: number;
};

function getRiskColor(score: number | null) {
  if (score === null) return { bg: 'bg-gray-500', text: 'text-gray-300', label: '分析中' };
  if (score >= 80) return { bg: 'bg-red-600', text: 'text-red-400', label: '危険' };
  if (score >= 60) return { bg: 'bg-orange-500', text: 'text-orange-400', label: '高リスク' };
  if (score >= 40) return { bg: 'bg-yellow-500', text: 'text-yellow-400', label: '要注意' };
  if (score >= 20) return { bg: 'bg-blue-500', text: 'text-blue-400', label: '低リスク' };
  return { bg: 'bg-green-500', text: 'text-green-400', label: '安全' };
}

function getCategoryLabel(category: string | null) {
  const map: Record<string, string> = {
    safe: '✅ 安全',
    suspicious: '⚠️ 疑わしい',
    phishing: '🚨 フィッシング',
    brand_abuse: '🔴 ブランド悪用',
    malware: '☠️ マルウェア',
    parked: '🅿️ パーク済み',
    unknown: '❓ 不明',
  };
  return category ? map[category] || category : '分析中...';
}

export default function DiagnosisResultPage() {
  const params = useParams();
  const id = params.id as string;
  const [result, setResult] = useState<DiagnosisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);
  const [polling, setPolling] = useState(true);

  useEffect(() => {
    if (!id) return;

    const fetchResult = async () => {
      try {
        const res = await fetch(`/api/public/diagnose/${id}`);
        const data = await res.json();

        if (res.status === 410) {
          setExpired(true);
          setPolling(false);
          return;
        }

        if (!res.ok) {
          setError(data.error || 'エラーが発生しました');
          setPolling(false);
          return;
        }

        setResult(data);

        if (data.status === 'completed' || data.status === 'failed') {
          setPolling(false);
        }
      } catch {
        setError('通信エラーが発生しました');
        setPolling(false);
      }
    };

    fetchResult();

    // Poll every 3 seconds while scanning
    const interval = setInterval(() => {
      if (polling) fetchResult();
    }, 3000);

    return () => clearInterval(interval);
  }, [id, polling]);

  // Expired state
  if (expired) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center px-4">
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-8 max-w-md text-center">
          <div className="text-5xl mb-4">⏰</div>
          <h1 className="text-2xl font-bold text-white mb-2">保存期間が終了しました</h1>
          <p className="text-slate-400 mb-6">
            無料診断の結果は7日間のみ保存されます。
            有料プランなら診断結果を無期限で保存できます。
          </p>
          <div className="flex flex-col gap-3">
            <Link
              href="/register"
              className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl transition-colors"
            >
              有料プランで無期限保存 →
            </Link>
            <Link
              href="/diagnose"
              className="px-6 py-3 border border-white/20 text-slate-300 hover:text-white rounded-xl transition-colors"
            >
              もう一度診断する
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center px-4">
        <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-8 max-w-md text-center">
          <div className="text-5xl mb-4">❌</div>
          <h1 className="text-xl font-bold text-red-300 mb-2">エラー</h1>
          <p className="text-red-200/70">{error}</p>
          <Link
            href="/diagnose"
            className="inline-block mt-6 px-6 py-2 border border-white/20 text-slate-300 hover:text-white rounded-xl transition-colors"
          >
            ← 戻る
          </Link>
        </div>
      </div>
    );
  }

  // Loading / Scanning state
  if (!result || result.status === 'scanning' || result.status === 'pending') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center px-4">
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-8 max-w-md text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-400 mx-auto mb-6" />
          <h1 className="text-xl font-bold text-white mb-2">診断中...</h1>
          <p className="text-slate-400 mb-2">
            {result?.domain || 'URL'} を分析しています
          </p>
          <div className="space-y-2 text-sm text-slate-500">
            <p>✓ DNS解決チェック</p>
            <p>✓ Webサイトアクセス</p>
            <p>✓ スクリーンショット取得</p>
            <p>✓ AI脅威分析</p>
          </div>
          <p className="text-xs text-slate-600 mt-4">通常30秒〜1分で完了します</p>
        </div>
      </div>
    );
  }

  const risk = getRiskColor(result.riskScore);
  const expiresDate = new Date(result.expiresAt);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900">
      {/* Header */}
      <header className="border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <Link href="/diagnose" className="text-xl font-bold text-white flex items-center gap-2">
            🛡️ ThreatGuard
          </Link>
          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-400">
              残り <span className="text-blue-400 font-bold">{result.remainingCount}</span>/{result.limit} 回
            </span>
            <Link
              href="/login"
              className="text-sm text-blue-300 hover:text-white transition-colors"
            >
              ログイン →
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        {/* Remaining count banner */}
        {result.remainingCount === 0 && (
          <div className="bg-orange-500/10 border border-orange-500/30 rounded-xl px-4 py-3 mb-6 flex items-center justify-between">
            <p className="text-orange-300 text-sm">
              🔔 無料診断の上限（{result.limit}回）に達しました
            </p>
            <Link
              href="/register"
              className="text-sm text-orange-200 hover:text-white font-semibold transition-colors"
            >
              プランを選ぶ →
            </Link>
          </div>
        )}

        {/* Expiry notice */}
        <div className="text-right text-xs text-slate-500 mb-4">
          この結果は {expiresDate.toLocaleDateString('ja-JP')} まで閲覧可能
        </div>

        {/* Risk Score Hero */}
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 sm:p-8 mb-6">
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <div className="flex-shrink-0">
              <div className={`w-28 h-28 rounded-full ${risk.bg} flex items-center justify-center`}>
                <div className="text-center">
                  <p className="text-3xl font-bold text-white">{result.riskScore ?? '?'}</p>
                  <p className="text-xs text-white/80">{risk.label}</p>
                </div>
              </div>
            </div>
            <div className="flex-1 text-center sm:text-left">
              <h1 className="text-xl font-bold text-white mb-1">{result.domain}</h1>
              <p className="text-slate-400 text-sm mb-2 break-all">{result.targetUrl}</p>
              <p className="text-lg font-medium text-white">
                {getCategoryLabel(result.category)}
              </p>
              {result.confidence !== null && (
                <p className="text-sm text-slate-400 mt-1">
                  確信度: {Math.round(result.confidence * 100)}%
                </p>
              )}
            </div>
          </div>

          {result.reasoning && (
            <div className="mt-6 bg-white/5 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-slate-300 mb-1">📝 AI分析結果</h3>
              <p className="text-slate-300 text-sm leading-relaxed">{result.reasoning}</p>
            </div>
          )}
        </div>

        {/* Details Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          {/* Screenshot */}
          <div className="bg-white/5 border border-white/10 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-slate-300 mb-3">📸 スクリーンショット</h3>
            {result.screenshotUrl ? (
              <img
                src={result.screenshotUrl}
                alt={`${result.domain} のスクリーンショット`}
                className="rounded-lg w-full border border-white/10"
              />
            ) : (
              <div className="bg-white/5 rounded-lg h-40 flex items-center justify-center text-slate-500 text-sm">
                {result.status === 'failed' ? 'スクリーンショット取得失敗' : '取得中...'}
              </div>
            )}
          </div>

          {/* Technical Info */}
          <div className="bg-white/5 border border-white/10 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-slate-300 mb-3">🔍 技術情報</h3>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-500">DNS解決</dt>
                <dd className="text-slate-300">
                  {result.dnsResolved ? `✅ ${result.ip || '解決済み'}` : '❌ 未解決'}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">HTTPステータス</dt>
                <dd className="text-slate-300">{result.httpStatus || 'N/A'}</dd>
              </div>
              {result.finalUrl && result.finalUrl !== result.targetUrl && (
                <div>
                  <dt className="text-slate-500">リダイレクト先</dt>
                  <dd className="text-slate-300 break-all text-xs mt-0.5">{result.finalUrl}</dd>
                </div>
              )}
            </dl>

            {/* Blurred premium fields */}
            <div className="mt-4 pt-4 border-t border-white/10">
              <div className="relative">
                <div className="blur-sm pointer-events-none select-none">
                  <dl className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <dt className="text-slate-500">SSL証明書</dt>
                      <dd className="text-slate-300">Let&apos;s Encrypt, valid until 2026-06-20</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-slate-500">WHOIS登録者</dt>
                      <dd className="text-slate-300">Privacy Protected, Namecheap</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-slate-500">HTMLコンテンツ分析</dt>
                      <dd className="text-slate-300">ログインフォーム検出、外部JS 3件</dd>
                    </div>
                  </dl>
                </div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <Link
                    href="/register"
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-lg transition-colors shadow-lg"
                  >
                    🔓 有料プランで詳細を見る
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Takedown CTA (disabled) */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-white font-semibold mb-1">🗑️ 削除申請</h3>
              <p className="text-slate-400 text-sm">
                このドメインのホスティング事業者・レジストラに削除申請を自動生成・送信します
              </p>
            </div>
            <div className="relative group">
              <button
                disabled
                className="px-5 py-2.5 bg-gray-600 text-gray-400 font-semibold rounded-xl cursor-not-allowed"
              >
                削除申請を送信
              </button>
              <div className="absolute bottom-full right-0 mb-2 px-3 py-2 bg-slate-800 border border-white/20 rounded-lg text-xs text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                有料プランで利用可能です
              </div>
            </div>
          </div>
        </div>

        {/* Bottom CTA */}
        <div className="bg-gradient-to-r from-blue-600/20 to-purple-600/20 border border-blue-500/30 rounded-2xl p-6 sm:p-8 text-center">
          <h2 className="text-xl font-bold text-white mb-2">
            ブランドを24時間365日守りませんか？
          </h2>
          <p className="text-slate-300 text-sm mb-6 max-w-lg mx-auto">
            ThreatGuardの有料プランなら、自動スキャン・削除申請・チーム管理・
            Slack通知・詳細レポートなど、本格的なブランド保護を実現します。
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/register"
              className="px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl transition-colors"
            >
              無料トライアルを始める →
            </Link>
            <Link
              href="/diagnose"
              className="px-8 py-3 border border-white/20 text-slate-300 hover:text-white rounded-xl transition-colors"
            >
              もう一度診断する
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
