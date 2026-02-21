import cron from 'node-cron';
import { prisma } from '../lib/prisma.js';
import { monitorBrand } from './ct-monitor.js';
import { scanDomainVariations } from './domain-generator.js';
import { analyzeThreat } from './threat-analyzer.js';
import { calculateRiskScore } from './risk-scorer.js';
import { notifyNewThreat, notifyScanSummary } from './slack-notifier.js';

async function runFullScan(brandId: string, brandName: string) {
  console.log(`[Scheduler] Starting scan for brand: ${brandName} (${brandId})`);

  for (const type of ['ct_monitor', 'domain_generation'] as const) {
    const scanJob = await prisma.scanJob.create({
      data: { brandId, type, status: 'running' },
    });

    try {
      let findingsCount = 0;

      if (type === 'ct_monitor') {
        findingsCount = await monitorBrand(brandId);
      } else {
        findingsCount = await scanDomainVariations(brandId);
      }

      // Analyze new domains and send alerts
      const newDomains = await prisma.detectedDomain.findMany({
        where: { brandId, status: 'new_domain' },
      });

      let highRiskCount = 0;

      for (const domain of newDomains) {
        try {
          const analysis = await analyzeThreat(domain.id);
          const score = await calculateRiskScore(domain.id);

          if (score >= 60) {
            await notifyNewThreat({
              brandName,
              domain: domain.domain,
              riskScore: score,
              category: analysis.category,
              source: domain.source,
            });
          }
          if (score >= 80) highRiskCount++;
        } catch (err) {
          console.error(`[Scheduler] Analysis failed for ${domain.domain}:`, err);
        }
      }

      // Send scan summary
      await notifyScanSummary(brandName, newDomains.length, highRiskCount);

      await prisma.scanJob.update({
        where: { id: scanJob.id },
        data: { status: 'completed', completedAt: new Date(), findingsCount },
      });

      console.log(`[Scheduler] ${type} scan completed for ${brandName}: ${findingsCount} findings`);
    } catch (error) {
      console.error(`[Scheduler] ${type} scan failed for ${brandName}:`, error);
      await prisma.scanJob.update({
        where: { id: scanJob.id },
        data: { status: 'failed', error: String(error), completedAt: new Date() },
      });
    }
  }
}

async function runScheduledScans() {
  console.log(`[Scheduler] Running scheduled scans at ${new Date().toISOString()}`);

  const brands = await prisma.brand.findMany();

  if (brands.length === 0) {
    console.log('[Scheduler] No active brands found, skipping.');
    return;
  }

  for (const brand of brands) {
    await runFullScan(brand.id, brand.name);
  }

  console.log(`[Scheduler] All scans completed for ${brands.length} brands.`);
}

export function startScheduler() {
  const schedule = process.env.SCAN_CRON || '0 */6 * * *'; // Default: every 6 hours

  console.log(`[Scheduler] Starting with schedule: ${schedule}`);

  cron.schedule(schedule, () => {
    runScheduledScans().catch((err) => {
      console.error('[Scheduler] Scheduled scan error:', err);
    });
  });

  console.log('[Scheduler] ✅ Cron scheduler active');
}
