import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { getAbuseContacts } from '../services/whois-abuse.js';
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
  if (status) where.status = String(status);
  if (brandId) where.brandId = String(brandId);
  if (minRiskScore) where.riskScore = { gte: Number(minRiskScore) };
  if (category) {
    where.analyses = { some: { category: String(category) } };
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

// Get abuse contacts for a threat
router.get('/:id/abuse-contacts', async (req, res) => {
  try {
    const contacts = await getAbuseContacts(req.params.id);
    res.json(contacts);
  } catch (err: any) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Threat not found' });
    console.error('Abuse contact lookup failed:', err);
    res.status(500).json({ error: 'Abuse contact lookup failed' });
  }
});

export default router;
