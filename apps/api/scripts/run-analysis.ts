import { PrismaClient } from '@prisma/client';
import { analyzeThreat } from '../src/services/threat-analyzer.js';
import { calculateRiskScore } from '../src/services/risk-scorer.js';

const prisma = new PrismaClient();

async function run() {
  const domains = await prisma.detectedDomain.findMany({
    where: { status: 'new_domain', brand: { domain: 'coincheck.com' } },
    take: 10,
    orderBy: { createdAt: 'desc' },
  });

  console.log(`Analyzing ${domains.length} domains...`);

  for (const domain of domains) {
    try {
      console.log(`\n--- Analyzing: ${domain.domain} ---`);
      const result = await analyzeThreat(domain.id);
      console.log(`  Category: ${result.category} (confidence: ${result.confidence})`);
      console.log(`  Reasoning: ${result.reasoning}`);
      
      const score = await calculateRiskScore(domain.id);
      console.log(`  Risk Score: ${score}`);
    } catch (e) {
      console.error(`  Error analyzing ${domain.domain}:`, e);
    }
  }

  console.log('\n✅ Analysis complete');
}

run().catch(console.error).finally(() => prisma.$disconnect());
