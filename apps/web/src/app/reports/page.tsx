'use client';

import { useEffect, useState } from 'react';
import { generateReport, getBrands } from '@/lib/api';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, Tooltip as RTooltip,
} from 'recharts';

const REPORT_TYPES = [
  {
    id: 'regulatory',
    title: '行政機関',
    icon: '🏛️',
    description: '全証拠付き詳細レポート',
    detail: 'WHOIS・スクリーンショット・プローブ結果を含む完全な脅威一覧。行政報告・監査対応に。',
    color: 'blue',
  },
  {
    id: 'board',
    title: '取締役会',
    icon: '📊',
    description: 'KPIサマリー・グラフ中心',
    detail: 'リスク件数・削除申請成功率・トレンドをビジュアルで報告。経営レベルの意思決定に。',
    color: 'purple',
  },
  {
    id: 'clo',
    title: 'CLO（法務責任者）',
    icon: '⚖️',
    description: '法的リスク観点の整理',
    detail: '高リスク脅威のみ抽出。法的根拠・対応優先度・レジストラ別集計で法的アクションを支援。',
    color: 'amber',
  },
];

const RISK_COLORS = ['#dc2626', '#f59e0b', '#3b82f6', '#22c55e'];
const CATEGORY_COLORS: Record<string, string> = {
  phishing: '#dc2626', brand_abuse: '#f59e0b', parked: '#6b7280', legitimate: '#22c55e', unknown: '#a855f7',
};
const CATEGORY_LABELS: Record<string, string> = {
  phishing: 'フィッシング', brand_abuse: 'ブランド悪用', parked: 'パーク', legitimate: '正規', unknown: '不明',
};
const STATUS_LABELS: Record<string, string> = {
  new_domain: '新規', monitoring: '監視中', takedown_requested: '削除申請中', resolved: '解決済',
};
const PRIORITY_COLORS: Record<string, string> = {
  '最優先': 'bg-red-100 text-red-800',
  '要対応': 'bg-yellow-100 text-yellow-800',
};

const COLOR_MAP: Record<string, { border: string; bg: string; text: string; hover: string; ring: string }> = {
  blue: { border: 'border-blue-200 dark:border-blue-800', bg: 'bg-blue-50 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-300', hover: 'hover:border-blue-400', ring: 'ring-blue-500' },
  purple: { border: 'border-purple-200', bg: 'bg-purple-50', text: 'text-purple-700', hover: 'hover:border-purple-400', ring: 'ring-purple-500' },
  amber: { border: 'border-amber-200', bg: 'bg-amber-50', text: 'text-amber-700', hover: 'hover:border-amber-400', ring: 'ring-amber-500' },
};

