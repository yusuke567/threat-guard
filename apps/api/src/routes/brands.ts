import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { z } from 'zod';

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
    include: { organization: true, _count: { select: { detectedDomains: true } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json(brands);
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

  const brand = await prisma.brand.update({
    where: { id: req.params.id },
    data: parsed.data,
  });
  res.json(brand);
});

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
