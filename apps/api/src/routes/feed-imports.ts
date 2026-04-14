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
      console.log(`[feed-imports/run] done: fetched=${result.fetchedCount} inserted=${result.insertedCount} hits=${result.brandHitCount}`);
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

export default router;
