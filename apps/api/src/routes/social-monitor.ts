import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { monitorTwitter } from '../services/twitter-monitor.js';

const router = Router();

// Helper: get brand IDs belonging to user's org (superadmin gets all)
async function orgBrandIds(req: any): Promise<string[]> {
  if (req.user?.role === 'superadmin' && !req.user?.organizationId) {
    const brands = await prisma.brand.findMany({ select: { id: true } });
    return brands.map((b) => b.id);
  }
  const brands = await prisma.brand.findMany({
    where: { organizationId: req.user!.organizationId! },
    select: { id: true },
  });
  return brands.map((b) => b.id);
}

// GET /api/social-posts - List social posts
router.get('/', async (req, res) => {
  try {
    const brandIds = await orgBrandIds(req);

    const {
      status,
      platform,
      brandId,
      matchedDomain,
      sortBy = 'createdAt',
      order = 'desc',
      page = '1',
      pageSize = '20',
    } = req.query;

    const where: Record<string, unknown> = { brandId: { in: brandIds } };
    if (status) where.status = String(status);
    if (platform) where.platform = String(platform);
    if (brandId && brandIds.includes(String(brandId))) {
      where.brandId = String(brandId);
    }
    if (matchedDomain) where.matchedDomain = String(matchedDomain);

    const skip = (Number(page) - 1) * Number(pageSize);
    const take = Number(pageSize);

    const allowedSort = ['createdAt', 'riskScore', 'postedAt'];
    const sortField = allowedSort.includes(String(sortBy)) ? String(sortBy) : 'createdAt';

    const [posts, total] = await Promise.all([
      prisma.socialPost.findMany({
        where,
        include: { brand: { select: { name: true, domain: true } } },
        orderBy: { [sortField]: order === 'asc' ? 'asc' : 'desc' },
        skip,
        take,
      }),
      prisma.socialPost.count({ where }),
    ]);

    res.json({
      posts,
      pagination: {
        page: Number(page),
        pageSize: take,
        total,
        totalPages: Math.ceil(total / take),
      },
    });
  } catch (err) {
    console.error('[SocialMonitor] List error:', err);
    res.status(500).json({ error: 'ソーシャル投稿の取得に失敗しました。' });
  }
});

// GET /api/social-posts/stats - Summary stats
router.get('/stats', async (req, res) => {
  try {
    const brandIds = await orgBrandIds(req);

    const [total, newCount, byPlatform] = await Promise.all([
      prisma.socialPost.count({ where: { brandId: { in: brandIds } } }),
      prisma.socialPost.count({ where: { brandId: { in: brandIds }, status: 'new' } }),
      prisma.socialPost.groupBy({
        by: ['platform'],
        where: { brandId: { in: brandIds } },
        _count: true,
      }),
    ]);

    res.json({
      total,
      new: newCount,
      byPlatform: byPlatform.map((p) => ({ platform: p.platform, count: p._count })),
    });
  } catch (err) {
    console.error('[SocialMonitor] Stats error:', err);
    res.status(500).json({ error: '統計情報の取得に失敗しました。' });
  }
});

// PATCH /api/social-posts/:id/status - Update post status
router.patch('/:id/status', async (req, res) => {
  try {
    const brandIds = await orgBrandIds(req);
    const { id } = req.params;
    const { status } = req.body;

    if (!['new', 'reviewed', 'dismissed'].includes(status)) {
      return res.status(400).json({ error: 'ステータスは new, reviewed, dismissed のいずれかです。' });
    }

    // Verify ownership
    const post = await prisma.socialPost.findUnique({ where: { id } });
    if (!post || !brandIds.includes(post.brandId)) {
      return res.status(404).json({ error: '投稿が見つかりません。' });
    }

    const updated = await prisma.socialPost.update({
      where: { id },
      data: { status },
    });

    res.json(updated);
  } catch (err) {
    console.error('[SocialMonitor] Status update error:', err);
    res.status(500).json({ error: 'ステータスの更新に失敗しました。' });
  }
});

// POST /api/social-posts/scan - Trigger manual Twitter scan
router.post('/scan', async (req, res) => {
  try {
    // Only superadmin or admin can trigger manual scans
    if (!['superadmin', 'admin'].includes(req.user?.role ?? '')) {
      return res.status(403).json({ error: '手動スキャンには管理者権限が必要です。' });
    }

    const count = await monitorTwitter();
    res.json({ message: `Twitter監視完了: ${count}件の新規投稿を検出`, count });
  } catch (err) {
    console.error('[SocialMonitor] Manual scan error:', err);
    res.status(500).json({ error: 'Twitter監視の実行に失敗しました。' });
  }
});

export default router;
