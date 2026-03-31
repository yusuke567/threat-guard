import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { z } from 'zod';
import { captureScreenshot } from '../services/screenshot.js';
import { runFullScan } from '../services/scheduler.js';
import path from 'node:path';
import fs from 'node:fs';
import multer from 'multer';
import sharp from 'sharp';

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

// Trademark certificate upload config
const trademarkStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const dir = path.join(DATA_DIR, 'uploads', 'trademark-certs');
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '.pdf';
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  },
});
const trademarkUpload = multer({
  storage: trademarkStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (_req, file, cb) => {
    if (/^(image\/(png|jpe?g|webp)|application\/pdf)$/.test(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('PDF または画像ファイル（PNG, JPEG, WebP）のみアップロードできます'));
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

    // Validate minimum resolution (200x200px) — skip for SVG
    if (!/\.svg$/i.test(req.file.filename)) {
      try {
        const metadata = await sharp(req.file.path).metadata();
        if (!metadata.width || !metadata.height || metadata.width < 200 || metadata.height < 200) {
          // Remove uploaded file
          fs.unlinkSync(req.file.path);
          return res.status(400).json({
            error: `画像の解像度が不足しています。最小 200×200px 必要です（現在: ${metadata.width || 0}×${metadata.height || 0}px）。`,
          });
        }
      } catch (imgErr) {
        fs.unlinkSync(req.file.path);
        return res.status(400).json({ error: '画像ファイルの読み取りに失敗しました。' });
      }
    }

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

// Upload trademark certificate
router.post('/:id/trademark-cert', trademarkUpload.single('file'), async (req, res) => {
  try {
    const isSuperadmin = req.user?.role === 'superadmin' && !req.user?.organizationId;
    const where = isSuperadmin
      ? { id: req.params.id }
      : { id: req.params.id, organizationId: req.user!.organizationId! };
    const brand = await prisma.brand.findFirst({ where });
    if (!brand) return res.status(404).json({ error: 'ブランドが見つかりません。' });

    if (!req.file) return res.status(400).json({ error: 'ファイルが選択されていません。' });

    // Delete old file if exists
    if (brand.trademarkCertUrl) {
      const oldPath = path.join(DATA_DIR, brand.trademarkCertUrl.replace(/^\//, ''));
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }

    const trademarkCertUrl = `/uploads/trademark-certs/${req.file.filename}`;
    await prisma.brand.update({
      where: { id: brand.id },
      data: { trademarkCertUrl },
    });

    res.json({ trademarkCertUrl, originalName: req.file.originalname });
  } catch (err) {
    console.error('Trademark cert upload error:', err);
    res.status(500).json({ error: '商標登録証明のアップロードに失敗しました。' });
  }
});

// Delete trademark certificate
router.delete('/:id/trademark-cert', async (req, res) => {
  try {
    const isSuperadmin = req.user?.role === 'superadmin' && !req.user?.organizationId;
    const where = isSuperadmin
      ? { id: req.params.id }
      : { id: req.params.id, organizationId: req.user!.organizationId! };
    const brand = await prisma.brand.findFirst({ where });
    if (!brand) return res.status(404).json({ error: 'ブランドが見つかりません。' });

    if (brand.trademarkCertUrl) {
      const oldPath = path.join(DATA_DIR, brand.trademarkCertUrl.replace(/^\//, ''));
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }

    await prisma.brand.update({
      where: { id: brand.id },
      data: { trademarkCertUrl: null },
    });

    res.status(204).send();
  } catch (err) {
    console.error('Trademark cert delete error:', err);
    res.status(500).json({ error: '商標登録証明の削除に失敗しました。' });
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
    const brand = await prisma.brand.findFirst({ where, include: { organization: true } });
    if (!brand) return res.status(404).json({ error: 'ブランドが見つかりません。' });

    const domain = parsed.data.domain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');

    // Check for duplicate domain within the same organization
    const existingDomainInOrg = await prisma.brandDomain.findFirst({
      where: {
        domain,
        brand: {
          organizationId: brand.organizationId,
          id: { not: brand.id }, // Exclude current brand
        },
      },
      include: { brand: true },
    });
    if (existingDomainInOrg) {
      return res.status(409).json({
        error: `このドメインは既に同じ組織内の別のブランド「${existingDomainInOrg.brand.name}」に登録されています。`,
        duplicateBrand: existingDomainInOrg.brand.name,
        duplicateBrandId: existingDomainInOrg.brandId,
      });
    }

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
    const duplicates: Array<{ domain: string; brandName: string }> = [];

    // Pre-fetch existing domains in the same organization (excluding current brand)
    const existingOrgDomains = await prisma.brandDomain.findMany({
      where: {
        domain: { in: unique },
        brand: {
          organizationId: brand.organizationId,
          id: { not: brand.id },
        },
      },
      include: { brand: { select: { name: true } } },
    });
    const orgDomainMap = new Map(existingOrgDomains.map((d) => [d.domain, d.brand.name]));

    for (const domain of unique) {
      // Check for duplicate in the same organization
      const existingBrandName = orgDomainMap.get(domain);
      if (existingBrandName) {
        duplicates.push({ domain, brandName: existingBrandName });
        skipped++;
        continue;
      }

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

    res.status(201).json({
      added,
      skipped,
      reclassified,
      total: unique.length,
      scanTriggered: added > 0,
      duplicates: duplicates.length > 0 ? duplicates : undefined,
      duplicateMessage: duplicates.length > 0
        ? `${duplicates.length}件のドメインが同じ組織内の別ブランドに既に登録されているためスキップしました。`
        : undefined,
    });
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

  // Check for duplicates in the same organization (excluding current brand)
  const existingOrgDomains = await prisma.brandDomain.findMany({
    where: {
      domain: { in: newDomains },
      brand: {
        organizationId: brand.organizationId,
        id: { not: brand.id },
      },
    },
    include: { brand: { select: { name: true } } },
  });
  const orgDomainMap = new Map(existingOrgDomains.map((d) => [d.domain, d.brand.name]));

  const duplicatesInOrg: Array<{ domain: string; brandName: string }> = [];
  const nonDuplicateDomains: string[] = [];
  for (const domain of newDomains) {
    const existingBrandName = orgDomainMap.get(domain);
    if (existingBrandName) {
      duplicatesInOrg.push({ domain, brandName: existingBrandName });
    } else {
      nonDuplicateDomains.push(domain);
    }
  }

  const merged = [...existing, ...nonDuplicateDomains];

  await prisma.brand.update({
    where: { id: req.params.id },
    data: { whitelistDomains: merged.join(',') },
  });

  let reclassified = 0;
  if (nonDuplicateDomains.length > 0) {
    const result = await prisma.detectedDomain.updateMany({
      where: {
        brandId: req.params.id,
        domain: { in: nonDuplicateDomains },
        status: { not: 'false_positive' },
      },
      data: { status: 'false_positive' },
    });
    reclassified = result.count;
  }

  res.json({
    imported: nonDuplicateDomains.length,
    duplicatesSkipped: domains.length - newDomains.length,
    duplicatesInOrg: duplicatesInOrg.length,
    totalWhitelist: merged.length,
    reclassified,
    duplicates: duplicatesInOrg.length > 0 ? duplicatesInOrg : undefined,
    duplicateMessage: duplicatesInOrg.length > 0
      ? `${duplicatesInOrg.length}件のドメインが同じ組織内の別ブランドに既に登録されているためスキップしました。`
      : undefined,
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

// CSV bulk import brands (MUST be before /:id routes)
// Note: This is placed at the end but the route path '/import-csv' won't conflict with '/:id'
router.post('/import-csv', async (req, res) => {
  try {
    const { csv } = req.body;
    if (!csv || typeof csv !== 'string') {
      return res.status(400).json({ error: 'CSVデータが必要です。' });
    }

    const isSuperadmin = req.user?.role === 'superadmin' && !req.user?.organizationId;
    const userOrgId = req.user!.organizationId;

    // Parse CSV (supports both comma and tab delimiters)
    const lines = csv.trim().split(/\r?\n/);
    if (lines.length < 2) {
      return res.status(400).json({ error: 'CSVにヘッダーとデータ行が必要です。' });
    }

    // Detect delimiter (comma or tab)
    const delimiter = lines[0].includes('\t') ? '\t' : ',';
    const headers = lines[0].split(delimiter).map(h => h.trim().toLowerCase().replace(/"/g, ''));

    // Build header map with flexible naming
    const headerMap: Record<string, number> = {};
    headers.forEach((h, i) => {
      const normalized = h
        .replace(/ブランド名|brand_name|brandname/, 'name')
        .replace(/ドメイン|domain_name|domainname/, 'domain')
        .replace(/キーワード|keywords|検知キーワード/, 'keywords')
        .replace(/組織id|organization_id|org_id|orgid/, 'organizationid')
        .replace(/組織名|organization_name|org_name|orgname/, 'organizationname');
      headerMap[normalized] = i;
    });

    const nameIdx = headerMap['name'];
    const domainIdx = headerMap['domain'];
    if (nameIdx === undefined) {
      return res.status(400).json({ error: '「name」または「ブランド名」列が必要です。' });
    }
    if (domainIdx === undefined) {
      return res.status(400).json({ error: '「domain」または「ドメイン」列が必要です。' });
    }

    const created: any[] = [];
    const errors: { line: number; message: string }[] = [];

    // Cache for organization lookup/creation
    const orgCache = new Map<string, string>();

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // Parse CSV fields (handle quoted values)
      const fields: string[] = [];
      let current = '';
      let inQuotes = false;
      for (const char of line) {
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if ((char === delimiter.charAt(0)) && !inQuotes) {
          fields.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      fields.push(current.trim());

      const getValue = (key: string) => {
        const idx = headerMap[key];
        return idx !== undefined && fields[idx] ? fields[idx].replace(/^"|"$/g, '') : null;
      };

      const name = getValue('name');
      const domain = getValue('domain');

      if (!name) {
        errors.push({ line: i + 1, message: 'ブランド名が空です' });
        continue;
      }
      if (!domain) {
        errors.push({ line: i + 1, message: 'ドメインが空です' });
        continue;
      }

      // Normalize domain
      const normalizedDomain = domain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');

      // Determine organization ID
      let orgId = userOrgId;
      const orgIdFromCsv = getValue('organizationid');
      const orgNameFromCsv = getValue('organizationname');

      if (isSuperadmin && orgIdFromCsv) {
        // Superadmin can specify organizationId directly
        orgId = orgIdFromCsv;
      } else if (isSuperadmin && orgNameFromCsv) {
        // Superadmin can specify organization by name - look up or create
        const cachedOrgId = orgCache.get(orgNameFromCsv.toLowerCase());
        if (cachedOrgId) {
          orgId = cachedOrgId;
        } else {
          let org = await prisma.organization.findFirst({ where: { name: orgNameFromCsv } });
          if (!org) {
            org = await prisma.organization.create({ data: { name: orgNameFromCsv } });
          }
          orgId = org.id;
          orgCache.set(orgNameFromCsv.toLowerCase(), org.id);
        }
      }

      if (!orgId) {
        errors.push({ line: i + 1, message: '組織IDが指定されていません' });
        continue;
      }

      // Check for duplicate domain within the organization
      const existingBrand = await prisma.brand.findFirst({
        where: { organizationId: orgId, domain: normalizedDomain },
      });
      if (existingBrand) {
        errors.push({ line: i + 1, message: `ドメイン「${normalizedDomain}」は既に登録されています` });
        continue;
      }

      try {
        const brand = await prisma.brand.create({
          data: {
            name,
            domain: normalizedDomain,
            organizationId: orgId,
            keywords: getValue('keywords') || '',
            whitelistDomains: normalizedDomain,
          },
        });

        // Trigger initial scan for newly created brand
        runFullScan(brand.id, brand.name).catch((err) => {
          console.error(`[Brand CSV Import] Auto-scan failed for ${brand.name}:`, err);
        });

        created.push(brand);
      } catch (err) {
        errors.push({ line: i + 1, message: '登録エラー' });
      }
    }

    res.json({
      success: true,
      created: created.length,
      errors: errors.length,
      errorDetails: errors.slice(0, 10),
    });
  } catch (err) {
    console.error('Error importing brands CSV:', err);
    res.status(500).json({ error: 'ブランドCSVインポートに失敗しました。' });
  }
});

// CSV bulk import domains for a brand
router.post('/:id/domains/import-csv', async (req, res) => {
  try {
    const { csv } = req.body;
    if (!csv || typeof csv !== 'string') {
      return res.status(400).json({ error: 'CSVデータが必要です。' });
    }

    const isSuperadmin = req.user?.role === 'superadmin' && !req.user?.organizationId;
    const where = isSuperadmin ? { id: req.params.id } : { id: req.params.id, organizationId: req.user!.organizationId! };
    const brand = await prisma.brand.findFirst({ where });
    if (!brand) return res.status(404).json({ error: 'ブランドが見つかりません。' });

    // Parse CSV - support simple domain list or CSV with headers
    const lines = csv.trim().split(/\r?\n/);
    if (lines.length < 1) {
      return res.status(400).json({ error: 'CSVデータが空です。' });
    }

    // Check if first line looks like a header
    const firstLine = lines[0].toLowerCase();
    const hasHeader = firstLine.includes('domain') || firstLine.includes('ドメイン') || firstLine.includes('type') || firstLine.includes('種別');
    const startIdx = hasHeader ? 1 : 0;

    // Detect delimiter
    const delimiter = lines[0].includes('\t') ? '\t' : (lines[0].includes(',') ? ',' : null);

    // Build header map if header exists
    let domainIdx = 0;
    let typeIdx = -1;
    if (hasHeader && delimiter) {
      const headers = lines[0].split(delimiter).map(h => h.trim().toLowerCase().replace(/"/g, ''));
      headers.forEach((h, i) => {
        if (h === 'domain' || h === 'ドメイン') domainIdx = i;
        if (h === 'type' || h === '種別' || h === 'タイプ') typeIdx = i;
      });
    }

    const domainsToAdd: Array<{ domain: string; type: 'primary' | 'owned' }> = [];

    for (let i = startIdx; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      let domain: string;
      let type: 'primary' | 'owned' = 'owned';

      if (delimiter) {
        const fields = line.split(delimiter).map(f => f.trim().replace(/^"|"$/g, ''));
        domain = fields[domainIdx] || '';
        if (typeIdx >= 0 && fields[typeIdx]) {
          const typeVal = fields[typeIdx].toLowerCase();
          type = typeVal === 'primary' || typeVal === 'プライマリ' ? 'primary' : 'owned';
        }
      } else {
        // Single column - just domain
        domain = line;
      }

      // Normalize domain
      domain = domain.toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '').trim();
      if (domain && domain.includes('.')) {
        domainsToAdd.push({ domain, type });
      }
    }

    // Deduplicate
    const uniqueDomains = new Map<string, 'primary' | 'owned'>();
    for (const { domain, type } of domainsToAdd) {
      // Primary takes precedence
      if (!uniqueDomains.has(domain) || type === 'primary') {
        uniqueDomains.set(domain, type);
      }
    }

    // Pre-fetch existing domains in the same organization (excluding current brand)
    const domainList = [...uniqueDomains.keys()];
    const existingOrgDomains = await prisma.brandDomain.findMany({
      where: {
        domain: { in: domainList },
        brand: {
          organizationId: brand.organizationId,
          id: { not: brand.id },
        },
      },
      include: { brand: { select: { name: true } } },
    });
    const orgDomainMap = new Map(existingOrgDomains.map((d) => [d.domain, d.brand.name]));

    let added = 0;
    let skipped = 0;
    let reclassified = 0;
    const duplicates: Array<{ domain: string; brandName: string }> = [];
    const errors: { line: number; message: string }[] = [];

    for (const [domain, type] of uniqueDomains) {
      // Check for duplicate in the same organization
      const existingBrandName = orgDomainMap.get(domain);
      if (existingBrandName) {
        duplicates.push({ domain, brandName: existingBrandName });
        skipped++;
        continue;
      }

      try {
        // If setting as primary, demote existing primary
        if (type === 'primary') {
          await prisma.brandDomain.updateMany({
            where: { brandId: brand.id, type: 'primary' },
            data: { type: 'owned' },
          });
        }

        await prisma.brandDomain.upsert({
          where: { brandId_domain: { brandId: brand.id, domain } },
          update: { type },
          create: { brandId: brand.id, domain, type },
        });

        const existing = await prisma.brandDomain.findUnique({
          where: { brandId_domain: { brandId: brand.id, domain } },
        });
        if (existing && (Date.now() - new Date(existing.createdAt).getTime()) < 2000) {
          added++;
        } else {
          skipped++;
        }

        // Reclassify matching detected domains as false_positive
        if (type === 'owned') {
          const result = await prisma.detectedDomain.updateMany({
            where: {
              brandId: brand.id,
              domain: { contains: domain },
              status: { not: 'false_positive' },
            },
            data: { status: 'false_positive' },
          });
          reclassified += result.count;
        }
      } catch (err) {
        errors.push({ line: 0, message: `${domain}: 登録エラー` });
        skipped++;
      }
    }

    // Sync whitelistDomains
    await syncWhitelistDomains(brand.id);

    // Trigger scan if new domains were added
    if (added > 0) {
      runFullScan(brand.id, brand.name).catch((err) => {
        console.error(`[BrandDomain CSV Import] Auto-scan failed for ${brand.name}:`, err);
      });
    }

    res.json({
      success: true,
      added,
      skipped,
      reclassified,
      total: uniqueDomains.size,
      scanTriggered: added > 0,
      errors: errors.length,
      errorDetails: errors.slice(0, 10),
      duplicates: duplicates.length > 0 ? duplicates : undefined,
      duplicateMessage: duplicates.length > 0
        ? `${duplicates.length}件のドメインが同じ組織内の別ブランドに既に登録されているためスキップしました。`
        : undefined,
    });
  } catch (err) {
    console.error('Error importing domains CSV:', err);
    res.status(500).json({ error: 'ドメインCSVインポートに失敗しました。' });
  }
});

export default router;
