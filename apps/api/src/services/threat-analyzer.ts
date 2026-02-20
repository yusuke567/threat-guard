import { anthropic } from '../lib/anthropic.js';
import { prisma } from '../lib/prisma.js';
import type { ThreatCategory } from '@brand-shield/shared';

interface AnalysisResult {
  category: ThreatCategory;
  confidence: number;
  reasoning: string;
}

/**
 * Analyze a detected domain using Claude API for threat classification
 */
export async function analyzeThreat(
  detectedDomainId: string
): Promise<AnalysisResult> {
  const detectedDomain = await prisma.detectedDomain.findUniqueOrThrow({
    where: { id: detectedDomainId },
    include: { brand: true },
  });

  // Update status to analyzing
  await prisma.detectedDomain.update({
    where: { id: detectedDomainId },
    data: { status: 'analyzing' },
  });

  const prompt = `You are a brand protection specialist. Analyze the following detected domain for potential brand impersonation or abuse.

**Legitimate Brand:**
- Name: ${detectedDomain.brand.name}
- Domain: ${detectedDomain.brand.domain}
- Keywords: ${detectedDomain.brand.keywords.join(', ') || 'none'}

**Detected Domain:**
- Domain: ${detectedDomain.domain}
- First Seen: ${detectedDomain.firstSeen.toISOString()}
- WHOIS Data: ${detectedDomain.whoisData ? JSON.stringify(detectedDomain.whoisData) : 'Not available'}
- SSL Info: ${detectedDomain.sslInfo ? JSON.stringify(detectedDomain.sslInfo) : 'Not available'}

Classify this domain into one of these categories:
- **phishing**: Actively attempting to steal credentials or personal information by impersonating the brand
- **brand_abuse**: Using the brand name/identity without authorization (but not phishing)
- **parked**: Domain is registered but not actively used (parked page, for sale, etc.)
- **legitimate**: Legitimately associated with the brand or not a threat
- **unknown**: Cannot determine with available information

Respond in JSON format:
{
  "category": "phishing|brand_abuse|parked|legitimate|unknown",
  "confidence": 0.0-1.0,
  "reasoning": "Brief explanation of your analysis"
}`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';

  let result: AnalysisResult;
  try {
    // Extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON in response');
    const parsed = JSON.parse(jsonMatch[0]);
    result = {
      category: parsed.category as ThreatCategory,
      confidence: Math.min(1, Math.max(0, parsed.confidence)),
      reasoning: parsed.reasoning,
    };
  } catch {
    result = {
      category: 'unknown',
      confidence: 0,
      reasoning: `Failed to parse AI response: ${text.slice(0, 200)}`,
    };
  }

  // Save analysis
  await prisma.threatAnalysis.create({
    data: {
      detectedDomainId,
      category: result.category,
      confidence: result.confidence,
      reasoning: result.reasoning,
      rawResponse: response as unknown as Record<string, unknown>,
    },
  });

  // Update domain status based on analysis
  const newStatus =
    result.category === 'phishing' || result.category === 'brand_abuse'
      ? 'confirmed_threat'
      : result.category === 'legitimate'
        ? 'false_positive'
        : 'new_domain';

  await prisma.detectedDomain.update({
    where: { id: detectedDomainId },
    data: { status: newStatus },
  });

  return result;
}
