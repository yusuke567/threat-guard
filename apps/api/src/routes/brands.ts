import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { z } from 'zod';
import { captureScreenshot } from '../services/screenshot.js';
import { runFullScan } from '../services/scheduler.js';
import path from 'node:path';
import fs from 'node:fs';
import multer from 'multer';

// Logo upload config
const DATA_DIR = process.env.DATA_DIR || process.cwd();
const logoStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const dir = path.join(DATA_DIR, 'uploads', 'logos');
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '.png';
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  },
});
const logoUpload = multer({
  storage: logoStorage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
  fileFilter: (_req, file, cb) => {
    if (/^image\/(png|jpe?g|gif|svg\+xml|webp)$/.test(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('画像ファイルのみアップロードできます'));
    }
  },
});

const router = Router();

const createBrandSchema = z.object({
  name: z.string().min(1),
  domain: z.string().min(1),
  logoUrl: z.string().url().optional(),
  keywords: z.string().default(''),
  whitelistDomains: z.string().default(''),
  organizationId: z.string().optional(),
  senderEmail: z.string().email().optional().nullable(),
  smtpHost: z.string().optional().nullable(),
  smtpPort: z.number().int().optional().nullable(),
  smtpUser: z.string().optional().nullable(),
  smtpPass: z.string().optional().nullable(),
});

const updateBrandSchema = createBrandSchema.partial();

