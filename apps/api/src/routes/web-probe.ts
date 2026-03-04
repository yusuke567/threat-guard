import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { probeDomain } from '../services/web-prober.js';

const router = Router();

// Helper: verify detectedDomain belongs to user's org
async function verifyDomainOrg(domainId: string, organizationId: string) {
  return prisma.detectedDomain.findFirst({
    where: { id: domainId, brand: { organizationId } },
  });
}

// Trigger a probe for a detected domain
router.post('/:domainId', async (req, res) => {
  try {
    const orgId = req.user!.organizationId!;
    const domain = await verifyDomainOrg(req.params.domainId, orgId);
    if (!domain) return res.status(404).json({ error: '指定されたドメインが見つかりません。' });

    const result = await probeDomain(req.params.domainId);
    res.json(result);
  } catch (err: any) {
    console.error('Probe failed:', err);
    res.status(500).json({ error: 'サイトの調査に失敗しました。しばらくしてからもう一度お試しください。', message: err.message });
  }
});

// Get probe history for a domain
router.get('/:domainId/history', async (req, res) => {
  const orgId = req.user!.organizationId!;
  const { limit = '20', page = '1' } = req.query;
  const take = Number(limit);
  const skip = (Number(page) - 1) * take;

  const domain = await verifyDomainOrg(req.params.domainId, orgId);
  if (!domain) return res.status(404).json({ error: '指定されたドメインが見つかりません。' });

  const [data, total] = await Promise.all([
    prisma.webProbe.findMany({
      where: { detectedDomainId: req.params.domainId },
      orderBy: { probeAt: 'desc' },
      skip,
      take,
    }),
    prisma.webProbe.count({
      where: { detectedDomainId: req.params.domainId },
    }),
  ]);

  res.json({ data, total, page: Number(page), pageSize: take });
});

export default router;
