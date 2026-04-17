import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const brand = await prisma.brand.findFirst({ where: { name: 'マネックス証券' } });
  if (!brand) throw new Error('no brand');

  const rows = await prisma.detectedDomain.findMany({
    where: { brandId: brand.id, status: 'analyzing' },
    select: { id: true, domain: true, updatedAt: true },
    orderBy: { updatedAt: 'desc' },
  });

  console.log(`総件数: ${rows.length}`);
  if (rows.length === 0) return;

  // Time bucket by minute
  const buckets = new Map<string, number>();
  for (const r of rows) {
    const k = r.updatedAt.toISOString().slice(0, 16); // YYYY-MM-DDTHH:MM
    buckets.set(k, (buckets.get(k) ?? 0) + 1);
  }
  const sorted = [...buckets.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  console.log('\nupdatedAt 分布 (分単位, 新しい順):');
  for (const [k, c] of sorted.slice(0, 20)) {
    console.log(`  ${k}Z: ${c}件`);
  }
  if (sorted.length > 20) console.log(`  ... 他 ${sorted.length - 20} 分`);

  console.log('\n最新5件:');
  for (const r of rows.slice(0, 5)) {
    console.log(`  ${r.updatedAt.toISOString()} ${r.domain}`);
  }
  console.log('\n最古5件:');
  for (const r of rows.slice(-5)) {
    console.log(`  ${r.updatedAt.toISOString()} ${r.domain}`);
  }
}

main().finally(() => prisma.$disconnect());