// List brands - filtered by user's organization (superadmin sees all)
router.get('/', async (req, res) => {
  const where = req.user!.role === 'superadmin' && !req.user!.organizationId
    ? {}
    : { organizationId: req.user!.organizationId! };
  const brands = await prisma.brand.findMany({
    where,
    include: {
      organization: true,
      _count: { select: { detectedDomains: true } },
      scanJobs: {
        orderBy: { startedAt: 'desc' },
        take: 1,
        select: { id: true, type: true, status: true, startedAt: true, completedAt: true, findingsCount: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  // Flatten: add lastScan and monitoringStatus to each brand
  const enriched = brands.map((b) => {
    const lastScan = b.scanJobs[0] || null;
    let monitoringStatus: 'active' | 'inactive' | 'running' | 'error' = 'inactive';
    if (lastScan) {
      if (lastScan.status === 'running' || lastScan.status === 'pending') {
        monitoringStatus = 'running';
      } else if (lastScan.status === 'failed') {
        monitoringStatus = 'error';
      } else {
        // Active if scanned within last 7 days
        const daysSince = (Date.now() - new Date(lastScan.startedAt).getTime()) / (1000 * 60 * 60 * 24);
        monitoringStatus = daysSince <= 7 ? 'active' : 'inactive';
      }
    }
    const { scanJobs, ...rest } = b;
    return { ...rest, lastScan, monitoringStatus };
  });

  res.json(enriched);
});

// One-time sync: Brand.whitelistDomains → BrandDomain table (superadmin only)
// MUST be before /:id routes to avoid being caught by the param route
router.post('/sync-domains', async (req, res) => {
  try {
    if (req.user?.role !== 'superadmin') {
      return res.status(403).json({ error: 'superadmin権限が必要です。' });
    }

    const brands = await prisma.brand.findMany({
      include: { brandDomains: true },
    });

    const results: Array<{ brand: string; created: number; skipped: number; fixes: string[] }> = [];

    for (const brand of brands) {
      const existingDomains = new Set(brand.brandDomains.map((bd) => bd.domain.toLowerCase()));
      const whitelistDomains = (brand.whitelistDomains || '')
        .split(',')
        .map((d) => d.trim().toLowerCase())
        .filter((d) => d.length > 0 && d.includes('.'));

      const primaryDomain = brand.domain.toLowerCase();
      const allDomains = new Set([primaryDomain, ...whitelistDomains]);
      let created = 0;
      let skipped = 0;
      const fixes: string[] = [];

      for (const domain of allDomains) {
        if (existingDomains.has(domain)) {
          skipped++;
          continue;
        }
        const type = domain === primaryDomain ? 'primary' : 'owned';
        await prisma.brandDomain.create({ data: { brandId: brand.id, domain, type } });
        created++;
        fixes.push(`+${domain} (${type})`);
      }

      const existingPrimary = brand.brandDomains.find((bd) => bd.domain.toLowerCase() === primaryDomain);
      if (existingPrimary && existingPrimary.type !== 'primary') {
        await prisma.brandDomain.update({ where: { id: existingPrimary.id }, data: { type: 'primary' } });
        fixes.push(`fixed primary: ${primaryDomain}`);
      }

      results.push({ brand: brand.name, created, skipped, fixes });
    }

    const totalCreated = results.reduce((s, r) => s + r.created, 0);
    res.json({ totalBrands: brands.length, totalCreated, results });
  } catch (err) {
    console.error('Sync brand domains error:', err);
    res.status(500).json({ error: 'ドメイン同期に失敗しました。' });
  }
});

// Get brand by ID - verify ownership (superadmin can access all)
router.get('/:id', async (req, res) => {
  const where = req.user!.role === 'superadmin' && !req.user!.organizationId
    ? { id: req.params.id }
    : { id: req.params.id, organizationId: req.user!.organizationId! };
  const brand = await prisma.brand.findFirst({
    where,
    include: {
      organization: true,
      brandDomains: { orderBy: [{ type: 'asc' }, { createdAt: 'asc' }] },
      _count: { select: { detectedDomains: true, scanJobs: true } },
    },
  });
  if (!brand) return res.status(404).json({ error: '指定されたブランドが見つかりません。' });
  res.json(brand);
});

// Create brand - auto-assign to user's org (superadmin can specify organizationId)
router.post('/', async (req, res) => {
  const parsed = createBrandSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const orgId = req.user!.role === 'superadmin'
    ? (req.body.organizationId || req.user!.organizationId)
    : req.user!.organizationId;

  if (!orgId) return res.status(400).json({ error: '組織を選択してください。' });

  const brand = await prisma.brand.create({
    data: { ...parsed.data, organizationId: orgId },
  });

  // Trigger initial scan for newly created brand
  runFullScan(brand.id, brand.name).catch((err) => {
    console.error(`[Brand Create] Auto-scan failed for ${brand.name}:`, err);
  });

  res.status(201).json(brand);
});

// Update brand
router.put('/:id', async (req, res) => {
  const parsed = updateBrandSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const isSuperadmin = req.user?.role === 'superadmin' && !req.user?.organizationId;
  const orgId = req.user!.organizationId;
  const existing = await prisma.brand.findFirst({ where: isSuperadmin ? { id: req.params.id } : { id: req.params.id, organizationId: orgId! } });
  if (!existing) return res.status(404).json({ error: '指定されたブランドが見つかりません。' });

  // Detect if whitelistDomains (managed domains) changed
  const domainsChanged = parsed.data.whitelistDomains !== undefined
    && parsed.data.whitelistDomains !== existing.whitelistDomains;

  const brand = await prisma.brand.update({
    where: { id: req.params.id },
    data: parsed.data,
  });

  // Trigger background scan if domains changed
  if (domainsChanged) {
    runFullScan(brand.id, brand.name).catch((err) => {
      console.error(`[Brand Update] Auto-scan failed for ${brand.name}:`, err);
    });
  }

  res.json({ ...brand, scanTriggered: domainsChanged });
});

// Brand stats — threat summary
router.get('/:id/stats', async (req, res) => {
  try {
    const isSuperadmin = req.user?.role === 'superadmin' && !req.user?.organizationId;
    const where = isSuperadmin
      ? { id: req.params.id }
      : { id: req.params.id, organizationId: req.user!.organizationId! };
    const brand = await prisma.brand.findFirst({ where });
    if (!brand) return res.status(404).json({ error: 'ブランドが見つかりません。' });

    // Status breakdown
    const statusCounts = await prisma.detectedDomain.groupBy({
      by: ['status'],
      where: { brandId: brand.id },
      _count: { id: true },
    });

    // Risk score distribution
    const riskBands = await prisma.$queryRaw<Array<{ band: string; count: bigint }>>`
      SELECT
        CASE
          WHEN "riskScore" IS NULL THEN 'unknown'
          WHEN "riskScore" >= 80 THEN 'critical'
          WHEN "riskScore" >= 60 THEN 'high'
          WHEN "riskScore" >= 40 THEN 'medium'
          ELSE 'low'
        END AS band,
        COUNT(*)::bigint AS count
      FROM "DetectedDomain"
      WHERE "brandId" = ${brand.id}
      GROUP BY band
    `;

    // Average risk score
    const avgRisk = await prisma.detectedDomain.aggregate({
      where: { brandId: brand.id, riskScore: { not: null } },
      _avg: { riskScore: true },
    });

    // Last 30 days daily counts
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const dailyCounts = await prisma.$queryRaw<Array<{ date: string; count: bigint }>>`
      SELECT DATE("firstSeen") AS date, COUNT(*)::bigint AS count
      FROM "DetectedDomain"
      WHERE "brandId" = ${brand.id} AND "firstSeen" >= ${thirtyDaysAgo}
      GROUP BY DATE("firstSeen")
      ORDER BY date
    `;

    // Recent scan jobs
    const recentScans = await prisma.scanJob.findMany({
      where: { brandId: brand.id },
      orderBy: { startedAt: 'desc' },
      take: 10,
    });

    // Total count
    const totalThreats = statusCounts.reduce((sum, s) => sum + s._count.id, 0);

    res.json({
      totalThreats,
      statusBreakdown: Object.fromEntries(statusCounts.map((s) => [s.status, s._count.id])),
      riskDistribution: Object.fromEntries(riskBands.map((r) => [r.band, Number(r.count)])),
      averageRiskScore: avgRisk._avg.riskScore ? Math.round(avgRisk._avg.riskScore) : null,
      dailyTrend: dailyCounts.map((d) => ({ date: String(d.date).slice(0, 10), count: Number(d.count) })),
      recentScans,
    });
  } catch (err) {
    console.error('Brand stats error:', err);
    res.status(500).json({ error: '統計情報の取得に失敗しました。' });
  }
});

// Scan history with pagination
router.get('/:id/scans', async (req, res) => {
  try {
    const isSuperadmin = req.user?.role === 'superadmin' && !req.user?.organizationId;
    const where = isSuperadmin ? { id: req.params.id } : { id: req.params.id, organizationId: req.user!.organizationId! };
    const brand = await prisma.brand.findFirst({ where });
    if (!brand) return res.status(404).json({ error: 'ブランドが見つかりません。' });

    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const skip = (page - 1) * limit;

    const [scans, total] = await Promise.all([
      prisma.scanJob.findMany({
        where: { brandId: brand.id },
        orderBy: { startedAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.scanJob.count({ where: { brandId: brand.id } }),
    ]);

    res.json({
      scans,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    console.error('Scan history error:', err);
    res.status(500).json({ error: 'スキャン履歴の取得に失敗しました。' });
  }
});

// Upload brand logo
router.post('/:id/logo', logoUpload.single('logo'), async (req, res) => {
  try {
    const isSuperadmin = req.user?.role === 'superadmin' && !req.user?.organizationId;
    const where = isSuperadmin
      ? { id: req.params.id }
      : { id: req.params.id, organizationId: req.user!.organizationId! };
    const brand = await prisma.brand.findFirst({ where });
    if (!brand) return res.status(404).json({ error: 'ブランドが見つかりません。' });

    if (!req.file) return res.status(400).json({ error: 'ファイルが選択されていません。' });

    // Delete old logo if exists
    if (brand.logoUrl) {
      const oldPath = path.join(process.cwd(), brand.logoUrl.replace(/^\//, ''));
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }

    const logoUrl = `/uploads/logos/${req.file.filename}`;
    await prisma.brand.update({
      where: { id: brand.id },
      data: { logoUrl },
    });

    res.json({ logoUrl });
  } catch (err) {
    console.error('Logo upload error:', err);
    res.status(500).json({ error: 'ロゴのアップロードに失敗しました。' });
  }
});

// Delete brand logo
router.delete('/:id/logo', async (req, res) => {
  try {
    const isSuperadmin = req.user?.role === 'superadmin' && !req.user?.organizationId;
    const where = isSuperadmin
      ? { id: req.params.id }
      : { id: req.params.id, organizationId: req.user!.organizationId! };
    const brand = await prisma.brand.findFirst({ where });
    if (!brand) return res.status(404).json({ error: 'ブランドが見つかりません。' });

    if (brand.logoUrl) {
      const oldPath = path.join(process.cwd(), brand.logoUrl.replace(/^\//, ''));
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }

    await prisma.brand.update({
      where: { id: brand.id },
      data: { logoUrl: null },
    });

    res.status(204).send();
  } catch (err) {
    console.error('Logo delete error:', err);
    res.status(500).json({ error: 'ロゴの削除に失敗しました。' });
  }
});

// ──────── BrandDomain 2-layer management ────────

// List brand domains
router.get('/:id/domains', async (req, res) => {
  try {
    const isSuperadmin = req.user?.role === 'superadmin' && !req.user?.organizationId;
    const where = isSuperadmin ? { id: req.params.id } : { id: req.params.id, organizationId: req.user!.organizationId! };
    const brand = await prisma.brand.findFirst({ where });
    if (!brand) return res.status(404).json({ error: 'ブランドが見つかりません。' });

    const domains = await prisma.brandDomain.findMany({
      where: { brandId: brand.id },
      orderBy: [{ type: 'asc' }, { createdAt: 'asc' }],
    });
    res.json(domains);
  } catch (err) {
    console.error('List brand domains error:', err);
    res.status(500).json({ error: 'ドメイン一覧の取得に失敗しました。' });
  }
});

// Add brand domain
router.post('/:id/domains', async (req, res) => {
  try {
    const schema = z.object({
      domain: z.string().min(1),
      type: z.enum(['primary', 'owned']).default('owned'),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const isSuperadmin = req.user?.role === 'superadmin' && !req.user?.organizationId;
    const where = isSuperadmin ? { id: req.params.id } : { id: req.params.id, organizationId: req.user!.organizationId! };
    const brand = await prisma.brand.findFirst({ where });
    if (!brand) return res.status(404).json({ error: 'ブランドが見つかりません。' });

    const domain = parsed.data.domain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');

    // If setting as primary, demote existing primary
    if (parsed.data.type === 'primary') {
      await prisma.brandDomain.updateMany({
        where: { brandId: brand.id, type: 'primary' },
        data: { type: 'owned' },
      });
    }

    const bd = await prisma.brandDomain.upsert({
      where: { brandId_domain: { brandId: brand.id, domain } },
      update: { type: parsed.data.type },
      create: { brandId: brand.id, domain, type: parsed.data.type },
    });

    // Sync whitelistDomains field for backward compatibility
    await syncWhitelistDomains(brand.id);

    // Reclassify any existing detected domains matching this domain as false_positive
    let reclassified = 0;
    if (parsed.data.type === 'owned') {
      const result = await prisma.detectedDomain.updateMany({
        where: {
          brandId: brand.id,
          domain: { contains: domain },
          status: { not: 'false_positive' },
        },
        data: { status: 'false_positive' },
      });
      reclassified = result.count;
    }

    // Trigger background scan for the brand on domain addition
    runFullScan(brand.id, brand.name).catch((err) => {
      console.error(`[BrandDomain] Auto-scan failed for ${brand.name}:`, err);
    });

    res.status(201).json({ ...bd, scanTriggered: true, reclassified });
  } catch (err) {
    console.error('Add brand domain error:', err);
    res.status(500).json({ error: 'ドメインの追加に失敗しました。' });
  }
});

// Delete brand domain
router.delete('/:id/domains/:domainId', async (req, res) => {
  try {
    const isSuperadmin = req.user?.role === 'superadmin' && !req.user?.organizationId;
    const where = isSuperadmin ? { id: req.params.id } : { id: req.params.id, organizationId: req.user!.organizationId! };
    const brand = await prisma.brand.findFirst({ where });
    if (!brand) return res.status(404).json({ error: 'ブランドが見つかりません。' });

    const bd = await prisma.brandDomain.findFirst({ where: { id: req.params.domainId, brandId: brand.id } });
    if (!bd) return res.status(404).json({ error: 'ドメインが見つかりません。' });

    await prisma.brandDomain.delete({ where: { id: bd.id } });

    // Sync whitelistDomains field
    await syncWhitelistDomains(brand.id);

    res.status(204).send();
  } catch (err) {
    console.error('Delete brand domain error:', err);
    res.status(500).json({ error: 'ドメインの削除に失敗しました。' });
  }
});

// Bulk add brand domains
router.post('/:id/domains/bulk', async (req, res) => {
  try {
    const schema = z.object({
      domains: z.string().min(1),
      type: z.enum(['primary', 'owned']).default('owned'),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const isSuperadmin = req.user?.role === 'superadmin' && !req.user?.organizationId;
    const where = isSuperadmin ? { id: req.params.id } : { id: req.params.id, organizationId: req.user!.organizationId! };
    const brand = await prisma.brand.findFirst({ where });
    if (!brand) return res.status(404).json({ error: 'ブランドが見つかりません。' });

    // Parse domains from text (comma, semicolon, newline separated)
    const domainList = parsed.data.domains
      .split(/[,;\n\r]+/)
      .map((d) => d.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, ''))
      .filter((d) => d.length > 0 && d.includes('.'));

    const unique = [...new Set(domainList)];
    let added = 0;
    let skipped = 0;
    let reclassified = 0;

    for (const domain of unique) {
      try {
        await prisma.brandDomain.upsert({
          where: { brandId_domain: { brandId: brand.id, domain } },
          update: {},
          create: { brandId: brand.id, domain, type: parsed.data.type },
        });

        // Check if this was actually new (upsert doesn't tell us, so check creation)
        const existing = await prisma.brandDomain.findUnique({
          where: { brandId_domain: { brandId: brand.id, domain } },
        });
        // If created very recently (within last 2 seconds), count as added
        if (existing && (Date.now() - new Date(existing.createdAt).getTime()) < 2000) {
          added++;
        } else {
          skipped++;
        }

        // Reclassify matching detected domains as false_positive
        const result = await prisma.detectedDomain.updateMany({
          where: {
            brandId: brand.id,
            domain: { contains: domain },
            status: { not: 'false_positive' },
          },
          data: { status: 'false_positive' },
        });
        reclassified += result.count;
      } catch {
        skipped++;
      }
    }

    // Sync whitelistDomains
    await syncWhitelistDomains(brand.id);

    // Trigger scan if new domains were added
    if (added > 0) {
      runFullScan(brand.id, brand.name).catch((err) => {
        console.error(`[BrandDomain Bulk] Auto-scan failed for ${brand.name}:`, err);
      });
    }

    res.status(201).json({ added, skipped, reclassified, total: unique.length, scanTriggered: added > 0 });
  } catch (err) {
    console.error('Bulk add brand domains error:', err);
    res.status(500).json({ error: 'ドメインの一括追加に失敗しました。' });
  }
});

// Helper: sync BrandDomain → Brand.whitelistDomains for backward compatibility
async function syncWhitelistDomains(brandId: string) {
  const domains = await prisma.brandDomain.findMany({ where: { brandId } });
  const domainStr = domains.map((d) => d.domain).join(',');
  await prisma.brand.update({ where: { id: brandId }, data: { whitelistDomains: domainStr } });
}

// Import whitelist domains from CSV
router.post('/:id/whitelist/import', async (req, res) => {
  const schema = z.object({ csv: z.string().min(1, 'CSV data is required') });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const isSuperadmin = req.user?.role === 'superadmin' && !req.user?.organizationId;
  const orgId = req.user!.organizationId;
  const brand = await prisma.brand.findFirst({ where: isSuperadmin ? { id: req.params.id } : { id: req.params.id, organizationId: orgId! } });
  if (!brand) return res.status(404).json({ error: '指定されたブランドが見つかりません。' });

  const raw = parsed.data.csv;
  const domains = raw
    .split(/[,;\n\r]+/)
    .map((d) => d.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, ''))
    .filter((d) => d.length > 0 && d.includes('.'));

  const existing = brand.whitelistDomains
    ? brand.whitelistDomains.split(',').map((d: string) => d.trim().toLowerCase()).filter(Boolean)
    : [];

  const existingSet = new Set(existing);
  const newDomains = domains.filter((d) => !existingSet.has(d));
  const merged = [...existing, ...newDomains];

  await prisma.brand.update({
    where: { id: req.params.id },
    data: { whitelistDomains: merged.join(',') },
  });

  let reclassified = 0;
  if (newDomains.length > 0) {
    const result = await prisma.detectedDomain.updateMany({
      where: {
        brandId: req.params.id,
        domain: { in: newDomains },
        status: { not: 'false_positive' },
      },
      data: { status: 'false_positive' },
    });
    reclassified = result.count;
  }

  res.json({
    imported: newDomains.length,
    duplicatesSkipped: domains.length - newDomains.length,
    totalWhitelist: merged.length,
    reclassified,
  });
});

// Capture screenshot of brand's official site
router.post('/:id/capture-screenshot', async (req, res) => {
  try {
    const isSuperadmin = req.user?.role === 'superadmin' && !req.user?.organizationId;
    const orgId = req.user!.organizationId;
    const brand = await prisma.brand.findFirst({
      where: isSuperadmin ? { id: req.params.id } : { id: req.params.id, organizationId: orgId! },
    });
    if (!brand) return res.status(404).json({ error: '指定されたブランドが見つかりません。' });

    const filepath = await captureScreenshot(brand.domain);
    const screenshotUrl = `/screenshots/${path.basename(filepath)}`;

    await prisma.brand.update({
      where: { id: req.params.id },
      data: { screenshotUrl },
    });

    res.json({ screenshotUrl });
  } catch (err: any) {
    console.error('Brand screenshot capture failed:', err);
    res.status(500).json({ error: '正規サイトのスクリーンショット取得に失敗しました。' });
  }
});

// Delete brand
router.delete('/:id', async (req, res) => {
  const isSuperadmin = req.user?.role === 'superadmin' && !req.user?.organizationId;
  const orgId = req.user!.organizationId;
  const existing = await prisma.brand.findFirst({ where: isSuperadmin ? { id: req.params.id } : { id: req.params.id, organizationId: orgId! } });
  if (!existing) return res.status(404).json({ error: '指定されたブランドが見つかりません。' });

  await prisma.brand.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

export default router;
