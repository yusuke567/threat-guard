import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { probeDomain } from '../services/web-prober.js';

const router = Router();

// Trigger a probe for a detected domain
router.post('/:domainId', async (req, res) => {
  try {
    // Verify domain exists
    const domain = await prisma.detectedDomain.findUnique({
      where: { id: req.params.domainId },
    });
    if (!domain) return res.status(404).json({ error: 'Domain not found' });

    const result = await probeDomain(req.params.domainId);
    res.json(result);
  } catch (err: any) {
    console.error('Probe failed:', err);
    res.status(500).json({ error: 'Probe failed', message: err.message });
  }
});

// Get probe history for a domain
router.get('/:domainId/history', async (req, res) => {
  const { limit = '20', page = '1' } = req.query;
  const take = Number(limit);
  const skip = (Number(page) - 1) * take;

  const domain = await prisma.detectedDomain.findUnique({
    where: { id: req.params.domainId },
  });
  if (!domain) return res.status(404).json({ error: 'Domain not found' });

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
