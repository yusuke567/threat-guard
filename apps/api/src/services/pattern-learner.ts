/**
 * Layer 4: JPCERTコーパスからの検知パターン自動学習。
 *
 * KnownPhishingUrl 全件を走査して、以下の4種類のパターンを抽出し
 * JpcertLearnedPattern テーブルに upsert する。
 *
 * 1. domain_keyword: ドメインラベル内の高頻度n-gram（3-7文字）
 * 2. path_prefix:    URLの最初のパスセグメント
 * 3. tld_abuse:      フィッシングで比率が高いTLD
 * 4. subdomain:      サブドメインで多用されるラベル
 *
 * 抽出後、risk-scorer / free-diagnosis / scan-pipeline で利用可能。
 */
import { prisma } from '../lib/prisma.js';

// ────────── チューニングパラメータ ──────────
const MIN_OCCURRENCES_DOMAIN = 10;    // ドメインキーワード最低出現数
const MIN_OCCURRENCES_PATH = 10;
const MIN_OCCURRENCES_TLD = 20;
const MIN_OCCURRENCES_SUBDOMAIN = 10;
const NGRAM_MIN = 4;
const NGRAM_MAX = 7;
const MAX_PATTERNS_PER_TYPE = 50;     // 上位N件のみ保存
const EXAMPLES_PER_PATTERN = 3;

// 一般的すぎて識別に使えないキーワード（ブラックリスト）
const STOP_WORDS = new Set([
  'www', 'com', 'net', 'org', 'jp', 'co', 'online', 'site', 'web', 'page',
  'html', 'http', 'https', 'index', 'home', 'main', 'new', 'app', 'cloud',
  'shop', 'store', 'mobile', 'japan', 'global', 'world', 'service', 'info',
]);

interface Candidate {
  pattern: string;
  occurrences: number;
  examples: string[];
}

/**
 * ブランドラベルを含むstring（ASCII化済み）の重複排除用キー。
 * eTLD判定は厳密にせず、末尾ラベルをTLDとみなす簡易版。
 */
function extractDomainLabels(domain: string): string[] {
  const parts = domain.toLowerCase().split('.').filter(Boolean);
  if (parts.length < 2) return [];
  // TLDを除いた全ラベル
  return parts.slice(0, -1);
}

function extractNgrams(label: string, minLen: number, maxLen: number): string[] {
  const ngrams: string[] = [];
  const clean = label.replace(/[^a-z0-9]/g, '');
  if (clean.length < minLen) return ngrams;
  for (let len = minLen; len <= Math.min(maxLen, clean.length); len++) {
    for (let i = 0; i + len <= clean.length; i++) {
      ngrams.push(clean.slice(i, i + len));
    }
  }
  return ngrams;
}

/**
 * メイン抽出処理。全件ロードして集計し、upsertする。
 */
