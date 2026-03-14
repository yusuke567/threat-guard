import cron from 'node-cron';
import { prisma } from '../lib/prisma.js';
import { monitorBrand } from './ct-monitor.js';
import { scanDomainVariations } from './domain-generator.js';
import { analyzeThreat } from './threat-analyzer.js';
import { calculateRiskScore } from './risk-scorer.js';
import { notifyNewThreat, notifyScanSummary, notifySiteChange } from './slack-notifier.js';
import { emailNotifyNewThreat, emailNotifyScanSummary, emailNotifySiteChange } from './email-notifier.js';
import { probeDomain } from './web-prober.js';
import { analyzeContent } from './content-analyzer.js';
import { monitorTwitter } from './twitter-monitor.js';

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
              brandId,
              brandName,
              domain: domain.domain,
              riskScore: score,
              category: analysis.category,
              source: domain.source,
            });

            try {
              await emailNotifyNewThreat({
                brandId,
                brandName,
                domain: domain.domain,
                detectedDomainId: domain.id,
                riskScore: score,
                category: analysis.category,
                source: domain.source,
              });
            } catch (emailErr) {
              console.error(`[Scheduler] Email notification failed for ${domain.domain}:`, emailErr);
            }
          }
          if (score >= 80) highRiskCount++;
        } catch (err) {
          console.error(`[Scheduler] Analysis failed for ${domain.domain}:`, err);
        }
      }

      // Send scan summary
      await notifyScanSummary(brandName, newDomains.length, highRiskCount, brandId);

      try {
        await emailNotifyScanSummary(brandId, brandName, newDomains.length, highRiskCount);
      } catch (emailErr) {
        console.error(`[Scheduler] Email scan summary failed for ${brandName}:`, emailErr);
      }

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

/**
 * Run web probes for all detected domains and detect changes from previous probes.
 */
async function runWebProbes() {
  console.log(`[Scheduler] Starting web probe cycle at ${new Date().toISOString()}`);

  const domains = await prisma.detectedDomain.findMany({
    where: { status: { not: 'resolved' } },
    include: {
      brand: { select: { name: true } },
      webProbes: { orderBy: { probeAt: 'desc' }, take: 1 },
    },
  });

  if (domains.length === 0) {
    console.log('[Scheduler] No domains to probe.');
    return;
  }

  let probed = 0;
  let changes = 0;

  for (const domain of domains) {
    try {
      const previousProbe = domain.webProbes[0] ?? null;
      const newProbe = await probeDomain(domain.id);
      probed++;

      // Detect changes
      const changeDetails: string[] = [];

      if (previousProbe) {
        // Status change (e.g. went live, went down)
        if (previousProbe.httpStatus !== newProbe.httpStatus) {
          changeDetails.push(`HTTPステータス: ${previousProbe.httpStatus ?? 'N/A'} → ${newProbe.httpStatus ?? 'N/A'}`);
        }

        // Content change: new login form appeared
        if (newProbe.htmlSnippet && previousProbe.htmlSnippet) {
          const prevHasLogin = previousProbe.htmlSnippet.toLowerCase().includes('type="password"');
          const newHasLogin = newProbe.htmlSnippet.toLowerCase().includes('type="password"');
          if (!prevHasLogin && newHasLogin) {
            changeDetails.push('🔴 新規ログインフォーム出現');
          }
        }

        // DNS resolution change
        if (previousProbe.dnsResolved !== newProbe.dnsResolved) {
          changeDetails.push(`DNS: ${previousProbe.dnsResolved ? '解決済→未解決' : '未解決→解決済'}`);
        }

        // Final URL change (redirect changed)
        if (previousProbe.finalUrl !== newProbe.finalUrl && newProbe.finalUrl) {
          changeDetails.push(`リダイレクト先変更: ${newProbe.finalUrl}`);
        }
      } else {
        // First probe — if site is live, that's noteworthy
        if (newProbe.httpStatus && newProbe.httpStatus >= 200 && newProbe.httpStatus < 400) {
          changeDetails.push(`初回プローブ: サイト稼働中 (HTTP ${newProbe.httpStatus})`);
        }
      }

      if (changeDetails.length > 0) {
        changes++;
        await notifySiteChange({
          brandId: domain.brandId,
          brandName: domain.brand.name,
          domain: domain.domain,
          changes: changeDetails,
        });

        try {
          await emailNotifySiteChange({
            brandId: domain.brandId,
            brandName: domain.brand.name,
            domain: domain.domain,
            detectedDomainId: domain.id,
            riskScore: domain.riskScore ?? 0,
            changes: changeDetails,
          });
        } catch (emailErr) {
          console.error(`[Scheduler] Email site change notification failed for ${domain.domain}:`, emailErr);
        }

        // Re-analyze content and recalculate risk
        try {
          await analyzeContent(domain.id);
          await calculateRiskScore(domain.id);
        } catch (err) {
          console.error(`[Scheduler] Re-analysis failed for ${domain.domain}:`, err);
        }
      }

      // Throttle: 2s between probes
      await new Promise((r) => setTimeout(r, 2000));
    } catch (err) {
      console.error(`[Scheduler] Probe failed for ${domain.domain}:`, err);
    }
  }

  console.log(`[Scheduler] Web probe cycle complete: ${probed} probed, ${changes} changes detected`);
}

export function startScheduler() {
  const schedule = process.env.SCAN_CRON || '0 */6 * * *'; // Default: every 6 hours

  console.log(`[Scheduler] Starting with schedule: ${schedule}`);

  cron.schedule(schedule, () => {
    runScheduledScans().catch((err) => {
      console.error('[Scheduler] Scheduled scan error:', err);
    });
  });

  // Web probe schedule: offset by 3 hours from main scan
  const probeSchedule = process.env.PROBE_CRON || '0 3,9,15,21 * * *';
  console.log(`[Scheduler] Web probe schedule: ${probeSchedule}`);

  cron.schedule(probeSchedule, () => {
    runWebProbes().catch((err) => {
      console.error('[Scheduler] Web probe error:', err);
    });
  });

  // Twitter monitoring schedule: every 4 hours (offset from main scan)
  const twitterSchedule = process.env.TWITTER_CRON || '0 1,5,9,13,17,21 * * *';
  console.log(`[Scheduler] Twitter monitor schedule: ${twitterSchedule}`);

  cron.schedule(twitterSchedule, () => {
    monitorTwitter().catch((err) => {
      console.error('[Scheduler] Twitter monitor error:', err);
    });
  });

  console.log('[Scheduler] ✅ Cron scheduler active');
}
