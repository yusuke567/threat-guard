'use client';

import { useEffect, useState } from 'react';
import { PageHeader, Button, Card, Alert } from '@/components/ui';
import AdminGuard from '@/components/layout/AdminGuard';
import {
  triggerWhoisBackfill,
  getFeedImportStatus,
  getFeedImports,
  getJpcertPatterns,
  relearnJpcertPatterns,
  type FeedImportStatusDto,
  type FeedImportRunDto,
  type JpcertPatternsResponse,
} from '@/lib/api';

const SOURCE_LABELS: Record<string, string> = {
  jpcert: 'JPCERT/CC',
};

function formatHours(h: number | null): string {
  if (h === null) return '未取得';
  if (h < 1) return `${Math.round(h * 60)}分前`;
  if (h < 48) return `${Math.round(h)}時間前`;
  return `${Math.round(h / 24)}日前`;
}

function formatDuration(sec: number | null): string {
  if (sec === null) return '—';
  if (sec < 60) return `${sec}秒`;
  return `${Math.floor(sec / 60)}分${sec % 60}秒`;
}

function StatusBadge({ status }: { status: 'running' | 'success' | 'failed' }) {
  const map: Record<string, string> = {
    success: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800',
    failed: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800',
    running: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800',
  };
  const label: Record<string, string> = { success: '成功', failed: '失敗', running: '実行中' };
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium border ${map[status]}`}>
      {label[status]}
    </span>
  );
}

export default function SystemAdminPage() {
  const [backfilling, setBackfilling] = useState(false);
  const [result, setResult] = useState<{
    message: string;
    processing: number;
    totalMissing: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [batchSize, setBatchSize] = useState(50);

  // Feed import status
  const [feedStatus, setFeedStatus] = useState<FeedImportStatusDto[] | null>(null);
  const [feedRuns, setFeedRuns] = useState<FeedImportRunDto[] | null>(null);
  const [feedLoading, setFeedLoading] = useState(true);
  const [feedError, setFeedError] = useState<string | null>(null);

  // JPCERT learned patterns (Layer 4)
  const [patterns, setPatterns] = useState<JpcertPatternsResponse | null>(null);
  const [patternsLoading, setPatternsLoading] = useState(true);
  const [patternsError, setPatternsError] = useState<string | null>(null);
  const [patternsTypeFilter, setPatternsTypeFilter] = useState<string>('');
  const [relearning, setRelearning] = useState(false);
  const [relearnResult, setRelearnResult] = useState<string | null>(null);

  const loadPatterns = async (type?: string) => {
    setPatternsLoading(true);
    setPatternsError(null);
    try {
      const data = await getJpcertPatterns(type || undefined, 200);
      setPatterns(data);
    } catch (e: any) {
      setPatternsError(e?.message || '検知パターンの取得に失敗しました');
    } finally {
      setPatternsLoading(false);
    }
  };

  const handleRelearn = async () => {
    if (!confirm('JPCERTコーパスから検知パターンを再学習します。数秒〜数十秒かかります。よろしいですか？')) return;
    setRelearning(true);
    setRelearnResult(null);
    try {
      const r = await relearnJpcertPatterns();
      setRelearnResult(
        `再学習完了（${r.durationSec}秒）: コーパス ${r.totalExamined.toLocaleString()}件 → ` +
        `ドメインkw ${r.domainKeywords} / パス ${r.pathPrefixes} / TLD ${r.tldAbuse} / サブドメイン ${r.subdomains}`,
      );
      await loadPatterns(patternsTypeFilter);
    } catch (e: any) {
      setRelearnResult('エラー: ' + (e?.message || '再学習に失敗しました'));
    } finally {
      setRelearning(false);
    }
  };

  const loadFeed = async () => {
    setFeedLoading(true);
    setFeedError(null);
    try {
      const [status, runs] = await Promise.all([getFeedImportStatus(), getFeedImports(10)]);
      setFeedStatus(status);
      setFeedRuns(runs);
    } catch (e: any) {
      setFeedError(e?.message || '取り込み状況の取得に失敗しました');
    } finally {
      setFeedLoading(false);
    }
  };

  useEffect(() => {
    loadFeed();
    loadPatterns();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleBackfill = async () => {
    setBackfilling(true);
    setError(null);
    setResult(null);
    try {
      const res = await triggerWhoisBackfill(batchSize);
      setResult(res);
    } catch (e: any) {
      setError(e.message || 'バックフィルの実行に失敗しました');
    } finally {
      setBackfilling(false);
    }
  };

  return (
    <AdminGuard>
      <div className="max-w-4xl mx-auto px-4 py-8">
        <PageHeader
          title="システム管理"
          description="データメンテナンスや一括処理を実行します"
        />

        <div className="mt-8 space-y-6">
          {/* External Threat Feed Status */}
          <Card>
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-1">
                    外部脅威フィード取り込み状況
                  </h2>
                  <p className="text-sm text-[var(--text-secondary)]">
                    JPCERT/CC等の第三者観測フィードの取り込み実行履歴と健全性を表示します。
                    日次で自動実行されます。
                  </p>
                </div>
                <Button variant="ghost" size="sm" onClick={loadFeed} disabled={feedLoading}>
                  {feedLoading ? '読込中...' : '更新'}
                </Button>
              </div>

              {feedError && <Alert variant="error" className="mb-4">{feedError}</Alert>}

              {/* Per-source status cards */}
              {feedStatus && feedStatus.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  {feedStatus.map((s) => {
                    const healthy = s.isHealthy;
                    const ringColor = healthy
                      ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20'
                      : 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20';
                    const dotColor = healthy ? 'bg-green-500' : 'bg-red-500';
                    return (
                      <div key={s.source} className={`rounded-xl border-2 p-4 ${ringColor}`}>
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                            {SOURCE_LABELS[s.source] || s.source}
                          </h3>
                          <span className="flex items-center gap-1.5 text-xs font-medium">
                            <span className={`inline-block w-2 h-2 rounded-full ${dotColor}`} />
                            {healthy ? '正常' : '異常'}
                          </span>
                        </div>
                        <dl className="grid grid-cols-2 gap-2 text-xs">
                          <dt className="text-[var(--text-secondary)]">最終成功</dt>
                          <dd className="text-right text-[var(--text-primary)] font-medium">
                            {formatHours(s.hoursSinceLastSuccess)}
                          </dd>
                          <dt className="text-[var(--text-secondary)]">累計DB件数</dt>
                          <dd className="text-right text-[var(--text-primary)] font-medium">
                            {s.totalInDb.toLocaleString()}
                          </dd>
                          <dt className="text-[var(--text-secondary)]">前回新規追加</dt>
                          <dd className="text-right text-[var(--text-primary)] font-medium">
                            {s.lastInsertedCount.toLocaleString()}
                          </dd>
                          <dt className="text-[var(--text-secondary)]" title="JPCERT経由で初把握した新規">
                            前回新規検知
                          </dt>
                          <dd className="text-right text-[var(--text-primary)] font-medium">
                            {(s.lastNewBrandHits ?? 0)}件
                          </dd>
                          <dt className="text-[var(--text-secondary)]" title="自社が先行検知したドメインをJPCERTが後日確認">
                            前回既検知確認
                          </dt>
                          <dd className="text-right text-[var(--text-secondary)]">
                            {(s.lastConfirmedBrandHits ?? 0)}件
                          </dd>
                        </dl>
                        {!healthy && (
                          <p className="mt-3 text-xs text-red-700 dark:text-red-300">
                            ⚠️ 26時間以上更新がありません。スケジューラの状態を確認してください。
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Recent runs table */}
              {feedRuns && feedRuns.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-2">
                    最近の実行履歴
                  </h3>
                  <div className="overflow-x-auto rounded-lg border border-[var(--border-default)]">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50 dark:bg-gray-800 text-[var(--text-secondary)] uppercase tracking-wide">
                        <tr>
                          <th className="text-left px-3 py-2 font-medium">ソース</th>
                          <th className="text-left px-3 py-2 font-medium">状態</th>
                          <th className="text-left px-3 py-2 font-medium">開始</th>
                          <th className="text-right px-3 py-2 font-medium">取得</th>
                          <th className="text-right px-3 py-2 font-medium">新規追加</th>
                          <th className="text-right px-3 py-2 font-medium" title="JPCERT経由で初把握した新規フィッシング">
                            新規検知
                          </th>
                          <th className="text-right px-3 py-2 font-medium" title="自社が先行検知済みのドメインをJPCERTが後日確認（エコー）">
                            既検知確認
                          </th>
                          <th className="text-right px-3 py-2 font-medium">所要</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--border-subtle)]">
                        {feedRuns.map((r) => (
                          <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                            <td className="px-3 py-2 text-[var(--text-primary)]">
                              {SOURCE_LABELS[r.source] || r.source}
                            </td>
                            <td className="px-3 py-2"><StatusBadge status={r.status} /></td>
                            <td className="px-3 py-2 text-[var(--text-secondary)]">
                              {new Date(r.startedAt).toLocaleString('ja-JP', {
                                month: '2-digit',
                                day: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </td>
                            <td className="px-3 py-2 text-right text-[var(--text-primary)]">
                              {r.fetchedCount.toLocaleString()}
                            </td>
                            <td className="px-3 py-2 text-right text-[var(--text-primary)]">
                              {r.insertedCount.toLocaleString()}
                            </td>
                            <td className="px-3 py-2 text-right">
                              {r.newBrandHits > 0 ? (
                                <span className="font-bold text-orange-600 dark:text-orange-400">
                                  {r.newBrandHits}
                                </span>
                              ) : (
                                <span className="text-[var(--text-tertiary)]">0</span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-right">
                              {r.confirmedBrandHits > 0 ? (
                                <span className="text-[var(--text-secondary)]">
                                  {r.confirmedBrandHits}
                                </span>
                              ) : (
                                <span className="text-[var(--text-tertiary)]">0</span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-right text-[var(--text-secondary)]">
                              {formatDuration(r.durationSec)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {!feedLoading && feedRuns && feedRuns.length === 0 && (
                <p className="text-sm text-[var(--text-tertiary)]">実行履歴がまだありません。</p>
              )}
            </div>
          </Card>

          {/* JPCERT 学習済み検知パターン (Layer 4) */}
          <Card>
            <div className="p-6">
              <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                  JPCERT学習済み検知パターン
                </h2>
                <div className="flex gap-2">
                  <select
                    value={patternsTypeFilter}
                    onChange={(e) => { setPatternsTypeFilter(e.target.value); loadPatterns(e.target.value); }}
                    className="text-sm px-2 py-1 rounded border border-[var(--border-default)] bg-[var(--bg-elevated)] text-[var(--text-primary)]"
                  >
                    <option value="">すべて</option>
                    <option value="domain_keyword">ドメインキーワード</option>
                    <option value="path_prefix">パスプレフィックス</option>
                    <option value="tld_abuse">TLD乱用</option>
                    <option value="subdomain">サブドメイン</option>
                  </select>
                  <Button variant="secondary" size="sm" onClick={handleRelearn} disabled={relearning}>
                    {relearning ? '再学習中...' : '再学習を実行'}
                  </Button>
                </div>
              </div>
              <p className="text-sm text-[var(--text-secondary)] mb-4">
                JPCERT/CCコーパスから抽出した検知パターン。リスクスコアラーが新規ドメイン判定時に照合し、未観測ドメインでも高精度パターン一致で+最大30点加算します。
              </p>

              {relearnResult && (
                <Alert variant={relearnResult.startsWith('エラー') ? 'error' : 'success'} className="mb-4">
                  <div className="text-sm">{relearnResult}</div>
                </Alert>
              )}

              {patternsError && (
                <Alert variant="error" className="mb-4"><div className="text-sm">{patternsError}</div></Alert>
              )}

              {patternsLoading && (
                <p className="text-sm text-[var(--text-tertiary)]">読み込み中...</p>
              )}

              {!patternsLoading && patterns && (
                <div className="space-y-4">
                  {/* サマリ */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {['domain_keyword', 'path_prefix', 'tld_abuse', 'subdomain'].map((t) => {
                      const s = patterns.summary.find((x) => x.patternType === t);
                      const labels: Record<string, string> = {
                        domain_keyword: 'ドメインkw',
                        path_prefix: 'パスプレフィックス',
                        tld_abuse: 'TLD乱用',
                        subdomain: 'サブドメイン',
                      };
                      return (
                        <div key={t} className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800 border border-[var(--border-default)]">
                          <div className="text-xs text-[var(--text-secondary)] mb-1">{labels[t]}</div>
                          <div className="text-xl font-bold text-[var(--text-primary)]">{s?.count ?? 0} <span className="text-sm font-normal">件</span></div>
                          {s?.maxOccurrences != null && (
                            <div className="text-xs text-[var(--text-tertiary)]">最大 {s.maxOccurrences}回観測</div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* パターン一覧 */}
                  {patterns.patterns.length > 0 ? (
                    <div className="overflow-x-auto rounded-lg border border-[var(--border-default)]">
                      <table className="w-full text-xs">
                        <thead className="bg-gray-50 dark:bg-gray-800 text-[var(--text-secondary)] uppercase tracking-wide">
                          <tr>
                            <th className="text-left px-3 py-2 font-medium">タイプ</th>
                            <th className="text-left px-3 py-2 font-medium">パターン</th>
                            <th className="text-right px-3 py-2 font-medium">観測数</th>
                            <th className="text-right px-3 py-2 font-medium">精度</th>
                            <th className="text-left px-3 py-2 font-medium">例</th>
                            <th className="text-left px-3 py-2 font-medium">最終観測</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--border-subtle)]">
                          {patterns.patterns.map((p) => (
                            <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                              <td className="px-3 py-2 text-[var(--text-secondary)] whitespace-nowrap">
                                <span className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-900 text-[var(--text-primary)] text-[10px]">
                                  {p.patternType}
                                </span>
                              </td>
                              <td className="px-3 py-2 font-mono text-[var(--text-primary)]">{p.pattern}</td>
                              <td className="px-3 py-2 text-right tabular-nums text-[var(--text-primary)]">{p.occurrences}</td>
                              <td className="px-3 py-2 text-right tabular-nums text-[var(--text-secondary)]">
                                {(p.precision * 100).toFixed(2)}%
                              </td>
                              <td className="px-3 py-2 text-[var(--text-tertiary)] max-w-xs">
                                <span className="block truncate" title={p.examples.join('\n')}>
                                  {p.examples[0] ?? '—'}
                                </span>
                              </td>
                              <td className="px-3 py-2 text-[var(--text-secondary)] whitespace-nowrap">
                                {new Date(p.lastSeen).toLocaleDateString('ja-JP')}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-sm text-[var(--text-tertiary)]">
                      まだ学習されたパターンがありません。JPCERT取り込み後に自動実行されます（または「再学習を実行」で手動トリガー可能）。
                    </p>
                  )}
                </div>
              )}
            </div>
          </Card>

          {/* WHOIS Backfill */}
          <Card>
            <div className="p-6">
              <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-2">
                WHOISデータ一括取得
              </h2>
              <p className="text-sm text-[var(--text-secondary)] mb-4">
                レジストラ情報が未取得の検知ドメインに対して、RDAPプロトコル経由でWHOISデータを一括取得します。
                バックグラウンドで処理されるため、ページを閉じても実行は継続します。
              </p>

              <div className="flex items-center gap-4 mb-4">
                <label className="text-sm text-[var(--text-secondary)]">
                  バッチサイズ:
                </label>
                <select
                  value={batchSize}
                  onChange={(e) => setBatchSize(Number(e.target.value))}
                  className="rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] text-[var(--text-primary)] px-3 py-1.5 text-sm"
                  disabled={backfilling}
                >
                  <option value={20}>20件</option>
                  <option value={50}>50件</option>
                  <option value={100}>100件</option>
                  <option value={200}>200件</option>
                </select>
              </div>

              <Button
                variant="primary"
                size="md"
                onClick={handleBackfill}
                disabled={backfilling}
              >
                {backfilling ? '実行中...' : 'WHOIS一括取得を実行'}
              </Button>

              {result && (
                <Alert variant="success" className="mt-4">
                  <p className="font-medium">{result.message}</p>
                  <p className="text-sm mt-1">
                    処理対象: {result.processing}件 / 未取得合計: {result.totalMissing}件
                  </p>
                  {result.totalMissing > result.processing && (
                    <p className="text-sm mt-1 text-[var(--text-secondary)]">
                      残り{result.totalMissing - result.processing}件は再度実行してください
                    </p>
                  )}
                </Alert>
              )}

              {error && (
                <Alert variant="error" className="mt-4">
                  {error}
                </Alert>
              )}
            </div>
          </Card>
        </div>
      </div>
    </AdminGuard>
  );
}
