/**
 * JPCERT/CC phishurl-list 取り込みCLI（手動実行用）。
 *
 * 中核ロジックは src/services/jpcert-importer.ts に集約されており、
 * scheduler.ts からの自動実行と同じコードパスを通る。
 *
 * 使い方:
 *   npx tsx scripts/import-jpcert.ts                # 2019年〜現在年まで全期間
 *   npx tsx scripts/import-jpcert.ts --year=2024    # 単一年
 *   npx tsx scripts/import-jpcert.ts --from=2024    # 指定年以降
 *   npx tsx scripts/import-jpcert.ts --no-notify    # Slack通知抑止
 */
import { PrismaClient } from '@prisma/client';
import { runJpcertImport } from '../src/services/jpcert-importer.js';
import { notifyFeedImportSummary, notifyFeedImportFailure } from '../src/services/slack-notifier.js';

const prisma = new PrismaClient();

function parseArgs() {
  const currentYear = new Date().getFullYear();
  let fromYear = 2019;
  let toYear = currentYear;
  let notify = true;

  for (const arg of process.argv.slice(2)) {
    const yearMatch = arg.match(/^--year=(\d{4})$/);
    if (yearMatch) { fromYear = toYear = parseInt(yearMatch[1], 10); continue; }
    const fromMatch = arg.match(/^--from=(\d{4})$/);
    if (fromMatch) { fromYear = parseInt(fromMatch[1], 10); continue; }
    const toMatch = arg.match(/^--to=(\d{4})$/);
    if (toMatch) { toYear = parseInt(toMatch[1], 10); continue; }
    if (arg === '--no-notify') { notify = false; continue; }
  }
  return { fromYear, toYear, notify };
}

async function run() {
  const { fromYear, toYear, notify } = parseArgs();
  const startedAt = Date.now();
  console.log(`[import-jpcert] target years: ${fromYear} - ${toYear} (notify=${notify})`);

  try {
    const result = await runJpcertImport({ fromYear, toYear });
    const totalInDb = await prisma.knownPhishingUrl.count({ where: { source: 'jpcert' } });
    const durationSec = Math.round((Date.now() - startedAt) / 1000);

    console.log(`\n[import-jpcert] Done.`);
    console.log(`  fetched=${result.fetchedCount} inserted=${result.insertedCount}`);
    console.log(`  brand hits (Pro+): ${result.brandHitCount}`);
    console.log(`  alerted orgs: ${result.alertedOrgIds.length}`);
    console.log(`  total in DB: ${totalInDb}`);

    if (notify) {
      await notifyFeedImportSummary({
        source: 'JPCERT/CC',
        fetchedCount: result.fetchedCount,
        insertedCount: result.insertedCount,
        brandHitCount: result.brandHitCount,
        alertedOrgCount: result.alertedOrgIds.length,
        totalInDb,
        durationSec,
      });
    }
  } catch (err: any) {
    console.error('[import-jpcert] FAILED:', err);
    if (notify) {
      await notifyFeedImportFailure('JPCERT/CC', err?.message || String(err));
    }
    process.exitCode = 1;
  }
}

run().finally(() => prisma.$disconnect());
