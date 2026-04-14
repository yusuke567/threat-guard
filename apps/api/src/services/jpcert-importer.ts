/**
 * JPCERT/CC phishurl-list の取り込みと、Pro+組織の登録ブランドへの自動マッチング。
 *
 * Source: https://github.com/JPCERTCC/phishurl-list
 * Format: 年次ディレクトリ配下に YYYYMM.csv（columns: date, URL, description）
 *
 * 利用規約: 商用SaaS内部利用については別途確認済（再配布は不可）。
 */
import { prisma } from '../lib/prisma.js';
import { isProOrAbove } from '../lib/plan.js';
import { calculateRiskScore } from './risk-scorer.js';
import { notifyNewThreat } from './slack-notifier.js';
import { emailNotifyNewThreat } from './email-notifier.js';

const REPO_RAW_BASE = 'https://raw.githubusercontent.com/JPCERTCC/phishurl-list/main';
const BATCH_SIZE = 500;

interface JpcertRow {
  url: string;
  domain: string;
  brandLabel: string;
  observedAt: Date;
}

export interface ImportResult {
  fetchedCount: number;
  insertedCount: number;
  brandHitCount: number;
  alertedOrgIds: string[];
  monthlyBreakdown: Record<string, number>; // "YYYY-MM" -> count
}

/**
 * `date,URL,description` 形式のCSV1行をパース。
 * URLにカンマが含まれる可能性があるため、最初と最後の `,` で分割。
 */
function parseLine(line: string): { date: string; url: string; description: string } | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  const firstComma = trimmed.indexOf(',');
  const lastComma = trimmed.lastIndexOf(',');
  if (firstComma === -1 || firstComma === lastComma) return null;

  return {
    date: trimmed.slice(0, firstComma).trim(),
    url: trimmed.slice(firstComma + 1, lastComma).trim(),
    description: trimmed.slice(lastComma + 1).trim(),
  };
}

