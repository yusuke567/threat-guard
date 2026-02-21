import { exec } from 'child_process';
import { promisify } from 'util';
import { prisma } from '../lib/prisma.js';

const execAsync = promisify(exec);

interface AbuseContact {
  registrar: string;
  abuseEmail: string | null;
  source: 'whois_data' | 'whois_lookup' | 'none';
}

/**
 * Extract abuse email from stored WHOIS data
 */
function extractFromWhoisData(whoisData: string | null): { registrar: string; abuseEmail: string | null } {
  if (!whoisData) return { registrar: 'Unknown', abuseEmail: null };

  try {
    const parsed = JSON.parse(whoisData);
    // Common WHOIS JSON structures
    const registrar = parsed.registrar || parsed.Registrar || parsed.registrar_name || 'Unknown';
    const abuseEmail =
      parsed.abuse_email ||
      parsed.abuseEmail ||
      parsed['Registrar Abuse Contact Email'] ||
      parsed.registrar_abuse_contact_email ||
      null;
    return { registrar: String(registrar), abuseEmail };
  } catch {
    // Try parsing as raw WHOIS text
    return extractFromWhoisText(whoisData);
  }
}

/**
 * Extract abuse email from raw WHOIS text output
 */
function extractFromWhoisText(text: string): { registrar: string; abuseEmail: string | null } {
  let registrar = 'Unknown';
  let abuseEmail: string | null = null;

  const lines = text.split('\n');
  for (const line of lines) {
    const lower = line.toLowerCase();
    if (lower.includes('registrar:') && registrar === 'Unknown') {
      registrar = line.split(':').slice(1).join(':').trim();
    }
    if (lower.includes('abuse') && lower.includes('email')) {
      const match = line.match(/[\w.+-]+@[\w.-]+\.\w+/);
      if (match) abuseEmail = match[0];
    }
    if (lower.includes('registrar abuse contact email:')) {
      const match = line.match(/[\w.+-]+@[\w.-]+\.\w+/);
      if (match) abuseEmail = match[0];
    }
  }

  return { registrar, abuseEmail };
}

/**
 * Live WHOIS lookup for a domain
 */
async function liveWhoisLookup(domain: string): Promise<string | null> {
  try {
    const { stdout } = await execAsync(`whois ${domain}`, { timeout: 15000 });
    return stdout;
  } catch {
    return null;
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
  const stored = extractFromWhoisData(domain.whoisData);
  if (stored.abuseEmail) {
    return { ...stored, source: 'whois_data' };
  }

  // 2. Fallback: live WHOIS lookup
  const whoisText = await liveWhoisLookup(domain.domain);
  if (whoisText) {
    const live = extractFromWhoisText(whoisText);

    // Update stored WHOIS data if we got new info
    if (!domain.whoisData) {
      await prisma.detectedDomain.update({
        where: { id: detectedDomainId },
        data: { whoisData: whoisText.slice(0, 10000) },
      });
    }

    if (live.abuseEmail) {
      return { ...live, source: 'whois_lookup' };
    }
    if (live.registrar !== 'Unknown') {
      return { registrar: live.registrar, abuseEmail: null, source: 'whois_lookup' };
    }
  }

  return { registrar: stored.registrar, abuseEmail: null, source: 'none' };
}
