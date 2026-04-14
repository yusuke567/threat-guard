/**
 * Layer 4: JPCERTコーパスから学習された検知パターンの閲覧・手動再学習API（管理者向け）。
 */
import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { learnPatterns } from '../services/pattern-learner.js';

const router = Router();

// GET /api/admin/jpcert-patterns — 学習済みパターン一覧
router.get('/', async (req, res) => {
  const type = typeof req.query.type === 'string' ? req.query.type : undefined;
  const limit = Math.min(parseInt(String(req.query.limit ?? '100'), 10) || 100, 500);

  const patterns = await prisma.jpcertLearnedPattern.findMany({
    where: type ? { patternType: type } : undefined,
    orderBy: [{ patternType: 'asc' }, { occurrences: 'desc' }],
    take: limit,
  });

  // タイプ別サマリ
  const summaryRaw = await prisma.jpcertLearnedPattern.groupBy({
    by: ['patternType'],
    _count: { _all: true },
    _max: { occurrences: true, lastSeen: true },
  });
  const summary = summaryRaw.map((s) => ({
    patternType: s.patternType,
    count: s._count._all,
    maxOccurrences: s._max.occurrences,
    lastSeen: s._max.lastSeen,
  }));

  res.json({
    summary,
    patterns: patterns.map((p) => ({
      id: p.id,
      patternType: p.patternType,
      pattern: p.pattern,
      occurrences: p.occurrences,
      precision: Math.round(p.precision * 10000) / 10000,
      examples: p.examples ? (() => { try { return JSON.parse(p.examples); } catch { return []; } })() : [],
      lastSeen: p.lastSeen,
      updatedAt: p.updatedAt,
    })),
  });
});

// POST /api/admin/jpcert-patterns/relearn — 手動再学習
// KnownPhishingUrl コーパスを再走査してパターンを更新する。数秒〜数十秒。
router.post('/relearn', async (_req, res) => {
  const startedAt = Date.now();
  try {
    const result = await learnPatterns();
    const durationSec = Math.round((Date.now() - startedAt) / 1000);
    res.json({ status: 'ok', durationSec, ...result });
  } catch (err: any) {
    console.error('[jpcert-patterns/relearn] error:', err);
    res.status(500).json({ error: err?.message || 'パターン学習に失敗しました' });
  }
});

export default router;