export default function ReportsPage() {
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [brandId, setBrandId] = useState<string>('');
  const [brands, setBrands] = useState<any[]>([]);
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getBrands().then(setBrands).catch(() => {});
  }, []);

  const handleGenerate = async (type: string) => {
    setSelectedType(type);
    setLoading(true);
    setError(null);
    setReport(null);
    try {
      const data = await generateReport(type, brandId || undefined);
      setReport(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">📄 レポート</h1>
          <p className="text-[var(--text-secondary)] mt-1">提出先に合わせたレポートを生成</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={brandId}
            onChange={(e) => setBrandId(e.target.value)}
            className="border border-[var(--border-default)] rounded-lg px-3 py-2 text-sm bg-surface-card"
          >
            <option value="">全ブランド</option>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
          {report && (
            <button
              onClick={() => window.print()}
              className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 print:hidden"
            >
              📥 PDF ダウンロード
            </button>
          )}
        </div>
      </div>

      {/* Report Type Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 print:hidden">
        {REPORT_TYPES.map((rt) => {
          const c = COLOR_MAP[rt.color];
          const isSelected = selectedType === rt.id;
          return (
            <button
              key={rt.id}
              onClick={() => handleGenerate(rt.id)}
              className={`text-left rounded-xl border-2 p-5 transition-all ${c.border} ${c.hover} ${isSelected ? `ring-2 ${c.ring} ${c.bg}` : 'bg-surface-card'}`}
            >
              <div className="text-3xl mb-2">{rt.icon}</div>
              <h3 className="font-bold text-[var(--text-primary)] text-lg">{rt.title}</h3>
              <p className={`text-sm font-medium mt-1 ${c.text}`}>{rt.description}</p>
              <p className="text-xs text-[var(--text-secondary)] mt-2 leading-relaxed">{rt.detail}</p>
            </button>
          );
        })}
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-4 text-red-700 dark:text-red-300">
          <p className="font-medium">エラーが発生しました</p>
          <p className="text-sm mt-1">{error}</p>
        </div>
      )}

      {/* Report Preview */}
      {report && !loading && (
        <div className="bg-surface-card rounded-xl border border-[var(--border-default)] p-8 print:border-0 print:p-0">
          <div className="border-b border-[var(--border-default)] pb-6 mb-6">
            <h2 className="text-xl font-bold text-[var(--text-primary)]">{report.title}</h2>
            <p className="text-sm text-[var(--text-secondary)] mt-1">
              生成日時: {new Date(report.generatedAt).toLocaleString('ja-JP')}
            </p>
          </div>

          {report.type === 'regulatory' && <RegulatoryReport data={report} />}
          {report.type === 'board' && <BoardReport data={report} />}
          {report.type === 'clo' && <CloReport data={report} />}
        </div>
      )}
    </div>
  );
}

/* ========== Regulatory Report ========== */
function RegulatoryReport({ data }: { data: any }) {
  const s = data.summary;
  return (
    <div className="space-y-8">
      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SummaryCard label="検知脅威総数" value={s.totalThreats} />
        <SummaryCard label="危険（即対応）" value={s.dangerCount} color="red" />
        <SummaryCard label="削除申請済" value={s.takedownsSent} color="blue" />
        <SummaryCard label="削除完了" value={s.takedownsCompleted} color="green" />
      </div>

      {/* Timeline */}
      {data.timeline?.length > 0 && (
        <div>
          <h3 className="font-bold text-[var(--text-primary)] mb-3">検知タイムライン</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={data.timeline}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(v: string) => v.slice(5)} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <RTooltip formatter={(v: any) => [`${v}件`, '検知数']} />
              <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Full threat list */}
      <div>
        <h3 className="font-bold text-[var(--text-primary)] mb-3">脅威一覧（全{data.threats.length}件）</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border-default)] text-left">
                <th className="py-2 pr-3 font-medium text-[var(--text-secondary)]">スクリーンショット</th>
                <th className="py-2 pr-3 font-medium text-[var(--text-secondary)]">ドメイン</th>
                <th className="py-2 pr-3 font-medium text-[var(--text-secondary)]">ブランド</th>
                <th className="py-2 pr-3 font-medium text-[var(--text-secondary)]">リスク</th>
                <th className="py-2 pr-3 font-medium text-[var(--text-secondary)]">カテゴリ</th>
                <th className="py-2 pr-3 font-medium text-[var(--text-secondary)]">ステータス</th>
                <th className="py-2 pr-3 font-medium text-[var(--text-secondary)]">初検知</th>
                <th className="py-2 font-medium text-[var(--text-secondary)]">削除申請</th>
              </tr>
            </thead>
            <tbody>
              {data.threats.map((t: any, i: number) => (
                <tr key={i} className="border-b border-[var(--border-subtle)]">
                  <td className="py-2 pr-3">
                    {t.screenshotUrl ? (
                      <img
                        src={t.screenshotUrl}
                        alt={`${t.domain} のスクリーンショット`}
                        className="w-24 h-16 object-cover rounded border border-[var(--border-default)]"
                      />
                    ) : (
                      <div className="w-24 h-16 bg-surface-elevated rounded flex items-center justify-center text-[var(--text-tertiary)] text-xs">
                        未取得
                      </div>
                    )}
                  </td>
                  <td className="py-2 pr-3 font-mono text-xs">{t.domain}</td>
                  <td className="py-2 pr-3">{t.brandName}</td>
                  <td className="py-2 pr-3">
                    <RiskBadge score={t.riskScore} />
                  </td>
                  <td className="py-2 pr-3">
                    {t.analyses.map((a: any) => CATEGORY_LABELS[a.category] || a.category).join(', ') || '—'}
                  </td>
                  <td className="py-2 pr-3">{STATUS_LABELS[t.status] || t.status}</td>
                  <td className="py-2 pr-3 text-xs text-[var(--text-secondary)]">
                    {new Date(t.firstSeen).toLocaleDateString('ja-JP')}
                  </td>
                  <td className="py-2 text-xs">
                    {t.takedowns.length > 0 ? t.takedowns[0].status : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ========== Board Report ========== */
function BoardReport({ data }: { data: any }) {
  const k = data.kpi;
  const rc = k.riskCounts;
  const riskData = [
    { name: '危険', value: rc.danger, fill: '#dc2626' },
    { name: '高', value: rc.high, fill: '#f59e0b' },
    { name: '中', value: rc.medium, fill: '#3b82f6' },
    { name: '低', value: rc.low, fill: '#22c55e' },
  ];

  return (
    <div className="space-y-8">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SummaryCard label="検知脅威総数" value={k.totalThreats} />
        <SummaryCard label="危険レベル" value={rc.danger} color="red" />
        <SummaryCard label="削除申請成功率" value={`${k.takedownSuccessRate}%`} color="green" />
        <SummaryCard label="高リスク" value={rc.high} color="yellow" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Risk Distribution */}
        <div>
          <h3 className="font-bold text-[var(--text-primary)] mb-3">リスク分布</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie data={riskData} cx="50%" cy="50%" innerRadius={50} outerRadius={90} dataKey="value"
                label={({ name, value }: any) => `${name}: ${value}`} labelLine={false}>
                {riskData.map((d, i) => <Cell key={i} fill={d.fill} />)}
              </Pie>
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Category Breakdown */}
        {data.categoryBreakdown?.length > 0 && (
          <div>
            <h3 className="font-bold text-[var(--text-primary)] mb-3">脅威カテゴリ</h3>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={data.categoryBreakdown.map((c: any) => ({
                    name: CATEGORY_LABELS[c.category] || c.category,
                    value: c.count,
                    fill: CATEGORY_COLORS[c.category] || '#6b7280',
                  }))}
                  cx="50%" cy="50%" innerRadius={50} outerRadius={90} dataKey="value"
                  label={({ name, value }: any) => `${name}: ${value}`} labelLine={false}>
                  {data.categoryBreakdown.map((c: any, i: number) => (
                    <Cell key={i} fill={CATEGORY_COLORS[c.category] || '#6b7280'} />
                  ))}
                </Pie>
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Trend */}
      {data.timeline?.length > 0 && (
        <div>
          <h3 className="font-bold text-[var(--text-primary)] mb-3">検知トレンド</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={data.timeline}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(v: string) => v.slice(5)} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <RTooltip formatter={(v: any) => [`${v}件`, '検知数']} />
              <Bar dataKey="count" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Brand Breakdown */}
      {data.brandBreakdown?.length > 0 && (
        <div>
          <h3 className="font-bold text-[var(--text-primary)] mb-3">ブランド別脅威件数</h3>
          <div className="space-y-3">
            {data.brandBreakdown.map((b: any) => {
              const max = Math.max(...data.brandBreakdown.map((x: any) => x.count), 1);
              return (
                <div key={b.name}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium text-[var(--text-primary)]">{b.name}</span>
                    <span className="text-[var(--text-secondary)]">{b.count}件</span>
                  </div>
                  <div className="w-full bg-surface-elevated rounded-full h-2.5">
                    <div className="bg-purple-600 h-2.5 rounded-full" style={{ width: `${(b.count / max) * 100}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ========== CLO Report ========== */
function CloReport({ data }: { data: any }) {
  return (
    <div className="space-y-8">
      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <SummaryCard label="高リスク脅威" value={data.summary.highRiskCount} color="red" />
        {Object.entries(data.summary.categoryCounts).map(([cat, count]: [string, any]) => (
          <SummaryCard key={cat} label={CATEGORY_LABELS[cat] || cat} value={count} />
        ))}
      </div>

      {/* Threats with legal context */}
      <div>
        <h3 className="font-bold text-[var(--text-primary)] mb-3">法的リスク一覧</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border-default)] text-left">
                <th className="py-2 pr-3 font-medium text-[var(--text-secondary)]">優先度</th>
                <th className="py-2 pr-3 font-medium text-[var(--text-secondary)]">ドメイン</th>
                <th className="py-2 pr-3 font-medium text-[var(--text-secondary)]">ブランド</th>
                <th className="py-2 pr-3 font-medium text-[var(--text-secondary)]">リスク</th>
                <th className="py-2 pr-3 font-medium text-[var(--text-secondary)]">法的根拠</th>
                <th className="py-2 font-medium text-[var(--text-secondary)]">TD状況</th>
              </tr>
            </thead>
            <tbody>
              {data.threats.map((t: any, i: number) => (
                <tr key={i} className="border-b border-[var(--border-subtle)]">
                  <td className="py-2 pr-3">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${PRIORITY_COLORS[t.priority] || 'bg-surface-elevated text-[var(--text-primary)]'}`}>
                      {t.priority}
                    </span>
                  </td>
                  <td className="py-2 pr-3 font-mono text-xs">{t.domain}</td>
                  <td className="py-2 pr-3">{t.brandName}</td>
                  <td className="py-2 pr-3"><RiskBadge score={t.riskScore} /></td>
                  <td className="py-2 pr-3 text-xs">
                    {t.legalCategories.map((lc: any) => lc.legalBasis).join('、') || '—'}
                  </td>
                  <td className="py-2 text-xs">{t.takedownStatus === 'none' ? '未申請' : t.takedownStatus}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Registrar Breakdown */}
      {data.registrarBreakdown?.length > 0 && (
        <div>
          <h3 className="font-bold text-[var(--text-primary)] mb-3">レジストラ別集計</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {data.registrarBreakdown.map((r: any) => (
              <div key={r.registrar} className="flex items-center justify-between bg-surface-base rounded-lg px-4 py-3">
                <span className="text-sm font-medium text-[var(--text-primary)]">{r.registrar}</span>
                <span className="text-sm font-bold text-[var(--text-primary)]">{r.count}件</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ========== Shared Components ========== */
function SummaryCard({ label, value, color }: { label: string; value: string | number; color?: string }) {
  const colorClass = color === 'red' ? 'text-red-600' : color === 'green' ? 'text-green-600' : color === 'blue' ? 'text-blue-600' : color === 'yellow' ? 'text-yellow-600' : 'text-[var(--text-primary)]';
  return (
    <div className="bg-surface-base rounded-lg p-4">
      <p className="text-xs text-[var(--text-secondary)] font-medium">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${colorClass}`}>{value}</p>
    </div>
  );
}

function RiskBadge({ score }: { score: number | null }) {
  const s = score ?? 0;
  const { label, cls } = s >= 80
    ? { label: '🔴 危険', cls: 'bg-red-100 text-red-800' }
    : s >= 60
    ? { label: '🟠 高', cls: 'bg-orange-100 text-orange-800' }
    : s >= 40
    ? { label: '🟡 中', cls: 'bg-yellow-100 text-yellow-800' }
    : { label: '🟢 低', cls: 'bg-green-100 text-green-800' };
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cls}`}>
      {label} ({s})
    </span>
  );
}
