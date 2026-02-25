import { Router } from 'express';
import { prisma } from '../lib/prisma.js';

const router = Router();

// GET /api/reports/generate?type=regulatory|board|clo&brandId=xxx
router.get('/generate', async (req, res) => {
  try {
    const { type, brandId } = req.query;

    if (!type || !['regulatory', 'board', 'clo'].includes(String(type))) {
      return res.status(400).json({ error: 'type must be regulatory, board, or clo' });
    }

    const where: Record<string, unknown> = {};
    if (brandId) where.brandId = String(brandId);

    const reportType = String(type);

    // Common: brands for filter
    const brands = await prisma.brand.findMany({
      select: { id: true, name: true, domain: true },
    });

    if (reportType === 'regulatory') {
      return res.json(await generateRegulatoryReport(where));
    } else if (reportType === 'board') {
      return res.json(await generateBoardReport(where));
    } else {
      return res.json(await generateCloReport(where));
    }
  } catch (err) {
    console.error('Report generation error:', err);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

async function generateRegulatoryReport(where: Record<string, unknown>) {
  const threats = await prisma.detectedDomain.findMany({
    where,
    include: {
      brand: { select: { name: true, domain: true } },
      analyses: true,
      takedowns: true,
      webProbes: { orderBy: { probeAt: 'desc' }, take: 1 },
    },
    orderBy: { riskScore: 'desc' },
  });

  const takedowns = await prisma.takedownRequest.findMany({
    where: where.brandId ? { detectedDomain: { brandId: String(where.brandId) } } : {},
    include: { detectedDomain: { select: { domain: true } } },
    orderBy: { createdAt: 'desc' },
  });

  const timeline = buildTimeline(threats);

  return {
    type: 'regulatory',
    title: '行政機関向け 脅威対応報告書',
    generatedAt: new Date().toISOString(),
    summary: {
      totalThreats: threats.length,
      dangerCount: threats.filter((t) => (t.riskScore ?? 0) >= 80).length,
      highCount: threats.filter((t) => (t.riskScore ?? 0) >= 60 && (t.riskScore ?? 0) < 80).length,
      takedownsSent: takedowns.filter((t) => t.status !== 'draft').length,
      takedownsCompleted: takedowns.filter((t) => t.status === 'completed').length,
    },
    threats: threats.map((t) => ({
      domain: t.domain,
      brandName: t.brand.name,
      riskScore: t.riskScore,
      status: t.status,
      firstSeen: t.firstSeen,
      lastSeen: t.lastSeen,
      screenshotUrl: t.screenshotUrl,
      whoisData: t.whoisData ? JSON.parse(t.whoisData) : null,
      analyses: t.analyses.map((a) => ({
        category: a.category,
        confidence: a.confidence,
        reasoning: a.reasoning,
      })),
      takedowns: t.takedowns.map((td) => ({
        status: td.status,
        registrar: td.registrar,
        sentAt: td.sentAt,
        respondedAt: td.respondedAt,
      })),
      latestProbe: t.webProbes[0]
        ? {
            httpStatus: t.webProbes[0].httpStatus,
            dnsResolved: t.webProbes[0].dnsResolved,
            ip: t.webProbes[0].ip,
          }
        : null,
    })),
    timeline,
  };
}

async function generateBoardReport(where: Record<string, unknown>) {
  const threats = await prisma.detectedDomain.findMany({
    where,
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

  const brands = await prisma.brand.findMany({
    where: where.brandId ? { id: String(where.brandId) } : {},
    select: { id: true, name: true, _count: { select: { detectedDomains: true } } },
  });

  const takedowns = await prisma.takedownRequest.groupBy({
    by: ['status'],
    _count: true,
  });
  const takedownStats: Record<string, number> = {};
  for (const t of takedowns) {
    takedownStats[t.status] = t._count;
  }
  const totalTakedowns = Object.values(takedownStats).reduce((a, b) => a + b, 0);
  const completedTakedowns = takedownStats['completed'] || 0;

  const timeline = buildTimeline(threats);

  // Category breakdown
  const analyses = await prisma.threatAnalysis.groupBy({
    by: ['category'],
    _count: true,
  });

  return {
    type: 'board',
    title: '取締役会向け ブランド保護KPIレポート',
    generatedAt: new Date().toISOString(),
    kpi: {
      totalThreats: threats.length,
      riskCounts,
      takedownSuccessRate: totalTakedowns > 0 ? Math.round((completedTakedowns / totalTakedowns) * 100) : 0,
      takedownStats,
    },
    brandBreakdown: brands.map((b) => ({
      name: b.name,
      count: b._count.detectedDomains,
    })),
    categoryBreakdown: analyses.map((a) => ({
      category: a.category,
      count: a._count,
    })),
    timeline,
  };
}

async function generateCloReport(where: Record<string, unknown>) {
  // High-risk threats only (score >= 60)
  const highRiskWhere = { ...where, riskScore: { gte: 60 } };

  const threats = await prisma.detectedDomain.findMany({
    where: highRiskWhere,
    include: {
      brand: { select: { name: true, domain: true } },
      analyses: true,
      takedowns: true,
    },
    orderBy: { riskScore: 'desc' },
  });

  // Registrar breakdown
  const registrarMap = new Map<string, number>();
  for (const t of threats) {
    for (const td of t.takedowns) {
      registrarMap.set(td.registrar, (registrarMap.get(td.registrar) || 0) + 1);
    }
  }

  const LEGAL_CATEGORIES: Record<string, string> = {
    phishing: '不正競争防止法違反（詐欺的誘引）',
    brand_abuse: '商標権侵害',
    parked: 'ドメイン不正占拠（サイバースクワッティング）',
    unknown: '調査中',
    legitimate: '侵害なし',
  };

  return {
    type: 'clo',
    title: 'CLO向け 法的リスク報告書',
    generatedAt: new Date().toISOString(),
    summary: {
      highRiskCount: threats.length,
      categoryCounts: threats.reduce(
        (acc, t) => {
          for (const a of t.analyses) {
            acc[a.category] = (acc[a.category] || 0) + 1;
          }
          return acc;
        },
        {} as Record<string, number>,
      ),
    },
    threats: threats.map((t) => ({
      domain: t.domain,
      brandName: t.brand.name,
      riskScore: t.riskScore,
      status: t.status,
      firstSeen: t.firstSeen,
      legalCategories: t.analyses.map((a) => ({
        category: a.category,
        legalBasis: LEGAL_CATEGORIES[a.category] || '調査中',
        confidence: a.confidence,
      })),
      takedownStatus: t.takedowns.length > 0 ? t.takedowns[0].status : 'none',
      priority: (t.riskScore ?? 0) >= 80 ? '最優先' : '要対応',
    })),
    registrarBreakdown: Array.from(registrarMap.entries())
      .map(([registrar, count]) => ({ registrar, count }))
      .sort((a, b) => b.count - a.count),
  };
}

function buildTimeline(threats: Array<{ firstSeen: Date }>) {
  const timeline: Record<string, number> = {};
  for (const t of threats) {
    const date = t.firstSeen.toISOString().split('T')[0];
    timeline[date] = (timeline[date] || 0) + 1;
  }
  return Object.entries(timeline)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date, count }));
}

export default router;
