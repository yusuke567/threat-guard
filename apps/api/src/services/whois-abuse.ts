import { prisma } from '../lib/prisma.js';
import { extractRegistrableDomain } from './whois-lookup.js';

interface AbuseContact {
  registrar: string;
  abuseEmail: string | null;
  source: 'whois_data' | 'rdap' | 'none';
}

/**
 * Extract abuse email from stored WHOIS data
 */
function extractFromStoredData(whoisData: string | null): { registrar: string; abuseEmail: string | null } {
  if (!whoisData) return { registrar: 'Unknown', abuseEmail: null };

  try {
    const parsed = JSON.parse(whoisData);
    const registrar = parsed.registrar || parsed.Registrar || parsed.registrar_name || 'Unknown';
    const abuseEmail =
      parsed.abuse_email ||
      parsed.abuseEmail ||
      parsed['Registrar Abuse Contact Email'] ||
      parsed.registrar_abuse_contact_email ||
      null;
    return { registrar: String(registrar), abuseEmail };
  } catch {
    // Raw WHOIS text
    return extractFromWhoisText(whoisData);
  }
}

function extractFromWhoisText(text: string): { registrar: string; abuseEmail: string | null } {
  let registrar = 'Unknown';
  let abuseEmail: string | null = null;

  for (const line of text.split('\n')) {
    const lower = line.toLowerCase();
    if (lower.includes('registrar:') && registrar === 'Unknown') {
      registrar = line.split(':').slice(1).join(':').trim();
    }
    if (lower.includes('registrar abuse contact email:') || (lower.includes('abuse') && lower.includes('email'))) {
      const match = line.match(/[\w.+-]+@[\w.-]+\.\w+/);
      if (match) abuseEmail = match[0];
    }
  }
  return { registrar, abuseEmail };
}

/**
 * RDAP lookup via public RDAP bootstrap (works on any server, no CLI needed)
 */
