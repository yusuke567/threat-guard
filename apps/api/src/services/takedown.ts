import { anthropic } from '../lib/anthropic.js';
import { prisma } from '../lib/prisma.js';

/**
 * Generate a takedown request template using Claude API
 */
export async function generateTakedownTemplate(
  detectedDomainId: string
): Promise<string> {
  const domain = await prisma.detectedDomain.findUniqueOrThrow({
    where: { id: detectedDomainId },
    include: {
      brand: { include: { organization: true } },
      analyses: { orderBy: { analyzedAt: 'desc' }, take: 1 },
    },
  });

  const analysis = domain.analyses[0];
  const registrar = (domain.whoisData as Record<string, unknown>)?.registrar as string || 'Unknown Registrar';

  const prompt = `You are a brand protection legal specialist. Generate a professional takedown request letter for the following case.

**Brand Owner:**
- Organization: ${domain.brand.organization.name}
- Brand: ${domain.brand.name}
- Legitimate Domain: ${domain.brand.domain}

**Infringing Domain:**
- Domain: ${domain.domain}
- Registrar: ${registrar}
- First Detected: ${domain.firstSeen.toISOString()}
- Threat Category: ${analysis?.category || 'suspected brand abuse'}
- Analysis: ${analysis?.reasoning || 'Domain closely resembles the legitimate brand domain'}

**Instructions:**
Generate a formal takedown request letter in English that:
1. Identifies the brand owner and their rights
2. Describes the infringing domain and the nature of infringement
3. Cites relevant policies (UDRP, registrar AUP, ICANN policies)
4. Requests immediate suspension/transfer of the domain
5. Includes a deadline for response (typically 48-72 hours)
6. Is addressed to the registrar's abuse department

Format it as a ready-to-send email.`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2048,
    messages: [{ role: 'user', content: prompt }],
  });

  const template = response.content[0].type === 'text' ? response.content[0].text : '';

  // Save the takedown request
  await prisma.takedownRequest.create({
    data: {
      detectedDomainId,
      registrar,
      template,
      status: 'draft',
    },
  });

  // Update domain status
  await prisma.detectedDomain.update({
    where: { id: detectedDomainId },
    data: { status: 'takedown_sent' },
  });

  return template;
}
