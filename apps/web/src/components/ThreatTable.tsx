'use client';

import { useState } from 'react';
import Tooltip from './Tooltip';
import { RiskBadgeCompact } from './RiskBadge';
import { triggerProbe } from '@/lib/api';

interface BrowserReport {
  provider: string;
  status: string;
}

interface Threat {
  id: string;
  domain: string;
  status: string;
  riskScore: number | null;
  firstSeen: string;
  screenshotUrl?: string | null;
  whoisData?: string | null;
  sslInfo?: string | null;
  brand: { name: string; domain: string };
  analyses: Array<{ category: string; confidence: number }>;
  browserReports?: BrowserReport[];
}

const statusColors: Record<string, string> = {
  new_domain: 'bg-blue-100 text-blue-800',
  analyzing: 'bg-yellow-100 text-yellow-800',
  confirmed_threat: 'bg-red-100 text-red-800',
  false_positive: 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200',
  takedown_sent: 'bg-orange-100 text-orange-800',
  resolved: 'bg-green-100 text-green-800',
};

const statusLabels: Record<string, string> = {
  new_domain: '未対応',
  analyzing: '確認中',
  confirmed_threat: '⚠️ 脅威確認',
  false_positive: '誤検知',
  takedown_sent: '削除申請中',
  resolved: '✅ 対応完了',
};

const categoryLabels: Record<string, string> = {
  phishing: 'フィッシング',
  brand_abuse: 'ブランド悪用',
  parked: 'パーク',
  legitimate: '正規',
  unknown: '不明',
};

const categoryDescriptions: Record<string, string> = {
  phishing: '御社サイトを模倣した偽サイトです',
  brand_abuse: '御社ブランドを無断使用しています',
  parked: 'ドメインが取得済み（現在未使用）',
  legitimate: '正規サイトと判定されました',
  unknown: '調査中です',
};

interface ThreatTableProps {
  threats: Threat[];
  onSelect?: (id: string) => void;
  expandable?: boolean;
  selectable?: boolean;
  selectedIds?: Set<string>;
  onSelectionChange?: (ids: Set<string>) => void;
  onScreenshotCaptured?: () => void;
}