export async function learnPatterns(): Promise<{
  domainKeywords: number;
  pathPrefixes: number;
  tldAbuse: number;
  subdomains: number;
  totalExamined: number;
}> {
  const rows = await prisma.knownPhishingUrl.findMany({
    where: { source: 'jpcert' },
    select: { url: true, domain: true },
  });
  const total = rows.length;
  if (total === 0) {
    return { domainKeywords: 0, pathPrefixes: 0, tldAbuse: 0, subdomains: 0, totalExamined: 0 };
  }

  // ─── 1. domain_keyword: n-gram頻度 ───
  const domainKwCounts = new Map<string, Set<string>>(); // pattern -> set of URLs (unique example set)
  const domainKwExamples = new Map<string, string[]>();
  for (const r of rows) {
    const labels = extractDomainLabels(r.domain);
    const seenInRow = new Set<string>();
    for (const label of labels) {
      for (const ng of extractNgrams(label, NGRAM_MIN, NGRAM_MAX)) {
        if (STOP_WORDS.has(ng)) continue;
        if (seenInRow.has(ng)) continue;
        seenInRow.add(ng);
        if (!domainKwCounts.has(ng)) domainKwCounts.set(ng, new Set());
        domainKwCounts.get(ng)!.add(r.url);
        const ex = domainKwExamples.get(ng) ?? [];
        if (ex.length < EXAMPLES_PER_PATTERN) ex.push(r.url);
        domainKwExamples.set(ng, ex);
      }
    }
  }
  const domainKeywords: Candidate[] = [];
  for (const [pattern, urls] of domainKwCounts.entries()) {
    if (urls.size >= MIN_OCCURRENCES_DOMAIN) {
      domainKeywords.push({
        pattern,
        occurrences: urls.size,
        examples: domainKwExamples.get(pattern) ?? [],
      });
    }
  }

  // ─── 2. path_prefix ───
  const pathCounts = new Map<string, { urls: Set<string>; examples: string[] }>();
  for (const r of rows) {
    try {
      const u = new URL(r.url);
      const seg = u.pathname.split('/').filter(Boolean)[0];
      if (!seg) continue;
      const key = '/' + seg.toLowerCase();
      if (!pathCounts.has(key)) pathCounts.set(key, { urls: new Set(), examples: [] });
      const entry = pathCounts.get(key)!;
      entry.urls.add(r.url);
      if (entry.examples.length < EXAMPLES_PER_PATTERN) entry.examples.push(r.url);
    } catch { /* ignore */ }
  }
  const pathPrefixes: Candidate[] = [];
  for (const [pattern, { urls, examples }] of pathCounts.entries()) {
    if (urls.size >= MIN_OCCURRENCES_PATH) {
      pathPrefixes.push({ pattern, occurrences: urls.size, examples });
    }
  }

  // ─── 3. tld_abuse ───
  const tldCounts = new Map<string, { urls: Set<string>; examples: string[] }>();
  for (const r of rows) {
    const parts = r.domain.split('.');
    if (parts.length < 2) continue;
    const tld = '.' + parts[parts.length - 1].toLowerCase();
    if (!tldCounts.has(tld)) tldCounts.set(tld, { urls: new Set(), examples: [] });
    const entry = tldCounts.get(tld)!;
    entry.urls.add(r.url);
    if (entry.examples.length < EXAMPLES_PER_PATTERN) entry.examples.push(r.url);
  }
  const tldAbuse: Candidate[] = [];
  for (const [pattern, { urls, examples }] of tldCounts.entries()) {
    if (urls.size >= MIN_OCCURRENCES_TLD) {
      tldAbuse.push({ pattern, occurrences: urls.size, examples });
    }
  }

  // ─── 4. subdomain ───
  const subCounts = new Map<string, { urls: Set<string>; examples: string[] }>();
  for (const r of rows) {
    const parts = r.domain.toLowerCase().split('.');
    if (parts.length < 3) continue; // サブドメインが存在しない
    // 先頭〜2番目まで（TLDとeTLD+1を除く全サブドメインラベル）
    const subLabels = parts.slice(0, parts.length - 2);
    for (const label of subLabels) {
      if (!label || label.length < 3) continue;
      if (STOP_WORDS.has(label)) continue;
      if (!subCounts.has(label)) subCounts.set(label, { urls: new Set(), examples: [] });
      const entry = subCounts.get(label)!;
      entry.urls.add(r.url);
      if (entry.examples.length < EXAMPLES_PER_PATTERN) entry.examples.push(r.url);
    }
  }
  const subdomains: Candidate[] = [];
  for (const [pattern, { urls, examples }] of subCounts.entries()) {
    if (urls.size >= MIN_OCCURRENCES_SUBDOMAIN) {
      subdomains.push({ pattern, occurrences: urls.size, examples });
    }
  }

  // ─── 上位N件に絞って upsert ───
  const now = new Date();
  const topDomain = domainKeywords.sort((a, b) => b.occurrences - a.occurrences).slice(0, MAX_PATTERNS_PER_TYPE);
  const topPath = pathPrefixes.sort((a, b) => b.occurrences - a.occurrences).slice(0, MAX_PATTERNS_PER_TYPE);
  const topTld = tldAbuse.sort((a, b) => b.occurrences - a.occurrences).slice(0, MAX_PATTERNS_PER_TYPE);
  const topSub = subdomains.sort((a, b) => b.occurrences - a.occurrences).slice(0, MAX_PATTERNS_PER_TYPE);

  async function upsertBucket(patternType: string, candidates: Candidate[]) {
    for (const c of candidates) {
      // precision: occurrences/total（この比率が高いほどフィッシング特有）
      const precision = Math.min(1, c.occurrences / total);
      await prisma.jpcertLearnedPattern.upsert({
        where: { patternType_pattern: { patternType, pattern: c.pattern } },
        create: {
          patternType,
          pattern: c.pattern,
          occurrences: c.occurrences,
          precision,
          examples: JSON.stringify(c.examples),
          lastSeen: now,
        },
        update: {
          occurrences: c.occurrences,
          precision,
          examples: JSON.stringify(c.examples),
          lastSeen: now,
        },
      });
    }
  }

  await upsertBucket('domain_keyword', topDomain);
  await upsertBucket('path_prefix', topPath);
  await upsertBucket('tld_abuse', topTld);
  await upsertBucket('subdomain', topSub);

  // 古いパターン（今回の実行で更新されなかったもの）を論理的に削除
  // -> 削除せず lastSeen が古いことで鮮度を確認できる仕組みとする
  // 将来: 3回連続で出現しないパターンは削除する運用も可

  console.log(
    `[PatternLearner] examined=${total} ` +
    `domain=${topDomain.length} path=${topPath.length} tld=${topTld.length} sub=${topSub.length}`,
  );

  return {
    domainKeywords: topDomain.length,
    pathPrefixes: topPath.length,
    tldAbuse: topTld.length,
    subdomains: topSub.length,
    totalExamined: total,
  };
}

