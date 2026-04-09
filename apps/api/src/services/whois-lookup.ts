import { getDomain } from 'tldts';
import { prisma } from '../lib/prisma.js';

interface WhoisResult {
  registrar: string;
  abuseEmail: string | null;
  creationDate: string | null;
  expirationDate: string | null;
  nameServers: string[];
  registrantCountry: string | null;
  raw: Record<string, unknown>;
}

/**
 * Extract the registrable domain (e.g., "example.co.jp" from "phishing.example.co.jp")
 * using the Public Suffix List via tldts.
 */
export function extractRegistrableDomain(domain: string): string {
  const result = getDomain(domain);
  // tldts returns null for TLDs themselves or invalid input
  return result ?? domain;
}

/**
 * Fetch WHOIS/RDAP data for a domain via the public RDAP bootstrap service.
 */
async function fetchRdap(domain: string): Promise<WhoisResult> {
  const baseDomain = extractRegistrableDomain(domain);
  const url = `https://rdap.org/domain/${baseDomain}`;

  const res = await fetch(url, {
    headers: { Accept: 'application/rdap+json' },
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    throw new Error(`RDAP returned ${res.status} for ${baseDomain}`);
  }

  const data = await res.json();

  let registrar = 'Unknown';
  let abuseEmail: string | null = null;
  let creationDate: string | null = null;
  let expirationDate: string | null = null;
  let registrantCountry: string | null = null;
  const nameServers: string[] = [];

  // Extract country from vcard adr field
  // vcard adr structure: ["adr", {}, "text", ["", "", street, city, region, postalCode, country]]
  function extractCountryFromVcard(vcardArray: unknown[][]): string | null {
    for (const field of vcardArray) {
      if (field[0] === 'adr' && Array.isArray(field[3])) {
        const country = field[3][6];
        if (typeof country === 'string' && country.trim()) return country.trim();
      }
    }
    return null;
  }

  // Extract registrar from entities with "registrar" role
  if (data.entities) {
    for (const entity of data.entities) {
      const roles: string[] = entity.roles || [];

      // Extract country from registrant entity
      if (roles.includes('registrant') && entity.vcardArray?.[1]) {
        registrantCountry = extractCountryFromVcard(entity.vcardArray[1]);
      }

      if (roles.includes('registrar')) {
        // Registrar name from vcardArray
        if (entity.vcardArray?.[1]) {
          for (const field of entity.vcardArray[1]) {
            if (field[0] === 'fn') registrar = field[3];
          }
        }
        // Registrar name from handle or publicIds fallback
        if (registrar === 'Unknown' && entity.handle) {
          registrar = entity.handle;
        }

        // Abuse email from nested entities
        if (entity.entities) {
          for (const sub of entity.entities) {
            if ((sub.roles || []).includes('abuse') && sub.vcardArray?.[1]) {
              for (const field of sub.vcardArray[1]) {
                if (field[0] === 'email') abuseEmail = field[3];
              }
            }
          }
        }

        // Fallback: country from registrar entity if registrant had none
        if (!registrantCountry && entity.vcardArray?.[1]) {
          registrantCountry = extractCountryFromVcard(entity.vcardArray[1]);
        }
      }

      // Top-level abuse role
      if (roles.includes('abuse') && entity.vcardArray?.[1]) {
        for (const field of entity.vcardArray[1]) {
          if (field[0] === 'email') abuseEmail = field[3];
        }
      }
    }
  }

  // Fallback: abuse contact from remarks
  if (!abuseEmail && data.remarks) {
    for (const remark of data.remarks) {
      const desc = (remark.description || []).join(' ');
      const match = desc.match(/[\w.+-]+@[\w.-]+\.\w+/);
      if (match && desc.toLowerCase().includes('abuse')) {
        abuseEmail = match[0];
      }
    }
  }

  // Extract dates from events
  if (data.events) {
    for (const event of data.events) {
      if (event.eventAction === 'registration') creationDate = event.eventDate;
      if (event.eventAction === 'expiration') expirationDate = event.eventDate;
    }
  }

  // Extract nameservers
  if (data.nameservers) {
    for (const ns of data.nameservers) {
      if (ns.ldhName) nameServers.push(ns.ldhName);
    }
  }

  return { registrar, abuseEmail, creationDate, expirationDate, nameServers, registrantCountry, raw: data };
}

/**
 * Lookup WHOIS/RDAP data for a detected domain and save it to the database.
 * Returns the parsed result, or null if lookup failed.
 */
export async function lookupWhois(
  detectedDomainId: string,
  options?: { force?: boolean; markFailures?: boolean },
): Promise<WhoisResult | null> {
  const domain = await prisma.detectedDomain.findUniqueOrThrow({
    where: { id: detectedDomainId },
  });

  // Skip if whoisData is already populated (unless force refresh)
  if (domain.whoisData && !options?.force) {
    return null;
  }

  try {
    const result = await fetchRdap(domain.domain);

    const whoisJson: Record<string, unknown> = {
      registrar: result.registrar,
      abuseEmail: result.abuseEmail,
      creationDate: result.creationDate,
      expirationDate: result.expirationDate,
      nameServers: result.nameServers,
      registrantCountry: result.registrantCountry,
      fetchedAt: new Date().toISOString(),
      source: 'rdap',
    };

    await prisma.detectedDomain.update({
      where: { id: detectedDomainId },
      data: { whoisData: JSON.stringify(whoisJson) },
    });

    console.log(`[WhoisLookup] ${domain.domain}: registrar=${result.registrar}`);
    return result;
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error(`[WhoisLookup] Failed for ${domain.domain}: ${errMsg}`);

    // Save failure marker so the domain is not retried in next batch
    if (options?.markFailures) {
      const failJson = {
        error: errMsg,
        fetchedAt: new Date().toISOString(),
        source: 'rdap_failed',
      };
      await prisma.detectedDomain.update({
        where: { id: detectedDomainId },
        data: { whoisData: JSON.stringify(failJson) },
      });
    }

    return null;
  }
}

/**
 * Lookup WHOIS/RDAP data for a raw domain string (used by free-diagnosis).
 * Returns the JSON string for storage, or null on failure.
 */
export async function lookupWhoisRaw(domain: string): Promise<string | null> {
  try {
    const result = await fetchRdap(domain);

    const whoisJson: Record<string, unknown> = {
      registrar: result.registrar,
      abuseEmail: result.abuseEmail,
      creationDate: result.creationDate,
      expirationDate: result.expirationDate,
      nameServers: result.nameServers,
      registrantCountry: result.registrantCountry,
      fetchedAt: new Date().toISOString(),
      source: 'rdap',
    };

    console.log(`[WhoisLookup] ${domain}: registrar=${result.registrar}`);
    return JSON.stringify(whoisJson);
  } catch (err) {
    console.error(`[WhoisLookup] Failed for ${domain}:`, err);
    return null;
  }
}
