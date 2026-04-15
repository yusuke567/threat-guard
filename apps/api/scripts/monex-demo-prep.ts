/**
 * マネックス証券商談前のJPCERT重複整理スクリプト。
 *
 * 背景: マネックス証券は自らJPCERT/CCへフィッシングURLを報告しているため、
 * 我々が JPCERT フィードを取り込んでPro+ブランドに自動マッチさせると、
 * Monex 自身の報告が「ThreatGuardがJPCERT経由で検知」として跳ね返る循環が発生する。
 *
 * 本スクリプトは以下を行う:
 *   1. 診断: Monex ブランドの DetectedDomain / JPCERT マッチ状況をレポート
 *   2. (--merge)      organic + jpcert_feed の重複を統合（organicを残し jpcert_feed を削除、
 *                     jpcertConfirmedAt を引き継ぐ）
 *   3. (--archive)    残った jpcert_feed 単独の DetectedDomain を status='archived' にする
 *   4. (--delete)     jpcert_feed 単独の DetectedDomain を物理削除（--archive より強い）
 *   5. (--suppress)   Brand.suppressJpcertAutoMatch = true にし、今後の自動マッチを停止
 *
 * デフォルトはドライラン。実行するには --apply を付ける。
 *
 * 使い方:
 *   npx tsx scripts/monex-demo-prep.ts                             # 診断のみ
 *   npx tsx scripts/monex-demo-prep.ts --merge --archive --suppress  # 提案内容を表示（dry-run）
 *   npx tsx scripts/monex-demo-prep.ts --merge --archive --suppress --apply  # 実行
 *   npx tsx scripts/monex-demo-prep.ts --brand-domain=monex.co.jp ...  # ブランド指定
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface Opts {
  brandDomain: string;
  doMerge: boolean;
  doArchive: boolean;
  doDelete: boolean;
  doSuppress: boolean;
  apply: boolean;
}

function parseArgs(): Opts {
  const opts: Opts = {
    brandDomain: 'monex.co.jp',
    doMerge: false,
    doArchive: false,
    doDelete: false,
    doSuppress: false,
    apply: false,
  };
  for (const arg of process.argv.slice(2)) {
    if (arg === '--merge') opts.doMerge = true;
    else if (arg === '--archive') opts.doArchive = true;
    else if (arg === '--delete') opts.doDelete = true;
    else if (arg === '--suppress') opts.doSuppress = true;
    else if (arg === '--apply') opts.apply = true;
    else {
      const m = arg.match(/^--brand-domain=(.+)$/);
      if (m) opts.brandDomain = m[1];
    }
  }
  if (opts.doArchive && opts.doDelete) {
    throw new Error('--archive と --delete は同時指定できません');
  }
  return opts;
}

async function run() {
  const opts = parseArgs();
  const mode = opts.apply ? '\x1b[31mAPPLY\x1b[0m' : '\x1b[32mDRY-RUN\x1b[0m';
  console.log(`\n[monex-demo-prep] mode=${mode} brand-domain=${opts.brandDomain}\n`);

  // 1. ブランド特定
  const brands = await prisma.brand.findMany({
    where: { domain: opts.brandDomain },
    include: { organization: { select: { id: true, name: true, plan: true } } },
  });

  if (brands.length === 0) {
    console.error(`[monex-demo-prep] ブランドが見つかりません: domain=${opts.brandDomain}`);
    process.exitCode = 1;
    return;
  }

  for (const brand of brands) {
    console.log(`─── Brand: ${brand.name} (${brand.domain}) ───`);
    console.log(`  id:             ${brand.id}`);
    console.log(`  organization:   ${brand.organization?.name} (plan=${brand.organization?.plan})`);
    console.log(`  keywords:       ${brand.keywords}`);
    console.log(`  suppressJpcertAutoMatch: ${(brand as any).suppressJpcertAutoMatch ?? '(未移行)'}`);

    // 2. DetectedDomain 状況
    const detected = await prisma.detectedDomain.findMany({
      where: { brandId: brand.id },
      select: {
        id: true,
        domain: true,
        source: true,
        status: true,
        firstSeen: true,
        riskScore: true,
        jpcertConfirmedAt: true,
      },
      orderBy: { firstSeen: 'asc' },
    });

    const bySource: Record<string, number> = {};
    for (const d of detected) bySource[d.source] = (bySource[d.source] ?? 0) + 1;
    console.log(`\n  DetectedDomain 総数: ${detected.length}`);
    for (const [src, count] of Object.entries(bySource).sort()) {
      console.log(`    ${src.padEnd(20)} ${count}`);
    }

    // 3. 重複（同一domainで複数レコード）
    const byDomain = new Map<string, typeof detected>();
    for (const d of detected) {
      const arr = byDomain.get(d.domain) ?? [];
      arr.push(d);
      byDomain.set(d.domain, arr);
    }
    const dupGroups = [...byDomain.entries()].filter(([, arr]) => arr.length > 1);
    const jpcertOnlyEntries = detected.filter(
      (d) =>
        d.source === 'jpcert_feed' &&
        (byDomain.get(d.domain)?.length ?? 0) === 1,
    );

    console.log(`\n  重複ドメイン (organic+jpcert_feed 等): ${dupGroups.length}`);
    for (const [domain, arr] of dupGroups.slice(0, 10)) {
      const sources = arr.map((a) => a.source).join(', ');
      console.log(`    ${domain.padEnd(40)} (${arr.length}件 sources=${sources})`);
    }
    if (dupGroups.length > 10) console.log(`    ... 他 ${dupGroups.length - 10} 件`);

    console.log(`\n  jpcert_feed 単独（他ソース検知なし）: ${jpcertOnlyEntries.length}`);
    for (const d of jpcertOnlyEntries.slice(0, 10)) {
      console.log(
        `    ${d.domain.padEnd(40)} status=${d.status} risk=${d.riskScore} firstSeen=${d.firstSeen.toISOString().slice(0, 10)}`,
      );
    }
    if (jpcertOnlyEntries.length > 10)
      console.log(`    ... 他 ${jpcertOnlyEntries.length - 10} 件`);

    // 4. KnownPhishingUrl 側のブランド該当数（参考）
    const keywords = (brand.keywords || '')
      .split(',')
      .map((k) => k.trim().toLowerCase())
      .filter((k) => k.length >= 2);
    const allCandidates = [...new Set([brand.name.toLowerCase(), ...keywords])].filter(
      (c) => c.length >= 2,
    );
    let jpcertMatchedInCorpus = 0;
    if (allCandidates.length > 0) {
      jpcertMatchedInCorpus = await prisma.knownPhishingUrl.count({
        where: {
          OR: allCandidates.map((c) => ({
            brandLabel: { contains: c, mode: 'insensitive' as const },
          })),
        },
      });
    }
    console.log(`\n  KnownPhishingUrl でbrand候補一致する行数（参考）: ${jpcertMatchedInCorpus}`);

    // ─── アクション実行 ───
    console.log('');

    if (opts.doMerge) {
      let merged = 0;
      for (const [domain, arr] of dupGroups) {
        // 最古のorganicレコード（jpcert_feed以外）を残す
        const organic = arr
          .filter((a) => a.source !== 'jpcert_feed')
          .sort((a, b) => a.firstSeen.getTime() - b.firstSeen.getTime())[0];
        const jpcertFeed = arr.find((a) => a.source === 'jpcert_feed');
        if (!organic || !jpcertFeed) continue;

        // KnownPhishingUrl の observedAt を参照して jpcertConfirmedAt を決める
        const hit = await prisma.knownPhishingUrl.findFirst({
          where: { domain },
          orderBy: { observedAt: 'asc' },
          select: { observedAt: true },
        });
        const newConfirmed = hit?.observedAt ?? jpcertFeed.firstSeen;
        const willUpdate =
          !organic.jpcertConfirmedAt || organic.jpcertConfirmedAt > newConfirmed;

        console.log(
          `  [merge] ${domain} keep=${organic.id.slice(0, 8)}(${organic.source}) ` +
            `drop=${jpcertFeed.id.slice(0, 8)}(jpcert_feed) ` +
            `confirmedAt=${willUpdate ? newConfirmed.toISOString().slice(0, 10) : '(据置)'}`,
        );

        if (opts.apply) {
          await prisma.$transaction(async (tx) => {
            if (willUpdate) {
              await tx.detectedDomain.update({
                where: { id: organic.id },
                data: { jpcertConfirmedAt: newConfirmed },
              });
            }
            await tx.detectedDomain.delete({ where: { id: jpcertFeed.id } });
          });
        }
        merged++;
      }
      console.log(`  → merge 対象: ${merged} 件 ${opts.apply ? '(適用済)' : '(dry-run)'}`);
    }

    if (opts.doArchive) {
      // ※ mergeを先に実行済み前提: jpcert_feed 単独のものだけが残っている
      const targets = opts.doMerge
        ? jpcertOnlyEntries
        : detected.filter((d) => d.source === 'jpcert_feed');
      console.log(`  [archive] 対象: ${targets.length} 件`);
      for (const d of targets.slice(0, 5)) {
        console.log(`    ${d.domain} (id=${d.id.slice(0, 8)} status ${d.status} → archived)`);
      }
      if (targets.length > 5) console.log(`    ... 他 ${targets.length - 5} 件`);
      if (opts.apply && targets.length > 0) {
        await prisma.detectedDomain.updateMany({
          where: { id: { in: targets.map((t) => t.id) } },
          data: { status: 'archived' },
        });
      }
    }

    if (opts.doDelete) {
      const targets = opts.doMerge
        ? jpcertOnlyEntries
        : detected.filter((d) => d.source === 'jpcert_feed');
      console.log(`  [delete] 対象: ${targets.length} 件（物理削除）`);
      for (const d of targets.slice(0, 5)) {
        console.log(`    ${d.domain} (id=${d.id.slice(0, 8)})`);
      }
      if (targets.length > 5) console.log(`    ... 他 ${targets.length - 5} 件`);
      if (opts.apply && targets.length > 0) {
        await prisma.detectedDomain.deleteMany({
          where: { id: { in: targets.map((t) => t.id) } },
        });
      }
    }

    if (opts.doSuppress) {
      console.log(
        `  [suppress] Brand.suppressJpcertAutoMatch: ${(brand as any).suppressJpcertAutoMatch} → true`,
      );
      if (opts.apply) {
        await prisma.brand.update({
          where: { id: brand.id },
          data: { suppressJpcertAutoMatch: true },
        });
      }
    }

    console.log('');
  }

  if (!opts.apply) {
    console.log('─── DRY-RUN 終了 ───');
    console.log('実行するには --apply を追加してください。');
  } else {
    console.log('─── 適用完了 ───');
  }
}

run()
  .catch((err) => {
    console.error('[monex-demo-prep] Fatal error:', err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
