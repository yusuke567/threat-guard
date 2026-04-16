/**
 * マネックス証券: user_report由来のドメインを一括で takedown_sent に更新するスクリプト。
 *
 * 対象: source='user_report' かつ status='confirmed_threat' のドメイン（brandDomain=monex.co.jp）
 *
 * 使い方:
 *   npx tsx scripts/bulk-takedown-sent.ts                          # ドライラン（対象一覧を表示）
 *   npx tsx scripts/bulk-takedown-sent.ts --apply                  # 実行
 *   npx tsx scripts/bulk-takedown-sent.ts --brand-domain=example.com --apply  # 別ブランド指定
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface Opts {
  brandDomain: string;
  apply: boolean;
}

function parseArgs(): Opts {
  const opts: Opts = { brandDomain: 'monex.co.jp', apply: false };
  for (const arg of process.argv.slice(2)) {
    if (arg === '--apply') opts.apply = true;
    else if (arg.startsWith('--brand-domain=')) opts.brandDomain = arg.split('=')[1];
  }
  return opts;
}

async function run() {
  const opts = parseArgs();
  console.log(`\n=== bulk-takedown-sent ===`);
  console.log(`ブランドドメイン: ${opts.brandDomain}`);
  console.log(`モード: ${opts.apply ? '🔴 本番実行' : '🟡 ドライラン'}\n`);

  // ブランド特定
  const brand = await prisma.brand.findFirst({
    where: { domain: opts.brandDomain },
    select: { id: true, name: true, domain: true },
  });
  if (!brand) {
    console.error(`❌ ブランド "${opts.brandDomain}" が見つかりません。`);
    process.exit(1);
  }
  console.log(`ブランド: ${brand.name} (${brand.domain})\n`);

  // 対象ドメイン取得
  const targets = await prisma.detectedDomain.findMany({
    where: {
      brandId: brand.id,
      source: 'user_report',
      status: 'confirmed_threat',
    },
    select: { id: true, domain: true, source: true, status: true, firstSeen: true },
    orderBy: { firstSeen: 'desc' },
  });

  if (targets.length === 0) {
    console.log('✅ 対象ドメインはありません（すべて更新済みか、該当なし）。');
    process.exit(0);
  }

  console.log(`対象: ${targets.length}件`);
  console.log('─'.repeat(70));
  for (const t of targets) {
    console.log(`  ${t.domain}  (検知日: ${t.firstSeen.toISOString().slice(0, 10)})`);
  }
  console.log('─'.repeat(70));

  if (!opts.apply) {
    console.log('\n👆 上記が更新対象です。実行するには --apply を付けてください。');
    process.exit(0);
  }

  // 一括更新
  const targetIds = targets.map((t) => t.id);

  const updateResult = await prisma.detectedDomain.updateMany({
    where: { id: { in: targetIds } },
    data: { status: 'takedown_sent' },
  });
  console.log(`\n✅ DetectedDomain ${updateResult.count}件を takedown_sent に更新しました。`);

  // ThreatStatusLog を記録
  await prisma.threatStatusLog.createMany({
    data: targetIds.map((id) => ({
      detectedDomainId: id,
      fromStatus: 'confirmed_threat',
      toStatus: 'takedown_sent',
      changedBy: 'script:bulk-takedown-sent',
    })),
  });
  console.log(`✅ ThreatStatusLog ${targetIds.length}件を記録しました。`);

  console.log('\n🎉 完了');
}

run()
  .catch((err) => {
    console.error('エラー:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
