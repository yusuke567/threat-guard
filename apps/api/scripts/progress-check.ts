/**
 * 再分析の進捗を確認するワンショットスクリプト。
 * 対象ブランドについて現在のステータス分布と、直近の analyses 件数を表示。
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const BRAND_NAMES = ['マネックス証券', 'Coincheck', 'オリパワン'];

async function main() {
  const brands = await prisma.brand.findMany({
    where: { name: { in: BRAND_NAMES } },
    select: { id: true, name: true },
  });

  for (const brand of brands) {
    const statusGroup = await prisma.detectedDomain.groupBy({
      by: ['status'],
      where: { brandId: brand.id },
      _count: true,
    });
    const total = statusGroup.reduce((a, s) => a + s._count, 0);

    // Last 10 minutes analyses for this brand
    const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000);
    const recentAnalyses = await prisma.threatAnalysis.count({
      where: {
        detectedDomain: { brandId: brand.id },
        analyzedAt: { gte: tenMinAgo },
      },
    });
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const hourAnalyses = await prisma.threatAnalysis.count({
      where: {
        detectedDomain: { brandId: brand.id },
        analyzedAt: { gte: oneHourAgo },
      },
    });

    console.log(`\n=== ${brand.name} (total: ${total}) ===`);
    const order = ['new_domain', 'analyzing', 'confirmed_threat', 'takedown_sent', 'resolved', 'false_positive'];
    const byStatus = new Map(statusGroup.map((s) => [s.status, s._count]));
    for (const st of order) {
      const c = byStatus.get(st) ?? 0;
      console.log(`  ${st.padEnd(18)} ${c}`);
    }
    // Unknown statuses
    for (const s of statusGroup) {
      if (!order.includes(s.status)) {
        console.log(`  ${s.status.padEnd(18)} ${s._count}`);
      }
    }
    console.log(`  直近10分の分析: ${recentAnalyses}件 / 直近1時間: ${hourAnalyses}件`);
  }

  // 全体の analyzing 数（他ブランド含む）
  const allAnalyzing = await prisma.detectedDomain.count({ where: { status: 'analyzing' } });
  console.log(`\n[全体] status='analyzing' の件数: ${allAnalyzing}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
