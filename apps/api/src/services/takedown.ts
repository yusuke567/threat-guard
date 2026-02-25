import { prisma } from '../lib/prisma.js';

/**
 * Generate a takedown request template
 * Uses Claude API if ANTHROPIC_API_KEY is set, otherwise uses a rule-based template
 */
export async function generateTakedownTemplate(
  detectedDomainId: string
): Promise<{ id: string; template: string }> {
  const domain = await prisma.detectedDomain.findUniqueOrThrow({
    where: { id: detectedDomainId },
    include: {
      brand: { include: { organization: true } },
      analyses: { orderBy: { analyzedAt: 'desc' }, take: 1 },
    },
  });

  const analysis = domain.analyses[0];
  const whois = domain.whoisData ? JSON.parse(domain.whoisData) : {};
  const registrar = whois?.registrar || 'Unknown Registrar';

  let template: string;

  if (process.env.ANTHROPIC_API_KEY) {
    // Use Claude API
    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    const anthropic = new Anthropic();

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

    template = response.content[0].type === 'text' ? response.content[0].text : '';
  } else {
    // Rule-based fallback template
    const categoryDesc = analysis?.category === 'phishing'
      ? 'phishing activity targeting our customers'
      : analysis?.category === 'brand_abuse'
        ? 'unauthorized use of our brand identity'
        : 'suspected brand impersonation';
    const date = new Date().toISOString().split('T')[0];
    const deadline = new Date(Date.now() + 72 * 3600 * 1000).toISOString().split('T')[0];

    template = `Subject: Abuse Report / Takedown Request — ${domain.domain}

Dear Abuse Department,

I am writing on behalf of ${domain.brand.organization.name} ("${domain.brand.name}") to report ${categoryDesc} associated with the domain ${domain.domain}, which is registered through your services.

1. BRAND INFORMATION
   - Brand: ${domain.brand.name}
   - Legitimate Domain: ${domain.brand.domain}
   - Organization: ${domain.brand.organization.name}

2. INFRINGING DOMAIN
   - Domain: ${domain.domain}
   - First Detected: ${domain.firstSeen.toISOString().split('T')[0]}
   - Threat Type: ${analysis?.category || 'brand impersonation'}
   - Analysis: ${analysis?.reasoning || 'This domain closely resembles our legitimate brand domain and is being used in a manner that misleads consumers.'}

3. BASIS FOR COMPLAINT
   This domain infringes upon our registered trademark and is being used for ${categoryDesc}. This constitutes a violation of:
   - ICANN Registrar Accreditation Agreement (Section 3.18)
   - Uniform Domain-Name Dispute-Resolution Policy (UDRP)
   - Your Registrar's Acceptable Use Policy
   - Anti-Phishing Working Group (APWG) best practices

4. REQUESTED ACTION
   We request that you immediately:
   a) Suspend the domain ${domain.domain}
   b) Preserve all associated registration and hosting records
   c) Provide any available registrant information

5. DEADLINE
   We request a response and action within 72 hours (by ${deadline}).

We appreciate your prompt attention to this matter. Please do not hesitate to contact us if you require additional evidence or information.

Sincerely,
${domain.brand.organization.name}
Brand Protection Team
Date: ${date}`;
  }

  // Save the takedown request
  const takedown = await prisma.takedownRequest.create({
    data: {
      detectedDomainId,
      registrar,
      template,
      status: 'draft',
    },
  });

  return { id: takedown.id, template };
}