// ────────────── マッチング（スコアラ等から利用） ──────────────

export interface PatternMatchResult {
  matched: boolean;
  score: number; // 0-30
  matchedPatterns: { type: string; pattern: string; precision: number }[];
}

/**
 * ドメイン/URLに対して学習済みパターンを適用し、一致数と合計スコアを返す。
 * - domain_keyword: ドメインラベル内に含まれるか
 * - subdomain:      サブドメインに含まれるか
 * - tld_abuse:      TLDが一致するか
 * - path_prefix:    URLの最初のパスセグメントが一致するか
 *
 * スコアは precision の累積（最大30点にクランプ）。
 */
export async function matchLearnedPatterns(opts: {
  domain: string;
  url?: string | null;
}): Promise<PatternMatchResult> {
  const domain = opts.domain.toLowerCase();
  const patterns = await prisma.jpcertLearnedPattern.findMany({
    where: { precision: { gte: 0.001 } }, // ノイズ除去
  });

  const matched: { type: string; pattern: string; precision: number }[] = [];
  let rawScore = 0;

  const parts = domain.split('.');
  const tld = parts.length >= 2 ? '.' + parts[parts.length - 1] : '';
  const labels = parts.slice(0, -1);
  const subLabels = parts.length >= 3 ? parts.slice(0, parts.length - 2) : [];
  let pathSeg: string | null = null;
  if (opts.url) {
    try {
      const u = new URL(opts.url);
      const seg = u.pathname.split('/').filter(Boolean)[0];
      if (seg) pathSeg = '/' + seg.toLowerCase();
    } catch { /* ignore */ }
  }

  for (const p of patterns) {
    let hit = false;
    if (p.patternType === 'domain_keyword') {
      hit = labels.some((l) => l.includes(p.pattern));
    } else if (p.patternType === 'subdomain') {
      hit = subLabels.includes(p.pattern);
    } else if (p.patternType === 'tld_abuse') {
      hit = tld === p.pattern;
    } else if (p.patternType === 'path_prefix') {
      hit = pathSeg === p.pattern;
    }
    if (hit) {
      matched.push({ type: p.patternType, pattern: p.pattern, precision: p.precision });
      rawScore += p.precision * 100; // precisionベースの重み
    }
  }

  // 0-30にクランプ
  const score = Math.min(30, Math.round(rawScore));

  return {
    matched: matched.length > 0,
    score,
    matchedPatterns: matched.slice(0, 5), // 表示用に上位5件まで
  };
}
