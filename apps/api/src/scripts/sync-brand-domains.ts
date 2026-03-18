/**
 * One-time migration script: sync Brand.whitelistDomains → BrandDomain table
 *
 * For each brand, reads whitelistDomains (comma-separated text field),
 * and ensures every domain exists in the BrandDomain table.
 * The brand's primary domain gets type="primary", others get type="owned".
 *
 * Usage: npx tsx apps/api/src/scripts/sync-brand-domains.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const brands = await prisma.brand.findMany({
    include: { brandDomains: true },
  });

  console.log(`Found ${brands.length} brands to sync.\n`);

  let totalCreated = 0;
  let totalSkipped = 0;

  for (const brand of brands) {
    const existingDomains = new Set(brand.brandDomains.map((bd) => bd.domain.toLowerCase()));

    // Parse whitelistDomains
    const whitelistDomains = (brand.whitelistDomains || '')
      .split(',')
      .map((d) => d.trim().toLowerCase())
      .filter((d) => d.length > 0 && d.includes('.'));

    // Also include the brand's primary domain
    const primaryDomain = brand.domain.toLowerCase();
    const allDomains = new Set([primaryDomain, ...whitelistDomains]);

    let created = 0;
    let skipped = 0;

    for (const domain of allDomains) {
      if (existingDomains.has(domain)) {
        skipped++;
        continue;
      }

      const type = domain === primaryDomain ? 'primary' : 'owned';

      await prisma.brandDomain.create({
        data: {
          brandId: brand.id,
          domain,
          type,
        },
      });
      created++;
    }

    // Ensure primary domain has type="primary" in BrandDomain
    const existingPrimary = brand.brandDomains.find((bd) => bd.domain.toLowerCase() === primaryDomain);
    if (existingPrimary && existingPrimary.type !== 'primary') {
      await prisma.brandDomain.update({
        where: { id: existingPrimary.id },
        data: { type: 'primary' },
      });
      console.log(`  [${brand.name}] Fixed primary type for ${primaryDomain}`);
    }

    totalCreated += created;
    totalSkipped += skipped;

    if (created > 0) {
      console.log(`✅ ${brand.name}: ${created} domains added, ${skipped} already existed`);
    } else {
      console.log(`⏭️  ${brand.name}: all ${skipped} domains already in sync`);
    }
  }

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`Total: ${totalCreated} created, ${totalSkipped} skipped`);
  console.log(`Done.`);
}

main()
  .catch((err) => {
    console.error('Sync failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