export default function ThreatTable({ threats, onSelect, expandable = false, selectable = false, selectedIds, onSelectionChange, onScreenshotCaptured }: ThreatTableProps) {
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  const [capturingScreenshot, setCapturingScreenshot] = useState<Set<string>>(new Set());

  const handleCaptureScreenshot = async (threatId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCapturingScreenshot(prev => new Set(prev).add(threatId));
    try {
      await triggerProbe(threatId);
      onScreenshotCaptured?.();
    } catch (err: any) {
      alert(`スクリーンショット取得に失敗しました: ${err.message}`);
    } finally {
      setCapturingScreenshot(prev => {
        const next = new Set(prev);
        next.delete(threatId);
        return next;
      });
    }
  };

  const toggleSelect = (id: string, e: React.MouseEvent | React.ChangeEvent) => {
    e.stopPropagation();
    if (!selectedIds || !onSelectionChange) return;
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onSelectionChange(next);
  };

  const toggleAll = () => {
    if (!selectedIds || !onSelectionChange) return;
    if (selectedIds.size === threats.length) {
      onSelectionChange(new Set());
    } else {
      onSelectionChange(new Set(threats.map((t) => t.id)));
    }
  };

  if (threats.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500 dark:text-gray-400 dark:text-gray-500">
        検知された脅威はありません
      </div>
    );
  }

  const handleRowClick = (threat: Threat) => {
    if (expandable) {
      setExpandedRowId(expandedRowId === threat.id ? null : threat.id);
    } else {
      onSelect?.(threat.id);
    }
  };

  const parseWhoisSummary = (whoisData: string | null | undefined): string | null => {
    if (!whoisData) return null;
    try {
      const data = JSON.parse(whoisData);
      const parts: string[] = [];
      if (data.registrar) parts.push(`登録先: ${data.registrar}`);
      if (data.creationDate) parts.push(`登録日: ${new Date(data.creationDate).toLocaleDateString('ja-JP')}`);
      if (data.registrantOrganization) parts.push(`登録者: ${data.registrantOrganization}`);
      else parts.push('登録者情報が隠されています（WHOIS匿名化）');
      return parts.join(' / ');
    } catch {
      return whoisData.slice(0, 100);
    }
  };

  const parseSslSummary = (sslInfo: string | null | undefined): string | null => {
    if (!sslInfo) return null;
    try {
      const data = JSON.parse(sslInfo);
      const parts: string[] = [];
      if (data.issuer) parts.push(`発行者: ${data.issuer}`);
      if (data.validFrom) {
        const from = new Date(data.validFrom);
        const daysAgo = Math.floor((Date.now() - from.getTime()) / (1000 * 60 * 60 * 24));
        parts.push(`発行${daysAgo}日前のSSL証明書`);
      }
      return parts.join(' / ');
    } catch {
      return sslInfo.slice(0, 100);
    }
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-200 dark:border-gray-700 text-left text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500">
            {selectable && (
              <th className="pb-3 font-medium w-10">
                <input
                  type="checkbox"
                  checked={selectedIds ? selectedIds.size === threats.length && threats.length > 0 : false}
                  onChange={toggleAll}
                  className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                />
              </th>
            )}
            <th className="pb-3 font-medium">ドメイン</th>
            <th className="pb-3 font-medium">概要</th>
            <th className="pb-3 font-medium">
              <span className="flex items-center gap-1">
                リスク
                <Tooltip content="リスクスコア（0〜100）と推奨アクション。🔴危険（80+）= 即削除申請、🟠高（60-79）= 要確認、🟡中（40-59）= 監視継続、🟢低（0-39）= 対応不要。" />
              </span>
            </th>
            <th className="pb-3 font-medium">ステータス</th>
            <th className="pb-3 font-medium">ブラウザ申請</th>
            <th className="pb-3 font-medium">検知日</th>
            {expandable && <th className="pb-3 font-medium w-8"></th>}
          </tr>
        </thead>
        <tbody>
          {threats.map((threat) => (
            <>
              <tr
                key={threat.id}
                className={`border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900 cursor-pointer ${
                  expandedRowId === threat.id ? 'bg-gray-50 dark:bg-gray-900' : ''
                }`}
                onClick={() => handleRowClick(threat)}
              >
                {selectable && (
                  <td className="py-3" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selectedIds?.has(threat.id) || false}
                      onChange={(e) => toggleSelect(threat.id, e)}
                      className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                    />
                  </td>
                )}
                <td className="py-3">
                  <div className="font-mono text-sm font-medium">{threat.domain}</div>
                  <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">vs {threat.brand.domain}</div>
                </td>
                <td className="py-3 text-sm text-gray-600 dark:text-gray-300">
                  {threat.analyses[0]
                    ? categoryDescriptions[threat.analyses[0].category] || threat.analyses[0].category
                    : '—'}
                </td>
                <td className="py-3">
                  <RiskBadgeCompact score={threat.riskScore} threatId={threat.id} />
                </td>
                <td className="py-3">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[threat.status] || 'bg-gray-100 dark:bg-gray-700'}`}>
                    {statusLabels[threat.status] || threat.status}
                  </span>
                </td>
                <td className="py-3">
                  <BrowserReportIcons reports={threat.browserReports} />
                </td>
                <td className="py-3 text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500">
                  {new Date(threat.firstSeen).toLocaleDateString('ja-JP')}
                </td>
                {expandable && (
                  <td className="py-3 text-gray-400 dark:text-gray-500">
                    <span className={`inline-block transition-transform ${expandedRowId === threat.id ? 'rotate-180' : ''}`}>
                      ▼
                    </span>
                  </td>
                )}
              </tr>

              {/* Layer 2: Expanded Detail Panel */}
              {expandable && expandedRowId === threat.id && (
                <tr key={`${threat.id}-detail`}>
                  <td colSpan={selectable ? 8 : 7} className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                    <div className="p-5 space-y-4">
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {/* Screenshot */}
                        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="text-sm font-bold text-gray-700 dark:text-gray-200">📸 スクリーンショット</h4>
                            <button
                              onClick={(e) => handleCaptureScreenshot(threat.id, e)}
                              disabled={capturingScreenshot.has(threat.id)}
                              className="px-2 py-1 text-xs font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {capturingScreenshot.has(threat.id) ? (
                                <span className="flex items-center gap-1">
                                  <span className="animate-spin">⟳</span> 取得中...
                                </span>
                              ) : (
                                '🔄 再取得'
                              )}
                            </button>
                          </div>
                          {threat.screenshotUrl ? (
                            <img
                              src={threat.screenshotUrl}
                              alt={`${threat.domain} のスクリーンショット`}
                              className="w-full rounded border border-gray-200 dark:border-gray-700"
                            />
                          ) : (
                            <div className="flex flex-col items-center justify-center h-32 bg-gray-100 dark:bg-gray-700 rounded text-gray-400 dark:text-gray-500 text-sm gap-2">
                              <span>スクリーンショット未取得</span>
                              <button
                                onClick={(e) => handleCaptureScreenshot(threat.id, e)}
                                disabled={capturingScreenshot.has(threat.id)}
                                className="px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {capturingScreenshot.has(threat.id) ? '取得中...' : '📷 スクリーンショットを取得'}
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Analysis Details */}
                        <div className="space-y-3">
                          {/* Threat Category & Confidence */}
                          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                            <h4 className="text-sm font-bold text-gray-700 dark:text-gray-200 mb-2">🔍 判定根拠</h4>
                            {threat.analyses.length > 0 ? (
                              <div className="space-y-2">
                                {threat.analyses.map((a, i) => (
                                  <div key={i} className="flex items-center justify-between">
                                    <span className="text-sm text-gray-600 dark:text-gray-300">
                                      {categoryLabels[a.category] || a.category}
                                    </span>
                                    <div className="flex items-center gap-2">
                                      <div className="w-24 bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                                        <div
                                          className={`h-2 rounded-full ${
                                            a.confidence >= 0.8 ? 'bg-red-500' :
                                            a.confidence >= 0.6 ? 'bg-orange-500' :
                                            'bg-yellow-500'
                                          }`}
                                          style={{ width: `${a.confidence * 100}%` }}
                                        />
                                      </div>
                                      <span className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 w-10 text-right">
                                        {Math.round(a.confidence * 100)}%
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-sm text-gray-400 dark:text-gray-500">分析データなし</p>
                            )}
                          </div>

                          {/* WHOIS Summary */}
                          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                            <h4 className="text-sm font-bold text-gray-700 dark:text-gray-200 mb-1">🌐 ドメイン情報</h4>
                            <p className="text-sm text-gray-600 dark:text-gray-300">
                              {parseWhoisSummary(threat.whoisData) || '情報未取得'}
                            </p>
                          </div>

                          {/* SSL Summary */}
                          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                            <h4 className="text-sm font-bold text-gray-700 dark:text-gray-200 mb-1">🔒 SSL証明書</h4>
                            <p className="text-sm text-gray-600 dark:text-gray-300">
                              {parseSslSummary(threat.sslInfo) || '情報未取得'}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex gap-3 pt-2">
                        <a
                          href={`/threats/${threat.id}`}
                          className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors"
                          onClick={(e) => e.stopPropagation()}
                        >
                          🚨 削除申請
                        </a>
                        <button
                          className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-600 dark:bg-gray-600 transition-colors"
                          onClick={(e) => {
                            e.stopPropagation();
                            // TODO: Implement false positive marking
                            alert('誤検知マーク機能は実装予定です');
                          }}
                        >
                          誤検知にする
                        </button>
                        <a
                          href={`/threats/${threat.id}`}
                          className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900 transition-colors"
                          onClick={(e) => e.stopPropagation()}
                        >
                          技術詳細 →
                        </a>
                      </div>
                    </div>
                  </td>
                </tr>
              )}
            </>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BrowserReportIcons({ reports }: { reports?: BrowserReport[] }) {
  const google = reports?.find((r) => r.provider === 'GOOGLE_SAFE_BROWSING');
  const microsoft = reports?.find((r) => r.provider === 'MICROSOFT_SMARTSCREEN');

  const getIconColor = (report?: BrowserReport) => {
    if (!report) return 'text-gray-300 dark:text-gray-600';
    if (report.status === 'error') return 'text-red-400 dark:text-red-500';
    if (report.status === 'confirmed') return 'text-green-500 dark:text-green-400';
    return 'text-blue-500 dark:text-blue-400'; // submitted/pending
  };

  const getTitle = (provider: string, report?: BrowserReport) => {
    if (!report) return `${provider}: 未申請`;
    if (report.status === 'error') return `${provider}: エラー`;
    if (report.status === 'confirmed') return `${provider}: 確認済み`;
    return `${provider}: 申請済み`;
  };

  return (
    <div className="flex items-center gap-1.5">
      <span title={getTitle('Google', google)} className={`text-sm ${getIconColor(google)}`}>
        <svg className="w-4 h-4 inline" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z" clipRule="evenodd" /></svg>
      </span>
      <span title={getTitle('SmartScreen', microsoft)} className={`text-sm ${getIconColor(microsoft)}`}>
        <svg className="w-4 h-4 inline" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
      </span>
    </div>
  );
}
