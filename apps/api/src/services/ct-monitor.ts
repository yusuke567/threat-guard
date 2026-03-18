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

interface CertSpotterIssuance {
  id: string;
  dns_names: string[];
  not_before: string;
  not_after: string;
}

// ── Retry helper ──

async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries = 3,
): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);

      // Retry on 5xx or 429
      if (response.status >= 500 || response.status === 429) {
        lastError = new Error(`HTTP ${response.status} ${response.statusText}`);
        if (attempt < maxRetries - 1) {
          const delay = Math.min(1000 * 2 ** attempt, 10000); // 1s, 2s, 4s (max 10s)
          await new Promise((r) => setTimeout(r, delay));
          continue;
        }
        throw lastError;
      }

      return response;
    } catch (err) {
      lastError = err as Error;
      if (attempt < maxRetries - 1) {
        const delay = Math.min(1000 * 2 ** attempt, 10000);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }

  throw lastError ?? new Error('fetchWithRetry: all retries exhausted');
}

// ── crt.sh (primary) ──

export async function fetchCTLogs(query: string): Promise<CTLogEntry[]> {
  const url = `https://crt.sh/?q=${encodeURIComponent(`%${query}%`)}&output=json`;

  const response = await fetchWithRetry(url, {
    headers: { 'User-Agent': 'ThreatGuard/0.1' },
    signal: AbortSignal.timeout(30000),
  });

  if (!response.ok) {
    throw new Error(`crt.sh API error: ${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<CTLogEntry[]>;
}

// ── CertSpotter (fallback) ──
// Free: 100 queries/hour, domain-only search (no keyword/brand name search)

async function fetchCertSpotter(domain: string): Promise<string[]> {
  const url = `https://api.certspotter.com/v1/issuances?domain=${encodeURIComponent(domain)}&include_subdomains=true&match_wildcards=true&expand=dns_names`;

  const response = await fetchWithRetry(url, {
    headers: { 'User-Agent': 'ThreatGuard/0.1' },
    signal: AbortSignal.timeout(30000),
  });

  if (!response.ok) {
    throw new Error(`CertSpotter API error: ${response.status} ${response.statusText}`);
  }

  const issuances = (await response.json()) as CertSpotterIssuance[];
  const domains = new Set<string>();

  for (const issuance of issuances) {
    for (const name of issuance.dns_names ?? []) {
      const clean = name.trim().toLowerCase().replace(/^\*\./, '');
      if (clean && clean.includes('.')) {
        domains.add(clean);
      }
    }
  }

  return Array.from(domains);
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
 * Monitor CT logs for a brand and save new detections.
 * Uses crt.sh as primary with retry, falls back to CertSpotter for domain-based queries.
 */
export async function monitorBrand(brandId: string): Promise<number> {
  const brand = await prisma.brand.findUniqueOrThrow({
    where: { id: brandId },
  });

  const keywords = brand.keywords ? brand.keywords.split(',').map((k: string) => k.trim()).filter(Boolean) : [];
  const searchTerms = [brand.domain, brand.name, ...keywords];
  const allDomains = new Set<string>();
  let crtshFailed = 0;

  // Primary: crt.sh (supports keyword/brand name search)
  for (const term of searchTerms) {
    try {
      const entries = await fetchCTLogs(term);
      const domains = extractDomains(entries);
      domains.forEach((d) => allDomains.add(d));
    } catch (error) {
      crtshFailed++;
      console.error(`CT log fetch failed for "${term}":`, error);
    }
  }

  // Fallback: CertSpotter if crt.sh failed for ALL terms
  // CertSpotter only supports domain search (not keyword/brand name)
  if (crtshFailed === searchTerms.length) {
    console.log(`[CT Monitor] crt.sh failed for all ${searchTerms.length} terms, trying CertSpotter fallback for domain: ${brand.domain}`);

    try {
      const domains = await fetchCertSpotter(brand.domain);
      domains.forEach((d) => allDomains.add(d));
      console.log(`[CT Monitor] CertSpotter returned ${domains.length} domains for ${brand.domain}`);
    } catch (error) {
      console.error(`[CT Monitor] CertSpotter fallback also failed for ${brand.domain}:`, error);
    }
  }

  // Filter out the brand's own domain and whitelisted domains
  allDomains.delete(brand.domain.toLowerCase());
  const whitelist: string[] = (brand.whitelistDomains || '').split(',').map((d: string) => d.trim().toLowerCase()).filter(Boolean);
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
