/**
 * 指定ブランドの status='new_domain' を一括で分析する。
 * 本来はスケジューラ (6時間毎のcron) が処理するが、cronの発火を待たずに
 * 手動で分析を走らせたい場合に使う。
 *
 * 処理内容 (scheduler.runFullScan の分析ループ部分を踏襲):
 *   1. lookupWhois (WHOISデータ補完)
 *   2. analyzeThreat (Claude APIで分類)
 *   3. calculateRiskScore (リスクスコア算出)
 *
 * 通知は飛ばさない (mute-alertsと別レイヤで抑止しているが二重保険)。
 *
 * Usage:
 *   npx tsx scripts/run-analysis-batch.ts --brand <brandName>          # dry-run
 *   npx tsx scripts/run-analysis-batch.ts --brand <brandName> --apply  # 実行
 *   npx tsx scripts/run-analysis-batch.ts --brand <brandName> --apply --limit 100
 *   npx tsx scripts/run-analysis-batch.ts --brand <brandName> --apply --concurrency 3 --delay 500
 *
 * オプション:
 *   --concurrency <N>  同時並列分析数 (default 2)
 *   --delay <ms>       1件完了後の待機ms (default 500)
 *   --limit <N>        処理件数上限 (default 全件)
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { analyzeThreat } from '../src/services/threat-analyzer.js';
import { calculateRiskScore } from '../src/services/risk-scorer.js';
import { lookupWhois } from '../src/services/whois-lookup.js';

const prisma = new PrismaClient();

function getArg(name: string, def?: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : def;
}

async function main() {
  const apply = process.argv.includes('--apply');
  const brandName = getArg('--brand');
  if (!brandName) {
    console.error('--brand <brandName> が必須です');
    process.exit(1);
  }

  const concurrency = Number(getArg('--concurrency', '2'));
  const delayMs = Number(getArg('--delay', '500'));
  const limit = getArg('--limit') ? Number(getArg('--limit')) : undefined;

  const brand = await prisma.brand.findFirst({ where: { name: brandName } });
  if (!brand) {
    console.error(`ブランド "${brandName}" が見つかりません`);
    process.exit(1);
  }

  const targets = await prisma.detectedDomain.findMany({
    where: { brandId: brand.id, status: 'new_domain' },
    select: { id: true, domain: true },
    orderBy: { firstSeen: 'desc' },
    ...(limit ? { take: limit } : {}),
  });

  console.log(`[run-analysis-batch] ブランド: ${brand.name}`);
  console.log(`[run-analysis-batch] new_domain 件数: ${targets.length}`);
  console.log(`[run-analysis-batch] 並列数: ${concurrency}, 待機: ${delayMs}ms`);

  if (!apply) {
    console.log('\n[dry-run] --apply で実際に分析を開始します。');
    return;
  }

  let done = 0;
  let ok = 0;
  let failed = 0;
  const startedAt = Date.now();

  // Worker pool — concurrency 本のワーカーが共通キューから取り出して処理
  const queue = [...targets];

  async function worker(workerId: number) {
    while (true) {
      const d = queue.shift();
      if (!d) break;

      const n = ++done;
      try {
        await lookupWhois(d.id);
        const analysis = await analyzeThreat(d.id);
        const score = await calculateRiskScore(d.id);
        ok++;
        if (n % 20 === 0 || n === targets.length) {
          const elapsed = Math.round((Date.now() - startedAt) / 1000);
          const rate = (n / Math.max(elapsed, 1)).toFixed(2);
          console.log(
            `[progress] ${n}/${targets.length} (ok=${ok}, failed=${failed}) ${elapsed}s経過, ${rate}件/s`
          );
        }
        console.log(`  [W${workerId}] ✓ ${d.domain} → ${analysis.category} (score=${score})`);
      } catch (err) {
        failed++;
        console.error(`  [W${workerId}] ✗ ${d.domain}:`, err instanceof Error ? err.message : err);
      }

      if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));
    }
  }

  await Promise.all(
    Array.from({ length: Math.max(1, concurrency) }, (_, i) => worker(i + 1))
  );

  const elapsed = Math.round((Date.now() - startedAt) / 1000);
  console.log(`\n[run-analysis-batch] 完了: ok=${ok}, failed=${failed}, 所要=${elapsed}s`);
}

main()
  .catch((err) => {
    console.error('[run-analysis-batch] Failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
