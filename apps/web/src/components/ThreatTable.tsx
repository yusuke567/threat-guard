'use client';

import { useState, Fragment } from 'react';
import Image from 'next/image';
import { RiskBadgeCompact } from './RiskBadge';
import { Icon, useToast } from './ui';
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
  resolved: '対応完了',
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
  const toast = useToast();
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  const [capturingScreenshot, setCapturingScreenshot] = useState<Set<string>>(new Set());

  const handleCaptureScreenshot = async (threatId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setCapturingScreenshot(prev => new Set(prev).add(threatId));
    try {
      await triggerProbe(threatId);
      onScreenshotCaptured?.();
    } catch (err: any) {
      toast.error(`スクリーンショット取得に失敗しました: ${err.message}`);
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
      <div className="text-center py-12 text-[var(--text-secondary)]">
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
          <tr className="border-b border-[var(--border-default)] text-left text-sm text-[var(--text-secondary)]">
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
            <th className="pb-3 font-medium">リスク</th>
            <th className="pb-3 font-medium">ステータス</th>
            <th className="pb-3 font-medium">検知日</th>
            {expandable && <th className="pb-3 font-medium w-8"></th>}
          </tr>
        </thead>
        <tbody>
          {threats.map((threat) => (
            <Fragment key={threat.id}>
              <tr
                className={`border-b border-[var(--border-subtle)] hover:bg-surface-elevated cursor-pointer transition-colors ${
                  expandedRowId === threat.id ? 'bg-surface-elevated' : ''
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
                  <div className="font-mono text-xs sm:text-sm font-medium truncate max-w-[200px] sm:max-w-none">{threat.domain}</div>
                  <div className="text-xs text-[var(--text-tertiary)] mt-0.5">vs {threat.brand.domain}</div>
                </td>
                <td className="py-3 text-sm text-[var(--text-secondary)]">
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
                <td className="py-3 text-sm text-[var(--text-secondary)]">
                  {new Date(threat.firstSeen).toLocaleDateString('ja-JP')}
                </td>
                {expandable && (
                  <td className="py-3 text-[var(--text-tertiary)]">
                    <span className={`inline-block transition-transform ${expandedRowId === threat.id ? 'rotate-180' : ''}`}>
                      ▼
                    </span>
                  </td>
                )}
              </tr>

              {/* Layer 2: Expanded Detail Panel */}
              {expandable && expandedRowId === threat.id && (
                <tr>
                  <td colSpan={selectable ? 7 : 6} className="bg-surface-elevated border-b border-[var(--border-default)] animate-fade-in">
                    <div className="p-5 space-y-4">
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {/* Screenshot */}
                        <div className="bg-surface-card rounded-lg border border-[var(--border-default)] p-4">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-1.5"><Icon name="camera" size={16} /> スクリーンショット</h4>
                            <button
                              type="button"
                              onClick={(e) => handleCaptureScreenshot(threat.id, e)}
                              disabled={capturingScreenshot.has(threat.id)}
                              className="px-2 py-1 text-xs font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {capturingScreenshot.has(threat.id) ? (
                                <span className="flex items-center gap-1">
                                  <span className="animate-spin">⟳</span> 取得中...
                                </span>
                              ) : (
                                <><Icon name="refresh" size={14} /> 再取得</>
                              )}
                            </button>
                          </div>
                          {threat.screenshotUrl ? (
                            <Image
                              src={threat.screenshotUrl}
                              alt={`${threat.domain} のスクリーンショット`}
                              width={800}
                              height={450}
                              className="w-full rounded border border-gray-200 dark:border-gray-700"
                              unoptimized
                            />
                          ) : (
                            <div className="flex flex-col items-center justify-center h-32 bg-surface-elevated rounded text-[var(--text-tertiary)] text-sm gap-2">
                              <span>スクリーンショット未取得</span>
                              <button
                                type="button"
                                onClick={(e) => handleCaptureScreenshot(threat.id, e)}
                                disabled={capturingScreenshot.has(threat.id)}
                                className="px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {capturingScreenshot.has(threat.id) ? '取得中...' : <><Icon name="camera" size={14} /> スクリーンショットを取得</>}
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Analysis Details */}
                        <div className="space-y-3">
                          {/* Threat Category & Confidence */}
                          <div className="bg-surface-card rounded-lg border border-[var(--border-default)] p-4">
                            <h4 className="text-sm font-bold text-[var(--text-primary)] mb-2 flex items-center gap-1.5"><Icon name="search" size={16} /> 判定根拠</h4>
                            {threat.analyses.length > 0 ? (
                              <div className="space-y-2">
                                {threat.analyses.map((a, i) => (
                                  <div key={i} className="flex items-center justify-between">
                                    <span className="text-sm text-[var(--text-secondary)]">
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
                                      <span className="text-xs text-[var(--text-secondary)] w-10 text-right">
                                        {Math.round(a.confidence * 100)}%
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-sm text-[var(--text-tertiary)]">分析データなし</p>
                            )}
                          </div>

                          {/* WHOIS Summary */}
                          <div className="bg-surface-card rounded-lg border border-[var(--border-default)] p-4">
                            <h4 className="text-sm font-bold text-[var(--text-primary)] mb-1 flex items-center gap-1.5"><Icon name="globe" size={16} /> ドメイン情報</h4>
                            <p className="text-sm text-[var(--text-secondary)]">
                              {parseWhoisSummary(threat.whoisData) || '情報未取得'}
                            </p>
                          </div>

                          {/* SSL Summary */}
                          <div className="bg-surface-card rounded-lg border border-[var(--border-default)] p-4">
                            <h4 className="text-sm font-bold text-[var(--text-primary)] mb-1 flex items-center gap-1.5"><Icon name="lock" size={16} /> SSL証明書</h4>
                            <p className="text-sm text-[var(--text-secondary)]">
                              {parseSslSummary(threat.sslInfo) || '情報未取得'}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex gap-3 pt-2 flex-wrap">
                        <a
                          href={`/threats/${threat.id}`}
                          className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors"
                          onClick={(e) => e.stopPropagation()}
                        >
                          削除申請
                        </a>
                        <button
                          className="px-4 py-2 bg-surface-elevated text-[var(--text-primary)] rounded-lg text-sm font-medium hover:opacity-80 transition-colors"
                          onClick={(e) => {
                            e.stopPropagation();
                            // TODO: Implement false positive marking
                            toast.info('誤検知マーク機能は実装予定です');
                          }}
                        >
                          誤検知にする
                        </button>
                        <a
                          href={`/threats/${threat.id}`}
                          className="px-4 py-2 bg-surface-card border border-[var(--border-default)] text-[var(--text-primary)] rounded-lg text-sm font-medium hover:bg-surface-elevated transition-colors"
                          onClick={(e) => e.stopPropagation()}
                        >
                          技術詳細 →
                        </a>
                      </div>
                    </div>
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

