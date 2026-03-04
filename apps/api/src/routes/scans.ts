import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { z } from 'zod';
import { monitorBrand } from '../services/ct-monitor.js';
import { scanDomainVariations } from '../services/domain-generator.js';
import { analyzeThreat } from '../services/threat-analyzer.js';
import { calculateRiskScore } from '../services/risk-scorer.js';
import { notifyNewThreat, notifyScanSummary } from '../services/slack-notifier.js';

const router = Router();

const triggerScanSchema = z.object({
  brandId: z.string().uuid(),
  type: z.enum(['ct_monitor', 'domain_generation', 'manual']),
});

// Trigger a scan - verify brand belongs to user's org
router.post('/trigger', async (req, res) => {
  const parsed = triggerScanSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const orgId = req.user!.organizationId!;
  const { brandId, type } = parsed.data;

  const brand = await prisma.brand.findFirst({ where: { id: brandId, organizationId: orgId } });
  if (!brand) return res.status(404).json({ error: '指定されたブランドが見つかりません。' });

  const scanJob = await prisma.scanJob.create({ data: { brandId, type, status: 'running' } });

  (async () => {
    try {
      let findingsCount = 0;
      if (type === 'ct_monitor') findingsCount = await monitorBrand(brandId);
      else if (type === 'domain_generation') findingsCount = await scanDomainVariations(brandId);

      const newDomains = await prisma.detectedDomain.findMany({ where: { brandId, status: 'new_domain' } });
      let highRiskCount = 0;

      for (const domain of newDomains) {
        try {
          const analysis = await analyzeThreat(domain.id);
          const score = await calculateRiskScore(domain.id);
          if (score >= 60) {
            await notifyNewThreat({ brandName: brand.name, domain: domain.domain, riskScore: score, category: analysis.category, source: domain.source });
          }
          if (score >= 80) highRiskCount++;
        } catch (err) { console.error(`Analysis failed for ${domain.domain}:`, err); }
      }

      await notifyScanSummary(brand.name, newDomains.length, highRiskCount);
      await prisma.scanJob.update({ where: { id: scanJob.id }, data: { status: 'completed', completedAt: new Date(), findingsCount } });
    } catch (error) {
      await prisma.scanJob.update({ where: { id: scanJob.id }, data: { status: 'failed', error: String(error), completedAt: new Date() } });
    }
  })();

  res.status(202).json(scanJob);
});

// List scan jobs - org filtered
router.get('/', async (req, res) => {
  const orgId = req.user!.organizationId!;
  const brandIds = (await prisma.brand.findMany({ where: { organizationId: orgId }, select: { id: true } })).map((b) => b.id);

  const { brandId } = req.query;
  const where: Record<string, unknown> = { brandId: { in: brandIds } };
  if (brandId && brandIds.includes(String(brandId))) where.brandId = String(brandId);

  const jobs = await prisma.scanJob.findMany({
    where,
    include: { brand: { select: { name: true } } },
    orderBy: { startedAt: 'desc' },
    take: 50,
  });
  res.json(jobs);
});

export default router;
