import { PrismaClient } from '@prisma/client';
import { calculateRiskScore } from '../src/services/risk-scorer.js';

const prisma = new PrismaClient();

async function run() {
  const domains = await prisma.detectedDomain.findMany({
    where: { brand: { domain: 'coincheck.com' }, riskScore: null },
  });

  console.log(`Scoring ${domains.length} domains...`);

  for (const domain of domains) {
    try {
      const score = await calculateRiskScore(domain.id);
      console.log(`  ${domain.domain}: ${score}`);
    } catch (e) {
      console.error(`  Error scoring ${domain.domain}:`, e);
    }
  }

  console.log('\n✅ Scoring complete');

  // Show top threats
  const top = await prisma.detectedDomain.findMany({
    where: { brand: { domain: 'coincheck.com' } },
    orderBy: { riskScore: 'desc' },
    take: 10,
  });
  console.log('\nTop 10 threats:');
  for (const t of top) {
    console.log(`  ${t.riskScore}\t${t.domain}\t(${t.source})`);
  }
}

run().catch(console.error).finally(() => prisma.$disconnect());