async function rdapLookup(domain: string): Promise<{ registrar: string; abuseEmail: string | null }> {
  const baseDomain = extractRegistrableDomain(domain);

  const url = `https://rdap.org/domain/${baseDomain}`;
  const res = await fetch(url, {
    headers: { Accept: 'application/rdap+json' },
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) throw new Error(`RDAP returned ${res.status}`);
  const data = await res.json();

  let registrar = 'Unknown';
  let abuseEmail: string | null = null;

  // Extract registrar from entities with "registrar" role
  if (data.entities) {
    for (const entity of data.entities) {
      const roles: string[] = entity.roles || [];
      if (roles.includes('registrar')) {
        // Get registrar name from vcardArray
        if (entity.vcardArray?.[1]) {
          for (const field of entity.vcardArray[1]) {
            if (field[0] === 'fn') registrar = field[3];
          }
        }
        // Get abuse email from nested entities or remarks
        if (entity.entities) {
          for (const sub of entity.entities) {
            if ((sub.roles || []).includes('abuse') && sub.vcardArray?.[1]) {
              for (const field of sub.vcardArray[1]) {
                if (field[0] === 'email') abuseEmail = field[3];
              }
            }
          }
        }
      }
      // Also check top-level abuse role
      if (roles.includes('abuse') && entity.vcardArray?.[1]) {
        for (const field of entity.vcardArray[1]) {
          if (field[0] === 'email') abuseEmail = field[3];
        }
      }
    }
  }

  // Fallback: check remarks for abuse contact
  if (!abuseEmail && data.remarks) {
    for (const remark of data.remarks) {
      const desc = (remark.description || []).join(' ');
      const match = desc.match(/[\w.+-]+@[\w.-]+\.\w+/);
      if (match && desc.toLowerCase().includes('abuse')) {
        abuseEmail = match[0];
      }
    }
  }

  return { registrar, abuseEmail };
}

// ─── IP-based RDAP lookup (hosting provider) ─────────────────────────────────

export interface HostingAbuseContact {
  provider: string;
  abuseEmail: string | null;
  network: string | null;
  source: 'rdap' | 'none';
}

/**
 * RDAP lookup for IP address → hosting provider abuse contact
 */
async function rdapIpLookup(ip: string): Promise<{ provider: string; abuseEmail: string | null; network: string | null }> {
  const url = `https://rdap.org/ip/${ip}`;
  const res = await fetch(url, {
    headers: { Accept: 'application/rdap+json' },
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) throw new Error(`RDAP IP returned ${res.status}`);
  const data = await res.json();

  let provider = data.name || 'Unknown';
  let abuseEmail: string | null = null;
  const network = data.startAddress && data.endAddress
    ? `${data.startAddress} - ${data.endAddress}`
    : null;

  // Extract abuse contact from entities
  if (data.entities) {
    for (const entity of data.entities) {
      const roles: string[] = entity.roles || [];

      // Get provider name from registrant or administrative entity
      if ((roles.includes('registrant') || roles.includes('administrative')) && entity.vcardArray?.[1]) {
        for (const field of entity.vcardArray[1]) {
          if (field[0] === 'fn' && field[3]) provider = field[3];
        }
      }

      // Get abuse email from abuse role entity
      if (roles.includes('abuse') && entity.vcardArray?.[1]) {
        for (const field of entity.vcardArray[1]) {
          if (field[0] === 'email') abuseEmail = field[3];
        }
      }

      // Check nested entities for abuse contact
      if (entity.entities) {
        for (const sub of entity.entities) {
          if ((sub.roles || []).includes('abuse') && sub.vcardArray?.[1]) {
            for (const field of sub.vcardArray[1]) {
              if (field[0] === 'email') abuseEmail = field[3];
            }
          }
        }
      }
    }
  }

  // Fallback: check remarks for abuse contact
  if (!abuseEmail && data.remarks) {
    for (const remark of data.remarks) {
      const desc = (remark.description || []).join(' ');
      const match = desc.match(/[\w.+-]+@[\w.-]+\.\w+/);
      if (match && desc.toLowerCase().includes('abuse')) {
        abuseEmail = match[0];
      }
    }
  }

  return { provider, abuseEmail, network };
}

/**
 * Get hosting provider abuse contact for a detected domain via IP RDAP
 */
export async function getHostingAbuseContacts(detectedDomainId: string): Promise<HostingAbuseContact> {
  const latestProbe = await prisma.webProbe.findFirst({
    where: { detectedDomainId },
    orderBy: { probeAt: 'desc' },
  });

  if (!latestProbe?.ip) {
    return { provider: 'Unknown', abuseEmail: null, network: null, source: 'none' };
  }

  try {
    const result = await rdapIpLookup(latestProbe.ip);
    return { ...result, source: 'rdap' };
  } catch (err) {
    console.error('RDAP IP lookup failed for', latestProbe.ip, err);
    return { provider: 'Unknown', abuseEmail: null, network: null, source: 'none' };
  }
}

/**
 * Get abuse contact for a detected domain
 */
export async function getAbuseContacts(detectedDomainId: string): Promise<AbuseContact> {
  const domain = await prisma.detectedDomain.findUniqueOrThrow({
    where: { id: detectedDomainId },
  });

  // 1. Try stored WHOIS data first
  const stored = extractFromStoredData(domain.whoisData);
  if (stored.abuseEmail) {
    return { ...stored, source: 'whois_data' };
  }

  // 2. Fallback: RDAP lookup (HTTP-based, works anywhere)
  try {
    const rdap = await rdapLookup(domain.domain);
    if (rdap.abuseEmail || rdap.registrar !== 'Unknown') {
      return {
        registrar: rdap.registrar !== 'Unknown' ? rdap.registrar : stored.registrar,
        abuseEmail: rdap.abuseEmail,
        source: 'rdap',
      };
    }
  } catch (err) {
    console.error('RDAP lookup failed for', domain.domain, err);
  }

  return { registrar: stored.registrar, abuseEmail: null, source: 'none' };
}
