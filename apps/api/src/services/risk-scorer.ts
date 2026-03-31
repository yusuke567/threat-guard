import { prisma } from '../lib/prisma.js';
import { analyzeContent } from './content-analyzer.js';

interface RiskFactors {
  domainSimilarity: number;   // 0-100, weight: 30%
  domainAge: number;          // 0-100, weight: 20%
  sslRisk: number;            // 0-100, weight: 15%
  threatCategory: number;     // 0-100, weight: 25%
  contentSimilarity: number;  // 0-100, weight: 10%
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshtein(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b[i - 1] === a[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Calculate domain similarity score (0-100, higher = more suspicious)
 */
function calculateDomainSimilarity(detected: string, original: string): number {
  const detectedName = detected.split('.')[0].toLowerCase();
  const originalName = original.split('.')[0].toLowerCase();

  const distance = levenshtein(detectedName, originalName);
  const maxLen = Math.max(detectedName.length, originalName.length);

  if (maxLen === 0) return 0;

  // Very similar domains are MORE suspicious
  const similarity = 1 - distance / maxLen;
  // Score: identical=0 (it's the same), very similar=90+, very different=low
  if (similarity >= 0.95) return 95;
  if (similarity >= 0.8) return 80 + (similarity - 0.8) * 100;
  if (similarity >= 0.6) return 50 + (similarity - 0.6) * 150;
  if (similarity >= 0.4) return 20 + (similarity - 0.4) * 150;
  return Math.max(0, similarity * 50);
}

/**
 * Calculate domain age risk (0-100, newer = higher risk)
 */
function calculateDomainAgeRisk(firstSeen: Date): number {
  const daysSinceFirstSeen = (Date.now() - firstSeen.getTime()) / (1000 * 60 * 60 * 24);

  if (daysSinceFirstSeen < 1) return 100;
  if (daysSinceFirstSeen < 7) return 90;
  if (daysSinceFirstSeen < 30) return 70;
  if (daysSinceFirstSeen < 90) return 50;
  if (daysSinceFirstSeen < 365) return 30;
  return 10;
}

/**
 * Calculate SSL risk (0-100)
 */
function calculateSSLRisk(sslInfo: Record<string, unknown> | null): number {
  if (!sslInfo) return 70; // No SSL info = suspicious

  const issuer = String(sslInfo.issuer || '').toLowerCase();

  if (issuer.includes("let's encrypt") || issuer.includes('letsencrypt')) return 60;
  if (issuer.includes('self-signed') || issuer.includes('self signed')) return 90;
  if (!issuer) return 70;
  return 20; // Known CA
}

/**
 * Map threat category to risk score
 */
function categoryToRisk(category: string | null): number {
  switch (category) {
    case 'phishing': return 100;
    case 'brand_abuse': return 75;
    case 'parked': return 40;
    case 'unknown': return 50;
    case 'legitimate': return 5;
    default: return 50;
  }
}

/**
 * Get content analysis score, falling back to 50 if no probe data available.
 */
async function getContentScore(detectedDomainId: string): Promise<number> {
  try {
    const result = await analyzeContent(detectedDomainId);
    return result.contentRiskScore;
  } catch {
    return 50; // Default when no probe data available
  }
}

/**
 * Calculate overall risk score for a detected domain
 */
export async function calculateRiskScore(detectedDomainId: string): Promise<number> {
  const domain = await prisma.detectedDomain.findUniqueOrThrow({
    where: { id: detectedDomainId },
    include: {
      brand: true,
      analyses: { orderBy: { analyzedAt: 'desc' }, take: 1 },
    },
  });

  const latestAnalysis = domain.analyses[0] ?? null;

  const sslData = domain.sslInfo ? JSON.parse(domain.sslInfo) : null;
  const factors: RiskFactors = {
    domainSimilarity: calculateDomainSimilarity(domain.domain, domain.brand.domain),
    domainAge: calculateDomainAgeRisk(domain.firstSeen),
    sslRisk: calculateSSLRisk(sslData),
    threatCategory: categoryToRisk(latestAnalysis?.category ?? null),
    contentSimilarity: await getContentScore(detectedDomainId),
  };

  const score = Math.round(
    factors.domainSimilarity * 0.3 +
    factors.domainAge * 0.2 +
    factors.sslRisk * 0.15 +
    factors.threatCategory * 0.25 +
    factors.contentSimilarity * 0.1
  );

  // User report boost: if this domain was reported by users, increase score
  const patternMatch = await prisma.phishingPattern.findFirst({
    where: { brandId: domain.brandId, domain: domain.domain, status: { not: 'archived' } },
  });
  const userReportBoost = patternMatch ? 15 : 0;
  const victimBoost = (patternMatch?.victimCount ?? 0) > 0 ? 10 : 0;

  // グローバル検知ルールによるブースト（他社で登録されたフィッシング手口も反映）
  const globalRule = await prisma.globalDetectionRule.findUnique({
    where: { domain: domain.domain },
  });
  const globalRuleBoost = globalRule ? 20 : 0;
  const globalVictimBoost = (globalRule?.victimCount ?? 0) > 0 ? 10 : 0;

  const finalScore = Math.min(100, Math.max(0, score + userReportBoost + victimBoost + globalRuleBoost + globalVictimBoost));

  // Update the domain's risk score
  await prisma.detectedDomain.update({
    where: { id: detectedDomainId },
    data: { riskScore: finalScore },
  });

  return finalScore;
}
