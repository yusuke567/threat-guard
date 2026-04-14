/**
 * 外部脅威フィード（JPCERT等）の取り込み実行履歴を返す管理者向けAPI。
 * Layer B: 管理画面ダッシュボード「最終更新」表示と異常検知に利用。
 */
import { Router } from 'express';
import { prisma } from '../lib/prisma.js';

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

export default router;
