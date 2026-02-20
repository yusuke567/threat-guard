import dns from 'node:dns/promises';
import { prisma } from '../lib/prisma.js';

// Homoglyph mapping: visually similar characters
const HOMOGLYPHS: Record<string, string[]> = {
  a: ['à', 'á', 'â', 'ã', 'ä', 'å', 'ɑ', 'а'],
  b: ['d', 'ƀ', 'ɓ', 'ь'],
  c: ['ç', 'ć', 'ĉ', 'с'],
  d: ['b', 'ԁ', 'ɗ'],
  e: ['è', 'é', 'ê', 'ë', 'ε', 'е'],
  g: ['q', 'ɡ', 'ɢ'],
  h: ['ĥ', 'ħ', 'н'],
  i: ['1', 'l', '|', 'í', 'ì', 'î', 'ï', 'і'],
  k: ['ĸ', 'κ', 'к'],
  l: ['1', 'i', '|', 'ĺ', 'ľ'],
  m: ['n', 'rn', 'ɱ'],
  n: ['m', 'ñ', 'ń', 'п'],
  o: ['0', 'ò', 'ó', 'ô', 'õ', 'ö', 'ο', 'о'],
  p: ['ρ', 'р'],
  q: ['g', 'ɋ'],
  r: ['ŕ', 'ř', 'г'],
  s: ['5', '$', 'ś', 'ş', 'ѕ'],
  t: ['ţ', 'ť', 'т'],
  u: ['ù', 'ú', 'û', 'ü', 'υ', 'ц'],
  v: ['ν', 'ѵ'],
  w: ['vv', 'ω', 'ш'],
  x: ['×', 'х'],
  y: ['ý', 'ÿ', 'у'],
  z: ['ź', 'ż', 'ž', 'з'],
};

// QWERTY adjacent keys
const ADJACENT_KEYS: Record<string, string[]> = {
  a: ['q', 'w', 's', 'z'],
  b: ['v', 'g', 'h', 'n'],
  c: ['x', 'd', 'f', 'v'],
  d: ['s', 'e', 'r', 'f', 'c', 'x'],
  e: ['w', 's', 'd', 'r'],
  f: ['d', 'r', 't', 'g', 'v', 'c'],
  g: ['f', 't', 'y', 'h', 'b', 'v'],
  h: ['g', 'y', 'u', 'j', 'n', 'b'],
  i: ['u', 'j', 'k', 'o'],
  j: ['h', 'u', 'i', 'k', 'm', 'n'],
  k: ['j', 'i', 'o', 'l', 'm'],
  l: ['k', 'o', 'p'],
  m: ['n', 'j', 'k'],
  n: ['b', 'h', 'j', 'm'],
  o: ['i', 'k', 'l', 'p'],
  p: ['o', 'l'],
  q: ['w', 'a'],
  r: ['e', 'd', 'f', 't'],
  s: ['a', 'w', 'e', 'd', 'x', 'z'],
  t: ['r', 'f', 'g', 'y'],
  u: ['y', 'h', 'j', 'i'],
  v: ['c', 'f', 'g', 'b'],
  w: ['q', 'a', 's', 'e'],
  x: ['z', 's', 'd', 'c'],
  y: ['t', 'g', 'h', 'u'],
  z: ['a', 's', 'x'],
};

const COMMON_TLDS = ['.com', '.net', '.org', '.co', '.io', '.xyz', '.app', '.info', '.biz', '.dev', '.tech', '.online', '.site', '.shop'];

/**
 * Split domain into name and TLD parts
 */
function splitDomain(domain: string): { name: string; tld: string } {
  const parts = domain.split('.');
  if (parts.length < 2) return { name: domain, tld: '' };
  const tld = '.' + parts.slice(1).join('.');
  return { name: parts[0], tld };
}

/**
 * Generate homoglyph variations
 */
