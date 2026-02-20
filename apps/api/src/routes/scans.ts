import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { z } from 'zod';
import { monitorBrand } from '../services/ct-monitor.js';
import { scanDomainVariations } from '../services/domain-generator.js';
import { analyzeThreat } from '../services/threat-analyzer.js';
import { calculateRiskScore } from '../services/risk-scorer.js';

const router = Router();

const triggerScanSchema = z.object({
  brandId: z.string().uuid(),
  type: z.enum(['ct_monitor', 'domain_generation', 'manual']),
});

// Trigger a scan
router.post('/trigger', async (req, res) => {
  const parsed = triggerScanSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { brandId, type } = parsed.data;

  // Create scan job
  const scanJob = await prisma.scanJob.create({
    data: { brandId, type, status: 'running' },
  });

  // Run scan in background
  (async () => {
    try {
      let findingsCount = 0;

      if (type === 'ct_monitor') {
        findingsCount = await monitorBrand(brandId);
      } else if (type === 'domain_generation') {
        findingsCount = await scanDomainVariations(brandId);
      }

      // Analyze new domains
      const newDomains = await prisma.detectedDomain.findMany({
        where: { brandId, status: 'new_domain' },
      });

      for (const domain of newDomains) {
        try {
          await analyzeThreat(domain.id);
          await calculateRiskScore(domain.id);
        } catch (err) {
          console.error(`Analysis failed for ${domain.domain}:`, err);
        }
      }

      await prisma.scanJob.update({
        where: { id: scanJob.id },
        data: { status: 'completed', completedAt: new Date(), findingsCount },
      });
    } catch (error) {
      await prisma.scanJob.update({
        where: { id: scanJob.id },
        data: { status: 'failed', error: String(error), completedAt: new Date() },
      });
    }
  })();

  res.status(202).json(scanJob);
});

// List scan jobs
router.get('/', async (req, res) => {
  const { brandId } = req.query;
  const jobs = await prisma.scanJob.findMany({
    where: brandId ? { brandId: String(brandId) } : undefined,
    include: { brand: { select: { name: true } } },
    orderBy: { startedAt: 'desc' },
    take: 50,
  });
  res.json(jobs);
});

export default router;
