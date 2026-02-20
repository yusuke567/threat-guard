import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import type { DomainStatus, ThreatCategory } from '@prisma/client';

const router = Router();

// List threats with filtering and pagination
router.get('/', async (req, res) => {
  const {
    status,
    category,
    minRiskScore,
    brandId,
    sortBy = 'riskScore',
    order = 'desc',
    page = '1',
    pageSize = '20',
  } = req.query;

  const where: Record<string, unknown> = {};
  if (status) where.status = status as DomainStatus;
  if (brandId) where.brandId = String(brandId);
  if (minRiskScore) where.riskScore = { gte: Number(minRiskScore) };
  if (category) {
    where.analyses = { some: { category: category as ThreatCategory } };
  }

  const skip = (Number(page) - 1) * Number(pageSize);
  const take = Number(pageSize);

  const [data, total] = await Promise.all([
    prisma.detectedDomain.findMany({
      where,
      include: {
        brand: { select: { id: true, name: true, domain: true } },
        analyses: { orderBy: { analyzedAt: 'desc' }, take: 1 },
      },
      orderBy: { [String(sortBy)]: order },
      skip,
      take,
    }),
    prisma.detectedDomain.count({ where }),
  ]);

  res.json({
    data,
    total,
    page: Number(page),
    pageSize: take,
    totalPages: Math.ceil(total / take),
  });
});

// Get threat detail
router.get('/:id', async (req, res) => {
  const threat = await prisma.detectedDomain.findUnique({
    where: { id: req.params.id },
    include: {
      brand: { include: { organization: true } },
      analyses: { orderBy: { analyzedAt: 'desc' } },
      takedowns: { orderBy: { createdAt: 'desc' } },
    },
  });
  if (!threat) return res.status(404).json({ error: 'Threat not found' });
  res.json(threat);
});

export default router;