function parseDate(dateStr: string): Date | null {
  // 想定: "2024/01/04 10:02:00"
  const normalized = dateStr.replace(/\//g, '-').replace(' ', 'T');
  const d = new Date(normalized);
  return Number.isNaN(d.getTime()) ? null : d;
}

function extractDomain(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

async function fetchMonth(year: number, month: number): Promise<JpcertRow[]> {
  const yyyy = year.toString();
  const mm = month.toString().padStart(2, '0');
  const fileUrl = `${REPO_RAW_BASE}/${yyyy}/${yyyy}${mm}.csv`;

  const res = await fetch(fileUrl);
  if (res.status === 404) return []; // 未公開月
  if (!res.ok) {
    console.warn(`[JpcertImporter] ${yyyy}-${mm}: HTTP ${res.status}`);
    return [];
  }

  const text = await res.text();
  const rows: JpcertRow[] = [];
  for (const line of text.split(/\r?\n/).slice(1)) {
    const parsed = parseLine(line);
    if (!parsed) continue;
    const observedAt = parseDate(parsed.date);
    const domain = extractDomain(parsed.url);
    if (!observedAt || !domain) continue;
    rows.push({ url: parsed.url, domain, brandLabel: parsed.description, observedAt });
  }
  return rows;
}

async function upsertBatch(rows: JpcertRow[]): Promise<number> {
  if (rows.length === 0) return 0;
  const result = await prisma.knownPhishingUrl.createMany({
    data: rows.map((r) => ({
      url: r.url,
      domain: r.domain,
      brandLabel: r.brandLabel,
      observedAt: r.observedAt,
      source: 'jpcert',
    })),
    skipDuplicates: true,
  });
  return result.count;
}

/**
 * Pro+組織の登録ブランドに対し、新規取り込み済みフィッシングURLを照合し
 * 該当があれば DetectedDomain として自動登録 → 既存アラートフローに乗せる。
 *
 * マッチング条件: `Brand.name` または `Brand.keywords`(カンマ区切り) のいずれかが
 * `KnownPhishingUrl.brandLabel` に部分一致（大文字小文字無視、最小2文字）。
 *
 * @param sinceImportedAt この時刻以降に取り込まれたURLのみ対象
 * @returns 自動登録した件数 + 通知対象組織IDセット
 */
export async function matchAgainstProBrands(
  sinceImportedAt: Date,
): Promise<{ hitCount: number; alertedOrgIds: Set<string> }> {
  // Pro+組織の全ブランドを取得
  const proBrands = await prisma.brand.findMany({
    where: { organization: { plan: { in: ['professional', 'enterprise', 'enterprise_plus'] } } },
    include: { organization: { select: { id: true, plan: true } } },
  });

  if (proBrands.length === 0) {
    return { hitCount: 0, alertedOrgIds: new Set() };
  }

  // 安全側ガード: organization.plan が想定外の値だった場合は除外
  const eligibleBrands = proBrands.filter((b) => isProOrAbove(b.organization?.plan));

  // 各ブランドの候補キーワードを準備
  const brandCandidates = eligibleBrands.map((b) => {
    const keywords = (b.keywords || '')
      .split(',')
      .map((k) => k.trim().toLowerCase())
      .filter((k) => k.length >= 2);
    const candidates = new Set<string>([b.name.toLowerCase(), ...keywords]);
    return { brand: b, candidates: [...candidates].filter((c) => c.length >= 2) };
  });

  // 新規取り込み分のURLを取得
  const newUrls = await prisma.knownPhishingUrl.findMany({
    where: { importedAt: { gte: sinceImportedAt } },
    select: { id: true, url: true, domain: true, brandLabel: true, observedAt: true },
  });

  let hitCount = 0;
  const alertedOrgIds = new Set<string>();

  for (const url of newUrls) {
    const labelLower = url.brandLabel.toLowerCase();

    for (const { brand, candidates } of brandCandidates) {
      const matched = candidates.some((c) => labelLower.includes(c) || c.includes(labelLower));
      if (!matched) continue;

      // 既に同一(brandId, domain)のDetectedDomainがある場合はスキップ
      const existing = await prisma.detectedDomain.findFirst({
        where: { brandId: brand.id, domain: url.domain },
        select: { id: true },
      });
      if (existing) continue;

      try {
        const detected = await prisma.detectedDomain.create({
          data: {
            brandId: brand.id,
            domain: url.domain,
            source: 'jpcert_feed',
            firstSeen: url.observedAt, // JPCERT観測日を採用
            status: 'new_domain',
          },
        });

        // リスクスコア計算（jpcertBoost +30 が効くので必ず60超えるはず）
        const score = await calculateRiskScore(detected.id);

        // 既存のアラートフロー（Starterでもメールアラートは届くが、
        // ここに到達するのはPro+のブランドのみなので差別化を担保）
        if (score >= 60) {
          await notifyNewThreat({
            brandId: brand.id,
            brandName: brand.name,
            domain: url.domain,
            riskScore: score,
            category: 'phishing',
            source: 'JPCERT/CC履歴',
          });
          try {
            await emailNotifyNewThreat({
              brandId: brand.id,
              brandName: brand.name,
              domain: url.domain,
              detectedDomainId: detected.id,
              riskScore: score,
              category: 'phishing',
              source: 'JPCERT/CC履歴',
            });
          } catch (mailErr) {
            console.error(`[JpcertImporter] Email notification failed for ${url.domain}:`, mailErr);
          }
        }

        hitCount++;
        alertedOrgIds.add(brand.organizationId);
      } catch (err) {
        console.error(`[JpcertImporter] Failed to register DetectedDomain for ${brand.name}/${url.domain}:`, err);
      }
    }
  }

  return { hitCount, alertedOrgIds };
}

/**
 * 1回分の取り込み実行。FeedImportRunに記録し、結果を返す。
 */
export async function runJpcertImport(opts: {
  fromYear: number;
  toYear: number;
}): Promise<ImportResult & { runId: string }> {
  const startedAt = new Date();
  const run = await prisma.feedImportRun.create({
    data: { source: 'jpcert', status: 'running', startedAt },
  });

  const monthlyBreakdown: Record<string, number> = {};
  let fetchedCount = 0;
  let insertedCount = 0;

  try {
    for (let year = opts.fromYear; year <= opts.toYear; year++) {
      for (let month = 1; month <= 12; month++) {
        const rows = await fetchMonth(year, month);
        if (rows.length === 0) continue;

        const key = `${year}-${String(month).padStart(2, '0')}`;
        monthlyBreakdown[key] = rows.length;
        fetchedCount += rows.length;

        for (let i = 0; i < rows.length; i += BATCH_SIZE) {
          const batch = rows.slice(i, i + BATCH_SIZE);
          insertedCount += await upsertBatch(batch);
        }
        console.log(`[JpcertImporter] ${key}: fetched=${rows.length}`);
      }
    }

    // Pro+組織のブランドへの自動マッチング
    const { hitCount, alertedOrgIds } = await matchAgainstProBrands(startedAt);

    const completedAt = new Date();
    await prisma.feedImportRun.update({
      where: { id: run.id },
      data: {
        status: 'success',
        fetchedCount,
        insertedCount,
        brandHitCount: hitCount,
        alertedOrgIds: [...alertedOrgIds].join(','),
        completedAt,
        metadata: JSON.stringify({ monthlyBreakdown }),
      },
    });

    return {
      runId: run.id,
      fetchedCount,
      insertedCount,
      brandHitCount: hitCount,
      alertedOrgIds: [...alertedOrgIds],
      monthlyBreakdown,
    };
  } catch (err: any) {
    await prisma.feedImportRun.update({
      where: { id: run.id },
      data: {
        status: 'failed',
        completedAt: new Date(),
        fetchedCount,
        insertedCount,
        error: err?.message || String(err),
      },
    });
    throw err;
  }
}
