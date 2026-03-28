import { prisma } from '../lib/prisma.js';
import { calculateSimilarity } from './image-similarity.js';
import path from 'node:path';
import fs from 'node:fs/promises';

const DATA_DIR = process.env.DATA_DIR || process.cwd();

export interface ContentAnalysisResult {
  keywordMatches: string[];
  hasLoginForm: boolean;
  hasPasswordField: boolean;
  logoDetected: boolean;
  imageSimilarity: number | null; // 0-1, null if no screenshots to compare
  contentRiskScore: number; // 0-100
}

/**
 * Analyze HTML content for phishing indicators.
 */
export function analyzeHtml(html: string, brandKeywords: string[]): {
  keywordMatches: string[];
  hasLoginForm: boolean;
  hasPasswordField: boolean;
  logoDetected: boolean;
} {
  const lower = html.toLowerCase();

  // Keyword matching
  const keywordMatches = brandKeywords.filter((kw) => {
    const kwLower = kw.toLowerCase().trim();
    return kwLower && lower.includes(kwLower);
  });

  // Login form detection
  const hasLoginForm =
    (lower.includes('<form') && (lower.includes('login') || lower.includes('signin') || lower.includes('sign-in') || lower.includes('log-in'))) ||
    (lower.includes('<form') && lower.includes('type="password"'));

  // Password field detection
  const hasPasswordField = lower.includes('type="password"') || lower.includes("type='password'");

  // Logo image detection (common patterns)
  const logoDetected =
    lower.includes('logo') && (lower.includes('<img') || lower.includes('background-image'));

  return { keywordMatches, hasLoginForm, hasPasswordField, logoDetected };
}

/**
 * Calculate screenshot similarity between a probe screenshot and the brand's official site.
 * Captures official site screenshot if not already cached.
 */
async function getImageSimilarity(
  probeScreenshotPath: string,
  brandDomain: string
): Promise<number | null> {
  // Look for a cached reference screenshot for the brand
  const refDir = path.join(DATA_DIR, 'screenshots', 'reference');
  const refPath = path.join(refDir, `${brandDomain.replace(/[^a-z0-9]/gi, '_')}.png`);

  try {
    await fs.access(refPath);
  } catch {
    // No reference screenshot exists — capture one
    try {
      const { captureScreenshot } = await import('./screenshot.js');
      await fs.mkdir(refDir, { recursive: true });
      console.log(`[ImageSimilarity] Capturing reference screenshot for: ${brandDomain}`);
      const captured = await captureScreenshot(brandDomain);
      console.log(`[ImageSimilarity] Captured screenshot at: ${captured}`);
      await fs.copyFile(captured, refPath);
      console.log(`[ImageSimilarity] Reference saved to: ${refPath}`);
    } catch (err) {
      console.error(`[ImageSimilarity] Failed to capture reference for ${brandDomain}:`, err);
      return null; // Can't capture reference
    }
  }

  try {
    const similarity = await calculateSimilarity(probeScreenshotPath, refPath);
    return similarity;
  } catch {
    return null;
  }
}

/**
 * Run full content analysis for a detected domain using its latest probe.
 */
export async function analyzeContent(detectedDomainId: string): Promise<ContentAnalysisResult> {
  const domain = await prisma.detectedDomain.findUniqueOrThrow({
    where: { id: detectedDomainId },
    include: {
      brand: true,
      webProbes: { orderBy: { probeAt: 'desc' }, take: 1 },
    },
  });

  const latestProbe = domain.webProbes[0];
  const brandKeywords = domain.brand.keywords
    ? domain.brand.keywords.split(',').map((k: string) => k.trim()).filter(Boolean)
    : [domain.brand.name];

  // Default result
  const result: ContentAnalysisResult = {
    keywordMatches: [],
    hasLoginForm: false,
    hasPasswordField: false,
    logoDetected: false,
    imageSimilarity: null,
    contentRiskScore: 50,
  };

  if (!latestProbe) return result;

  // HTML analysis
  if (latestProbe.htmlSnippet) {
    const htmlResult = analyzeHtml(latestProbe.htmlSnippet, brandKeywords);
    result.keywordMatches = htmlResult.keywordMatches;
    result.hasLoginForm = htmlResult.hasLoginForm;
    result.hasPasswordField = htmlResult.hasPasswordField;
    result.logoDetected = htmlResult.logoDetected;
  }

  // Image similarity
  if (latestProbe.screenshotPath) {
    result.imageSimilarity = await getImageSimilarity(
      latestProbe.screenshotPath,
      domain.brand.domain
    );
  }

  // Calculate content risk score (0-100)
  let score = 0;

  // Keyword matches: up to 40 points
  if (result.keywordMatches.length > 0) {
    score += Math.min(40, result.keywordMatches.length * 15);
  }

  // Login form: 25 points
  if (result.hasLoginForm) score += 25;

  // Password field (if not already counted via login form): 20 points
  if (result.hasPasswordField && !result.hasLoginForm) score += 20;

  // Logo detected: 10 points
  if (result.logoDetected) score += 10;

  // Image similarity: up to 25 points (high similarity to brand = suspicious)
  if (result.imageSimilarity !== null) {
    score += Math.round(result.imageSimilarity * 25);
  }

  result.contentRiskScore = Math.min(100, score);

  return result;
}
