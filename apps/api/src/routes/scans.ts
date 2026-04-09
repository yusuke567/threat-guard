import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { z } from 'zod';
import { monitorBrand } from '../services/ct-monitor.js';
import { scanDomainVariations } from '../services/domain-generator.js';
import { analyzeThreat } from '../services/threat-analyzer.js';
import { calculateRiskScore } from '../services/risk-scorer.js';
import { notifyNewThreat, notifyScanSummary } from '../services/slack-notifier.js';
import { lookupWhois } from '../services/whois-lookup.js';

const router = Router();

const triggerScanSchema = z.object({
  brandId: z.string().uuid(),
  type: z.enum(['ct_monitor', 'domain_generation', 'manual']),
});

// Trigger a scan - verify brand belongs to user's org
router.post('/trigger', async (req, res) => {
  const parsed = triggerScanSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const isSuperadmin = req.user?.role === 'superadmin' && !req.user?.organizationId;
  const orgId = req.user!.organizationId;
  const { brandId, type } = parsed.data;

  const brand = await prisma.brand.findFirst({ where: isSuperadmin ? { id: brandId } : { id: brandId, organizationId: orgId! } });
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
            await notifyNewThreat({ brandId, brandName: brand.name, domain: domain.domain, riskScore: score, category: analysis.category, source: domain.source });
          }
          if (score >= 80) highRiskCount++;
        } catch (err) { console.error(`Analysis failed for ${domain.domain}:`, err); }
      }

      await notifyScanSummary(brand.name, newDomains.length, highRiskCount, brandId);
      await prisma.scanJob.update({ where: { id: scanJob.id }, data: { status: 'completed', completedAt: new Date(), findingsCount } });
    } catch (error) {
      await prisma.scanJob.update({ where: { id: scanJob.id }, data: { status: 'failed', error: String(error), completedAt: new Date() } });
    }
  })();

  res.status(202).json(scanJob);
});

// List scan jobs - org filtered
router.get('/', async (req, res) => {
  const isSuperadmin = req.user?.role === 'superadmin' && !req.user?.organizationId;
  const orgId = req.user!.organizationId;
  const brandIds = isSuperadmin
    ? (await prisma.brand.findMany({ select: { id: true } })).map((b) => b.id)
    : (await prisma.brand.findMany({ where: { organizationId: orgId! }, select: { id: true } })).map((b) => b.id);

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

/**
 * POST /api/scans/backfill-whois
 * 既存DetectedDomainのwhoisData未取得レコードにRDAPデータを一括補完。
 * superadmin専用。
 */
router.post('/backfill-whois', async (req, res) => {
  if (req.user?.role !== 'superadmin') {
    return res.status(403).json({ error: 'superadmin権限が必要です。' });
  }

  const limit = Math.min(parseInt(String(req.query.limit) || '50', 10), 200);
  const delayMs = parseInt(String(req.query.delay) || '2000', 10);
  const refresh = req.query.refresh === 'true';

  const where = refresh ? {} : { whoisData: null };
  const targets = await prisma.detectedDomain.findMany({
    where,
    select: { id: true, domain: true },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  const totalTarget = await prisma.detectedDomain.count({ where });

  // Run in background
  (async () => {
    let success = 0;
    let failed = 0;
    for (const target of targets) {
      try {
        const result = await lookupWhois(target.id, { force: refresh });
        if (result) success++;
        else failed++;
      } catch {
        failed++;
      }
      await new Promise((r) => setTimeout(r, delayMs));
    }
    console.log(
      `[BackfillWhois] 完了: 成功=${success}, 失敗=${failed}, 対象=${targets.length}, refresh=${refresh}`,
    );
  })();

  res.status(202).json({
    message: `${targets.length}件のWHOIS${refresh ? 'リフレッシュ' : 'バックフィル'}を開始しました（全${totalTarget}件中）`,
    processing: targets.length,
    totalTarget,
    refresh,
  });
});

export default router;
