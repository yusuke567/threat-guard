import { prisma } from '../lib/prisma.js';

interface CTLogEntry {
  issuer_ca_id: number;
  issuer_name: string;
  common_name: string;
  name_value: string;
  id: number;
  entry_timestamp: string;
  not_before: string;
  not_after: string;
  serial_number: string;
}

/**
 * Fetch Certificate Transparency logs from crt.sh for a given query
 */
export async function fetchCTLogs(query: string): Promise<CTLogEntry[]> {
  const url = `https://crt.sh/?q=${encodeURIComponent(`%${query}%`)}&output=json`;

  const response = await fetch(url, {
    headers: { 'User-Agent': 'BrandShield/0.1' },
    signal: AbortSignal.timeout(30000),
  });

  if (!response.ok) {
    throw new Error(`crt.sh API error: ${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<CTLogEntry[]>;
}

/**
 * Extract unique domains from CT log entries
 */
function extractDomains(entries: CTLogEntry[]): string[] {
  const domains = new Set<string>();

  for (const entry of entries) {
    // name_value can contain multiple domains separated by newlines
    const names = entry.name_value.split('\n');
    for (const name of names) {
      const clean = name.trim().toLowerCase().replace(/^\*\./, '');
      if (clean && clean.includes('.')) {
        domains.add(clean);
      }
    }
  }

  return Array.from(domains);
}

/**
 * Monitor CT logs for a brand and save new detections
 */
export async function monitorBrand(brandId: string): Promise<number> {
  const brand = await prisma.brand.findUniqueOrThrow({
    where: { id: brandId },
  });

  const keywords = brand.keywords ? brand.keywords.split(',').map((k: string) => k.trim()).filter(Boolean) : [];
  const searchTerms = [brand.domain, brand.name, ...keywords];
  const allDomains = new Set<string>();

  for (const term of searchTerms) {
    try {
      const entries = await fetchCTLogs(term);
      const domains = extractDomains(entries);
      domains.forEach((d) => allDomains.add(d));
    } catch (error) {
      console.error(`CT log fetch failed for "${term}":`, error);
    }
  }

  // Filter out the brand's own domain and whitelisted domains
  allDomains.delete(brand.domain.toLowerCase());
  const whitelist = new Set(
    (brand.whitelistDomains || '').split(',').map((d: string) => d.trim().toLowerCase()).filter(Boolean)
  );
  for (const d of whitelist) allDomains.delete(d);

  let newCount = 0;

  for (const domain of allDomains) {
    const existing = await prisma.detectedDomain.findFirst({
      where: { brandId, domain },
    });

    if (existing) {
      await prisma.detectedDomain.update({
        where: { id: existing.id },
        data: { lastSeen: new Date() },
      });
    } else {
      await prisma.detectedDomain.create({
        data: {
          brandId,
          domain,
          source: 'ct_monitor',
          status: 'new_domain',
        },
      });
      newCount++;
    }
  }

  return newCount;
}
