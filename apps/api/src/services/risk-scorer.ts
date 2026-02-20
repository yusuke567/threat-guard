import { prisma } from '../lib/prisma.js';

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

  const factors: RiskFactors = {
    domainSimilarity: calculateDomainSimilarity(domain.domain, domain.brand.domain),
    domainAge: calculateDomainAgeRisk(domain.firstSeen),
    sslRisk: calculateSSLRisk(domain.sslInfo as Record<string, unknown> | null),
    threatCategory: categoryToRisk(latestAnalysis?.category ?? null),
    contentSimilarity: 50, // Default when no screenshot comparison available
  };

  const score = Math.round(
    factors.domainSimilarity * 0.3 +
    factors.domainAge * 0.2 +
    factors.sslRisk * 0.15 +
    factors.threatCategory * 0.25 +
    factors.contentSimilarity * 0.1
  );

  const finalScore = Math.min(100, Math.max(0, score));

  // Update the domain's risk score
  await prisma.detectedDomain.update({
    where: { id: detectedDomainId },
    data: { riskScore: finalScore },
  });

  return finalScore;
}
