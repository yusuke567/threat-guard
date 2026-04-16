/**
 * Reset DetectedDomain rows stuck in status='analyzing' back to 'new_domain'
 * so the scheduler will re-analyze them on the next run.
 *
 * Background: analyzeThreat sets status='analyzing' before calling Claude API.
 * If the API call threw (rate limit, timeout, quota), status was never restored,
 * and the scheduler's query (where status='new_domain') skipped them forever.
 * The bug is now fixed in services/threat-analyzer.ts; this script cleans up
 * the rows that were orphaned before the fix shipped.
 *
 * Usage:
 *   npx tsx scripts/reset-stuck-analyzing.ts            # dry-run (default)
 *   npx tsx scripts/reset-stuck-analyzing.ts --apply    # actually update
 *   npx tsx scripts/reset-stuck-analyzing.ts --apply --brand <brandId>
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Only reset rows older than this threshold, so a domain currently mid-analysis
// in a live scheduler run doesn't get yanked out from under it.
const STALE_MINUTES = 30;

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes('--apply');
  const brandIdIdx = args.indexOf('--brand');
  const brandId = brandIdIdx >= 0 ? args[brandIdIdx + 1] : undefined;

  const staleBefore = new Date(Date.now() - STALE_MINUTES * 60 * 1000);

  const where = {
    status: 'analyzing',
    updatedAt: { lt: staleBefore },
    ...(brandId ? { brandId } : {}),
  };

  const count = await prisma.detectedDomain.count({ where });

  // Breakdown by brand for visibility
  const byBrand = await prisma.detectedDomain.groupBy({
    by: ['brandId'],
    where,
    _count: true,
  });
  const brandMap = await prisma.brand.findMany({
    where: { id: { in: byBrand.map((b) => b.brandId) } },
    select: { id: true, name: true },
  });
  const brandNameById = new Map(brandMap.map((b) => [b.id, b.name]));

  console.log(`[reset-stuck-analyzing] Found ${count} rows stuck in 'analyzing' older than ${STALE_MINUTES} min`);
  for (const row of byBrand) {
    console.log(`  - ${brandNameById.get(row.brandId) ?? row.brandId}: ${row._count}`);
  }

  if (!apply) {
    console.log('\n[dry-run] Re-run with --apply to actually update. No changes written.');
    return;
  }

  const result = await prisma.detectedDomain.updateMany({
    where,
    data: { status: 'new_domain' },
  });
  console.log(`[reset-stuck-analyzing] Updated ${result.count} rows to status='new_domain'.`);
}

main()
  .catch((err) => {
    console.error('[reset-stuck-analyzing] Failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
