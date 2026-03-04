import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { getAbuseContacts } from '../services/whois-abuse.js';
import { analyzeContent } from '../services/content-analyzer.js';
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

// List threats - filtered by organization
router.get('/', async (req, res) => {
  try {
  const brandIds = await orgBrandIds(req);

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

  const where: Record<string, unknown> = { brandId: { in: brandIds } };
  if (status) where.status = String(status);
  if (brandId && brandIds.includes(String(brandId))) {
    where.brandId = String(brandId);
  }
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

  res.json({ data, total, page: Number(page), pageSize: take, totalPages: Math.ceil(total / take) });
  } catch (err) {
    console.error('Threats list error:', err);
    res.status(500).json({ error: '脅威一覧の取得に失敗しました。しばらくしてからもう一度お試しください。' });
  }
});

// Get threat detail - verify org ownership
router.get('/:id', async (req, res) => {
  const orgId = req.user!.organizationId!;
  const threat = await prisma.detectedDomain.findUnique({
    where: { id: req.params.id },
    include: {
      brand: { include: { organization: true } },
      analyses: { orderBy: { analyzedAt: 'desc' } },
      takedowns: { orderBy: { createdAt: 'desc' } },
      webProbes: { orderBy: { probeAt: 'desc' }, take: 5 },
    },
  });
  if (!threat || threat.brand.organizationId !== orgId) {
    return res.status(404).json({ error: '指定された脅威情報が見つかりません。' });
  }
  res.json(threat);
});

// Content analysis - verify org
router.get('/:id/content-analysis', async (req, res) => {
  try {
    const orgId = req.user!.organizationId!;
    const domain = await prisma.detectedDomain.findUnique({
      where: { id: req.params.id },
      include: { brand: { select: { organizationId: true } } },
    });
    if (!domain || domain.brand.organizationId !== orgId) {
      return res.status(404).json({ error: '指定された脅威情報が見つかりません。' });
    }
    const result = await analyzeContent(req.params.id);
    res.json(result);
  } catch (err: any) {
    if (err.code === 'P2025') return res.status(404).json({ error: '指定された脅威情報が見つかりません。' });
    console.error('Content analysis failed:', err);
    res.status(500).json({ error: 'コンテンツの分析に失敗しました。しばらくしてからもう一度お試しください。' });
  }
});

// Abuse contacts - verify org
router.get('/:id/abuse-contacts', async (req, res) => {
  try {
    const orgId = req.user!.organizationId!;
    const domain = await prisma.detectedDomain.findUnique({
      where: { id: req.params.id },
      include: { brand: { select: { organizationId: true } } },
    });
    if (!domain || domain.brand.organizationId !== orgId) {
      return res.status(404).json({ error: '指定された脅威情報が見つかりません。' });
    }
    const contacts = await getAbuseContacts(req.params.id);
    res.json(contacts);
  } catch (err: any) {
    if (err.code === 'P2025') return res.status(404).json({ error: '指定された脅威情報が見つかりません。' });
    console.error('Abuse contact lookup failed:', err);
    res.status(500).json({ error: '通報先の連絡先情報を取得できませんでした。しばらくしてからもう一度お試しください。' });
  }
});

export default router;
