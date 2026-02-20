import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const WHITELIST_DOMAINS = [
  'coincheck.com', 'coincheck.jp', 'coincheck.co.jp', 'coincheck.co',
  'coincheck.net', 'coincheck.cc', 'coincheck.xyz', 'coincheck.app',
  'coincheck.media', 'coincheck.blog', 'coincheck.tech',
  'coincheckpro.com', 'coinchecknft.jp', 'coincheck-nft.jp',
  'coincheckieo.jp', 'coincheck-ieo.jp',
  'coinchecktech.com', 'coinchecktech.net', 'coinchecktech.org', 'coinchecktech.jp',
  'coincheckgroup.com', 'coincheck-guest.com',
  'resupress.com', 'metaps-alpha.com', 'miime.io', 'cc-secure.com',
  'ext-coincheck.site', 'coincheck-survey.studio.site',
];

async function main() {
  // Get or create org
  let org = await prisma.organization.findFirst({ where: { name: 'Coincheck Inc.' } });
  if (!org) {
    org = await prisma.organization.create({ data: { name: 'Coincheck Inc.' } });
  }

  // Get or create brand
  let brand = await prisma.brand.findFirst({ where: { domain: 'coincheck.com' } });
  if (!brand) {
    brand = await prisma.brand.create({
      data: {
        organizationId: org.id,
        name: 'Coincheck',
        domain: 'coincheck.com',
        keywords: 'coincheck,コインチェック',
        whitelistDomains: WHITELIST_DOMAINS.join(','),
      },
    });
  } else {
    brand = await prisma.brand.update({
      where: { id: brand.id },
      data: { whitelistDomains: WHITELIST_DOMAINS.join(',') },
    });
  }

  console.log('✅ Coincheck brand registered');
  console.log(`   Organization: ${org.name} (${org.id})`);
  console.log(`   Brand: ${brand.name} (${brand.id})`);
  console.log(`   Whitelist: ${WHITELIST_DOMAINS.length} domains`);
  console.log(`   Brand ID: ${brand.id}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
