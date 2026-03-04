import { Router } from 'express';
import { prisma } from '../lib/prisma.js';

const router = Router();

router.get('/stats', async (req, res) => {
  try {
    const isSuperAdmin = req.user!.role === 'superadmin' && !req.user!.organizationId;

    // Get org's brand IDs (superadmin sees all)
    const orgBrands = await prisma.brand.findMany({
      where: isSuperAdmin ? {} : { organizationId: req.user!.organizationId! },
      select: { id: true, name: true },
    });
    const brandIds = orgBrands.map((b) => b.id);

    // Threat counts by risk level - filtered by org
    const threats = await prisma.detectedDomain.findMany({
      where: { brandId: { in: brandIds } },
      select: { riskScore: true, brandId: true, status: true, firstSeen: true },
    });

    const riskCounts = { danger: 0, high: 0, medium: 0, low: 0 };
    for (const t of threats) {
      const s = t.riskScore ?? 0;
      if (s >= 80) riskCounts.danger++;
      else if (s >= 60) riskCounts.high++;
      else if (s >= 40) riskCounts.medium++;
      else riskCounts.low++;
    }

    // Brand breakdown
    const brands = await prisma.brand.findMany({
      where: isSuperAdmin ? {} : { organizationId: req.user!.organizationId! },
      select: { id: true, name: true, _count: { select: { detectedDomains: true } } },
    });
    const brandBreakdown = brands.map((b) => ({ name: b.name, count: b._count.detectedDomains }));

    // Takedown stats - org only
    const takedowns = await prisma.takedownRequest.groupBy({
      by: ['status'],
      where: { detectedDomain: { brandId: { in: brandIds } } },
      _count: true,
    });
    const takedownStats: Record<string, number> = {};
    for (const t of takedowns) takedownStats[t.status] = t._count;

    // Timeline
    const timeline: Record<string, number> = {};
    for (const t of threats) {
      const date = t.firstSeen.toISOString().split('T')[0];
      timeline[date] = (timeline[date] || 0) + 1;
    }
    const timelineData = Object.entries(timeline)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({ date, count }));

    // Category breakdown - org only
    const analyses = await prisma.threatAnalysis.groupBy({
      by: ['category'],
      where: { detectedDomain: { brandId: { in: brandIds } } },
      _count: true,
    });
    const categoryBreakdown = analyses.map((a) => ({ category: a.category, count: a._count }));

    // Recent changes - org only
    const since = new Date(Date.now() - 48 * 60 * 60 * 1000);
    const recentProbes = await prisma.webProbe.findMany({
      where: { probeAt: { gte: since }, detectedDomain: { brandId: { in: brandIds } } },
      orderBy: { probeAt: 'desc' },
      take: 50,
      include: { detectedDomain: { select: { domain: true, brand: { select: { name: true } } } } },
    });

    const domainProbes = new Map<string, typeof recentProbes>();
    for (const p of recentProbes) {
      const key = p.detectedDomainId;
      if (!domainProbes.has(key)) domainProbes.set(key, []);
      domainProbes.get(key)!.push(p);
    }

    const recentChanges: Array<{ domain: string; brandName: string; change: string; detectedAt: string }> = [];
    for (const [, probes] of domainProbes) {
      if (probes.length < 2) continue;
      const [latest, previous] = probes;
      const changes: string[] = [];
      if (latest.httpStatus !== previous.httpStatus)
        changes.push(`HTTP ${previous.httpStatus ?? 'N/A'} → ${latest.httpStatus ?? 'N/A'}`);
      if (latest.dnsResolved !== previous.dnsResolved)
        changes.push(latest.dnsResolved ? 'DNS復旧' : 'DNS消失');
      if (latest.htmlSnippet && previous.htmlSnippet) {
        const prevLogin = previous.htmlSnippet.toLowerCase().includes('type="password"');
        const newLogin = latest.htmlSnippet.toLowerCase().includes('type="password"');
        if (!prevLogin && newLogin) changes.push('ログインフォーム出現');
      }
      for (const c of changes) {
        recentChanges.push({
          domain: latest.detectedDomain.domain,
          brandName: latest.detectedDomain.brand.name,
          change: c,
          detectedAt: latest.probeAt.toISOString(),
        });
      }
    }

    res.json({
      riskCounts,
      brandBreakdown,
      takedownStats,
      timelineData,
      categoryBreakdown,
      totalThreats: threats.length,
      recentChanges: recentChanges.sort((a, b) => b.detectedAt.localeCompare(a.detectedAt)).slice(0, 20),
    });
  } catch (err) {
    console.error('Dashboard stats error:', err);
    res.status(500).json({ error: 'ダッシュボードの読み込みに失敗しました。しばらくしてからもう一度お試しください。' });
  }
});

export default router;
