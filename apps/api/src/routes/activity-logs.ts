import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';

const router = Router();

// GET /api/activity-logs — paginated query with filters
router.get('/', async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string) || 50));
    const skip = (page - 1) * pageSize;

    // Build where clause from filters
    const where: any = {};

    if (req.query.userId) {
      where.userId = req.query.userId as string;
    }
    if (req.query.userEmail) {
      where.userEmail = { contains: req.query.userEmail as string, mode: 'insensitive' };
    }
    if (req.query.organizationId) {
      where.organizationId = req.query.organizationId as string;
    }
    if (req.query.action) {
      where.action = req.query.action as string;
    }
    if (req.query.category) {
      where.category = req.query.category as string;
    }
    if (req.query.method) {
      where.method = req.query.method as string;
    }

    // Date range filter
    if (req.query.startDate || req.query.endDate) {
      where.createdAt = {};
      if (req.query.startDate) {
        where.createdAt.gte = new Date(req.query.startDate as string);
      }
      if (req.query.endDate) {
        const endDate = new Date(req.query.endDate as string);
        endDate.setHours(23, 59, 59, 999);
        where.createdAt.lte = endDate;
      }
    }

    const sortBy = (req.query.sortBy as string) || 'createdAt';
    const order = (req.query.order as string) === 'asc' ? 'asc' : 'desc';

    const [data, total] = await Promise.all([
      prisma.activityLog.findMany({
        where,
        orderBy: { [sortBy]: order },
        skip,
        take: pageSize,
      }),
      prisma.activityLog.count({ where }),
    ]);

    res.json({
      data,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (err) {
    console.error('[activity-logs] query error:', err);
    res.status(500).json({ error: 'アクティビティログの取得に失敗しました。' });
  }
});

// GET /api/activity-logs/stats — summary statistics
router.get('/stats', async (_req: Request, res: Response) => {
  try {
    const now = new Date();
    const day1 = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const day7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const day30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [count24h, count7d, count30d, topUsers, categoryBreakdown] = await Promise.all([
      prisma.activityLog.count({ where: { createdAt: { gte: day1 } } }),
      prisma.activityLog.count({ where: { createdAt: { gte: day7 } } }),
      prisma.activityLog.count({ where: { createdAt: { gte: day30 } } }),
      prisma.activityLog.groupBy({
        by: ['userEmail', 'userName'],
        where: { createdAt: { gte: day7 } },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 10,
      }),
      prisma.activityLog.groupBy({
        by: ['category'],
        where: { createdAt: { gte: day7 } },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
      }),
    ]);

    res.json({
      count24h,
      count7d,
      count30d,
      topUsers: topUsers.map((u) => ({
        email: u.userEmail,
        name: u.userName,
        count: u._count.id,
      })),
      categoryBreakdown: categoryBreakdown.map((c) => ({
        category: c.category,
        count: c._count.id,
      })),
    });
  } catch (err) {
    console.error('[activity-logs] stats error:', err);
    res.status(500).json({ error: '統計情報の取得に失敗しました。' });
  }
});

export default router;
