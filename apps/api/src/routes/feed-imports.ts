/**
 * 外部脅威フィード（JPCERT等）の取り込み実行履歴を返す管理者向けAPI。
 * Layer B: 管理画面ダッシュボード「最終更新」表示と異常検知に利用。
 */
import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { runJpcertImport } from '../services/jpcert-importer.js';
import { notifyFeedImportSummary, notifyFeedImportFailure } from '../services/slack-notifier.js';

const router = Router();

// GET /api/admin/feed-imports — 直近の取り込み履歴一覧
router.get('/', async (req, res) => {
  const source = typeof req.query.source === 'string' ? req.query.source : undefined;
  const limit = Math.min(parseInt(String(req.query.limit ?? '50'), 10) || 50, 200);

  const runs = await prisma.feedImportRun.findMany({
    where: source ? { source } : undefined,
    orderBy: { startedAt: 'desc' },
    take: limit,
  });

  res.json(
    runs.map((r) => ({
      id: r.id,
      source: r.source,
      status: r.status,
      fetchedCount: r.fetchedCount,
      insertedCount: r.insertedCount,
      brandHitCount: r.brandHitCount,
      newBrandHits: r.newBrandHits,
      confirmedBrandHits: r.confirmedBrandHits,
      alertedOrgIds: r.alertedOrgIds ? r.alertedOrgIds.split(',').filter(Boolean) : [],
      startedAt: r.startedAt,
      completedAt: r.completedAt,
      durationSec: r.completedAt
        ? Math.round((r.completedAt.getTime() - r.startedAt.getTime()) / 1000)
        : null,
      error: r.error,
    })),
  );
});

// GET /api/admin/feed-imports/status — 各ソースの最終成功時刻と健全性
router.get('/status', async (_req, res) => {
  const sources = ['jpcert'] as const;
  const STALE_HOURS = 26; // 日次想定で26時間以上更新がなければstale

  const status = await Promise.all(
    sources.map(async (source) => {
      const lastSuccess = await prisma.feedImportRun.findFirst({
        where: { source, status: 'success' },
        orderBy: { completedAt: 'desc' },
      });
      const totalInDb = source === 'jpcert'
        ? await prisma.knownPhishingUrl.count({ where: { source: 'jpcert' } })
        : 0;

      const lastSuccessAt = lastSuccess?.completedAt ?? null;
      const hoursSince = lastSuccessAt
        ? (Date.now() - lastSuccessAt.getTime()) / (1000 * 60 * 60)
        : null;
      const isHealthy = hoursSince !== null && hoursSince < STALE_HOURS;

      return {
        source,
        lastSuccessAt,
        hoursSinceLastSuccess: hoursSince,
        isHealthy,
        totalInDb,
        lastInsertedCount: lastSuccess?.insertedCount ?? 0,
        lastBrandHitCount: lastSuccess?.brandHitCount ?? 0,
        lastNewBrandHits: lastSuccess?.newBrandHits ?? 0,
        lastConfirmedBrandHits: lastSuccess?.confirmedBrandHits ?? 0,
      };
    }),
  );

  res.json(status);
});

// POST /api/admin/feed-imports/run — 手動でインポートを即時実行（バックグラウンド）
// body: { source?: 'jpcert', from?: number, to?: number, notify?: boolean }
// レスポンスは即時返り、実際の処理はバックグラウンドで走る。進捗は /status または Slack で確認。
router.post('/run', async (req, res) => {
  const source = (req.body?.source as string | undefined) ?? 'jpcert';
  if (source !== 'jpcert') {
    return res.status(400).json({ error: `未対応のソースです: ${source}` });
  }

  const currentYear = new Date().getFullYear();
  const fromYear = Number(req.body?.from) || currentYear - 1;
  const toYear = Number(req.body?.to) || currentYear;
  const notify = req.body?.notify !== false;

  if (fromYear < 2019 || toYear > currentYear || fromYear > toYear) {
    return res.status(400).json({ error: `年の指定が不正です: from=${fromYear}, to=${toYear}` });
  }

  // 直近で running 状態のrunがあれば二重起動を防ぐ
  const existingRunning = await prisma.feedImportRun.findFirst({
    where: { source, status: 'running' },
    orderBy: { startedAt: 'desc' },
  });
  if (existingRunning) {
    const ageMin = (Date.now() - existingRunning.startedAt.getTime()) / (1000 * 60);
    if (ageMin < 30) {
      return res.status(409).json({
        error: '別の取り込みが実行中です',
        runningRunId: existingRunning.id,
        startedAt: existingRunning.startedAt,
      });
    }
  }

  // バックグラウンド実行（レスポンスはすぐ返す）
  const startedAt = Date.now();
  (async () => {
    try {
      console.log(`[feed-imports/run] triggered manually: source=${source} from=${fromYear} to=${toYear}`);
      const result = await runJpcertImport({ fromYear, toYear });
      const totalInDb = await prisma.knownPhishingUrl.count({ where: { source: 'jpcert' } });
      const durationSec = Math.round((Date.now() - startedAt) / 1000);
      console.log(
        `[feed-imports/run] done: fetched=${result.fetchedCount} inserted=${result.insertedCount} ` +
        `newHits=${result.newBrandHits} confirmedHits=${result.confirmedBrandHits}`,
      );
      if (notify) {
        await notifyFeedImportSummary({
          source: 'JPCERT/CC',
          fetchedCount: result.fetchedCount,
          insertedCount: result.insertedCount,
          brandHitCount: result.brandHitCount,
          newBrandHits: result.newBrandHits,
          confirmedBrandHits: result.confirmedBrandHits,
          alertedOrgCount: result.alertedOrgIds.length,
          totalInDb,
          durationSec,
        });
      }
    } catch (err: any) {
      console.error('[feed-imports/run] FAILED:', err);
      if (notify) {
        await notifyFeedImportFailure('JPCERT/CC', err?.message || String(err));
      }
    }
  })();

  res.status(202).json({
    status: 'accepted',
    source,
    fromYear,
    toYear,
    notify,
    message: 'バックグラウンドで取り込みを開始しました。進捗は /api/admin/feed-imports または Slack で確認してください。',
  });
});