export function generateHomoglyphs(domain: string): string[] {
  const { name, tld } = splitDomain(domain);
  const results: string[] = [];

  for (let i = 0; i < name.length; i++) {
    const char = name[i].toLowerCase();
    const replacements = HOMOGLYPHS[char];
    if (replacements) {
      for (const rep of replacements) {
        const variant = name.slice(0, i) + rep + name.slice(i + 1);
        results.push(variant + tld);
      }
    }
  }

  return results;
}

/**
 * Generate typo variations (adjacent key, omission, swap, duplication)
 */
export function generateTypos(domain: string): string[] {
  const { name, tld } = splitDomain(domain);
  const results: string[] = [];

  for (let i = 0; i < name.length; i++) {
    // Adjacent key replacement
    const adjacent = ADJACENT_KEYS[name[i].toLowerCase()];
    if (adjacent) {
      for (const key of adjacent) {
        results.push(name.slice(0, i) + key + name.slice(i + 1) + tld);
      }
    }

    // Character omission
    results.push(name.slice(0, i) + name.slice(i + 1) + tld);

    // Character duplication
    results.push(name.slice(0, i) + name[i] + name[i] + name.slice(i + 1) + tld);

    // Character swap (with next)
    if (i < name.length - 1) {
      const swapped = name.slice(0, i) + name[i + 1] + name[i] + name.slice(i + 2);
      results.push(swapped + tld);
    }
  }

  return results;
}

/**
 * Generate TLD variations
 */
export function generateTLDVariations(domain: string): string[] {
  const { name, tld } = splitDomain(domain);
  return COMMON_TLDS
    .filter((t) => t !== tld)
    .map((t) => name + t);
}

/**
 * Generate hyphen variations
 */
export function generateHyphenVariations(domain: string): string[] {
  const { name, tld } = splitDomain(domain);
  const results: string[] = [];

  // Add hyphens between each pair of characters
  for (let i = 1; i < name.length; i++) {
    results.push(name.slice(0, i) + '-' + name.slice(i) + tld);
  }

  // Remove existing hyphens
  if (name.includes('-')) {
    results.push(name.replace(/-/g, '') + tld);
  }

  return results;
}

/**
 * Generate all domain variations
 */
export function generateAllVariations(domain: string): string[] {
  const all = new Set<string>();

  for (const v of generateHomoglyphs(domain)) all.add(v);
  for (const v of generateTypos(domain)) all.add(v);
  for (const v of generateTLDVariations(domain)) all.add(v);
  for (const v of generateHyphenVariations(domain)) all.add(v);

  // Remove the original domain
  all.delete(domain.toLowerCase());

  return Array.from(all);
}

/**
 * Check if a domain resolves (exists)
 */
export async function checkDomainExists(domain: string): Promise<boolean> {
  try {
    await dns.resolve(domain);
    return true;
  } catch {
    return false;
  }
}

/**
 * Scan all variations for a brand, check DNS, and save to DB
 */
export async function scanDomainVariations(brandId: string): Promise<number> {
  const brand = await prisma.brand.findUniqueOrThrow({
    where: { id: brandId },
  });

  const variations = generateAllVariations(brand.domain);
  let newCount = 0;

  // Process in batches of 10 to avoid DNS rate limiting
  const batchSize = 10;
  for (let i = 0; i < variations.length; i += batchSize) {
    const batch = variations.slice(i, i + batchSize);
    const results = await Promise.allSettled(
      batch.map(async (domain) => {
        const exists = await checkDomainExists(domain);
        return { domain, exists };
      })
    );

    for (const result of results) {
      if (result.status !== 'fulfilled' || !result.value.exists) continue;

      const { domain } = result.value;
      const existing = await prisma.detectedDomain.findFirst({
        where: { brandId, domain },
      });

      if (!existing) {
        await prisma.detectedDomain.create({
          data: {
            brandId,
            domain,
            source: 'domain_generation',
            status: 'new_domain',
          },
        });
        newCount++;
      }
    }
  }

  return newCount;
}
