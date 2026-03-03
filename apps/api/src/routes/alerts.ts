import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { z } from 'zod';

const router = Router();

// GET /api/alerts — list alert logs for current user (paginated)
router.get('/', async (req, res) => {
  const userId = req.user!.userId;
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
  const skip = (page - 1) * limit;

  const [alerts, total] = await Promise.all([
    prisma.alertLog.findMany({
      where: { userId },
      orderBy: { sentAt: 'desc' },
      skip,
      take: limit,
      include: {
        detectedDomain: {
          select: { domain: true, riskScore: true, brandId: true },
        },
      },
    }),
    prisma.alertLog.count({ where: { userId } }),
  ]);

  res.json({
    alerts,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
});

const updateSettingsSchema = z.object({
  alertEnabled: z.boolean().optional(),
  alertThreshold: z.number().int().min(0).max(100).optional(),
});

// GET /api/alerts/settings — get current alert settings
router.get('/settings', async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.userId },
    select: { alertEnabled: true, alertThreshold: true },
  });
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
});

// PUT /api/alerts/settings — update alert settings
router.put('/settings', async (req, res) => {
  const parsed = updateSettingsSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const user = await prisma.user.update({
    where: { id: req.user!.userId },
    data: parsed.data,
    select: { alertEnabled: true, alertThreshold: true },
  });

  res.json(user);
});

export default router;