// POST /api/admin/feed-imports/cleanup-brand — 特定ブランドのJPCERT重複整理とsuppress設定
// body: {
//   brandDomain: string,     // e.g. "monex.co.jp"
//   merge?: boolean,         // organic + jpcert_feed の重複をマージ（organicを残す）
//   archive?: boolean,       // jpcert_feed 単独を status='archived' に
//   delete?: boolean,        // jpcert_feed 単独を物理削除
//   suppress?: boolean,      // Brand.suppressJpcertAutoMatch = true
//   apply?: boolean,         // false(default)ならdry-run、trueで実行
// }
router.post('/cleanup-brand', async (req, res) => {
  const {
    brandDomain,
    merge = false,
    archive = false,
    delete: doDelete = false,
    suppress = false,
    apply = false,
  } = req.body ?? {};

  if (typeof brandDomain !== 'string' || !brandDomain) {
    return res.status(400).json({ error: 'brandDomain が必要です' });
  }
  if (archive && doDelete) {
    return res.status(400).json({ error: 'archive と delete は同時指定できません' });
  }

  const brands = await prisma.brand.findMany({
    where: { domain: brandDomain },
    include: { organization: { select: { id: true, name: true, plan: true } } },
  });
  if (brands.length === 0) {
    return res.status(404).json({ error: `ブランドが見つかりません: ${brandDomain}` });
  }

  const report: any[] = [];

  for (const brand of brands) {
    const detected = await prisma.detectedDomain.findMany({
      where: { brandId: brand.id },
      select: {
        id: true,
        domain: true,
        source: true,
        status: true,
        firstSeen: true,
        jpcertConfirmedAt: true,
      },
      orderBy: { firstSeen: 'asc' },
    });

    const byDomain = new Map<string, typeof detected>();
    for (const d of detected) {
      const arr = byDomain.get(d.domain) ?? [];
      arr.push(d);
      byDomain.set(d.domain, arr);
    }
    const dupGroups = [...byDomain.entries()].filter(([, arr]) => arr.length > 1);
    const jpcertOnly = detected.filter(
      (d) => d.source === 'jpcert_feed' && (byDomain.get(d.domain)?.length ?? 0) === 1,
    );

    const actions: any = {
      brandId: brand.id,
      brandName: brand.name,
      organization: brand.organization?.name,
      plan: brand.organization?.plan,
      before: {
        totalDetected: detected.length,
        duplicateGroups: dupGroups.length,
        jpcertFeedOnly: jpcertOnly.length,
        suppressJpcertAutoMatch: (brand as any).suppressJpcertAutoMatch ?? false,
      },
      changes: {
        mergedGroups: 0,
        archivedIds: [] as string[],
        deletedIds: [] as string[],
        suppressSet: false,
      },
      apply,
    };

    if (merge) {
      for (const [domain, arr] of dupGroups) {
        const organic = arr
          .filter((a) => a.source !== 'jpcert_feed')
          .sort((a, b) => a.firstSeen.getTime() - b.firstSeen.getTime())[0];
        const jpcertFeed = arr.find((a) => a.source === 'jpcert_feed');
        if (!organic || !jpcertFeed) continue;

        const hit = await prisma.knownPhishingUrl.findFirst({
          where: { domain },
          orderBy: { observedAt: 'asc' },
          select: { observedAt: true },
        });
        const newConfirmed = hit?.observedAt ?? jpcertFeed.firstSeen;
        const willUpdate =
          !organic.jpcertConfirmedAt || organic.jpcertConfirmedAt > newConfirmed;

        if (apply) {
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
        actions.changes.mergedGroups++;
      }
    }

    const targetsJpcertOnly = merge
      ? jpcertOnly
      : detected.filter((d) => d.source === 'jpcert_feed');

    if (archive) {
      actions.changes.archivedIds = targetsJpcertOnly.map((t) => t.id);
      if (apply && targetsJpcertOnly.length > 0) {
        await prisma.detectedDomain.updateMany({
          where: { id: { in: targetsJpcertOnly.map((t) => t.id) } },
          data: { status: 'archived' },
        });
      }
    }
    if (doDelete) {
      actions.changes.deletedIds = targetsJpcertOnly.map((t) => t.id);
      if (apply && targetsJpcertOnly.length > 0) {
        await prisma.detectedDomain.deleteMany({
          where: { id: { in: targetsJpcertOnly.map((t) => t.id) } },
        });
      }
    }

    if (suppress) {
      actions.changes.suppressSet = true;
      if (apply) {
        await prisma.brand.update({
          where: { id: brand.id },
          data: { suppressJpcertAutoMatch: true } as any,
        });
      }
    }

    report.push(actions);
  }

  res.json({ apply, report });
});

export default router;
