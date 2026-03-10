import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const brands = await prisma.brand.findMany();
  let total = 0;

  for (const brand of brands) {
    const domains: string[] = [];

    // Primary domain
    if (brand.domain) {
      domains.push(brand.domain);
    }

    // Whitelist domains
    if (brand.whitelistDomains) {
      const wl = brand.whitelistDomains.split(',').map((d) => d.trim().toLowerCase()).filter(Boolean);
      domains.push(...wl);
    }

    const unique = [...new Set(domains)];

    for (const domain of unique) {
      const type = domain === brand.domain ? 'primary' : 'owned';
      try {
        await prisma.brandDomain.upsert({
          where: { brandId_domain: { brandId: brand.id, domain } },
          update: { type },
          create: { brandId: brand.id, domain, type },
        });
        total++;
      } catch (e) {
        console.error(`Failed for ${brand.name} / ${domain}:`, e);
      }
    }
  }

  console.log(`Migrated ${total} domains for ${brands.length} brands`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
