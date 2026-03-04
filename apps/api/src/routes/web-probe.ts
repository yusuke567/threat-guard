import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { probeDomain } from '../services/web-prober.js';

const router = Router();

// Helper: verify detectedDomain belongs to user's org (superadmin bypasses)
async function verifyDomainOrg(domainId: string, organizationId: string | null, isSuperadmin: boolean) {
  if (isSuperadmin) {
    return prisma.detectedDomain.findFirst({ where: { id: domainId } });
  }
  return prisma.detectedDomain.findFirst({
    where: { id: domainId, brand: { organizationId: organizationId! } },
  });
}

// Trigger a probe for a detected domain
router.post('/:domainId', async (req, res) => {
  try {
    const isSuperadmin = req.user?.role === 'superadmin' && !req.user?.organizationId;
    const orgId = req.user!.organizationId;
    const domain = await verifyDomainOrg(req.params.domainId, orgId, isSuperadmin);
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
  const isSuperadmin = req.user?.role === 'superadmin' && !req.user?.organizationId;
  const orgId = req.user!.organizationId;
  const { limit = '20', page = '1' } = req.query;
  const take = Number(limit);
  const skip = (Number(page) - 1) * take;

  const domain = await verifyDomainOrg(req.params.domainId, orgId, isSuperadmin);
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
