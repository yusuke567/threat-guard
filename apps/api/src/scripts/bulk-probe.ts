/**
 * Bulk probe all detected domains.
 * Usage: npx tsx apps/api/src/scripts/bulk-probe.ts
 */
import 'dotenv/config';
import { prisma } from '../lib/prisma.js';
import { probeDomain } from '../services/web-prober.js';

const DELAY_MS = 2000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const domains = await prisma.detectedDomain.findMany({
    orderBy: { createdAt: 'desc' },
  });

  console.log(`[BulkProbe] Found ${domains.length} domains to probe`);

  let success = 0;
  let failed = 0;

  for (let i = 0; i < domains.length; i++) {
    const d = domains[i];
    console.log(`[BulkProbe] (${i + 1}/${domains.length}) Probing ${d.domain}...`);

    try {
      const result = await probeDomain(d.id);
      console.log(
        `  → HTTP ${result.httpStatus ?? 'N/A'} | IP: ${result.ip ?? 'N/A'} | DNS: ${result.dnsResolved}${result.error ? ` | Error: ${result.error}` : ''}`
      );
      success++;
    } catch (err: any) {
      console.error(`  ✗ Failed: ${err.message}`);
      failed++;
    }

    if (i < domains.length - 1) {
      await sleep(DELAY_MS);
    }
  }

  console.log(`\n[BulkProbe] Complete: ${success} success, ${failed} failed out of ${domains.length}`);
  process.exit(0);
}

main().catch((err) => {
  console.error('[BulkProbe] Fatal error:', err);
  process.exit(1);
});
