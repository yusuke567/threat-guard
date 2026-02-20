import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { z } from 'zod';

const router = Router();

const createBrandSchema = z.object({
  organizationId: z.string().uuid(),
  name: z.string().min(1),
  domain: z.string().min(1),
  logoUrl: z.string().url().optional(),
  keywords: z.string().default(''),
});

const updateBrandSchema = createBrandSchema.partial().omit({ organizationId: true });

// List brands
router.get('/', async (req, res) => {
  const { organizationId } = req.query;
  const brands = await prisma.brand.findMany({
    where: organizationId ? { organizationId: String(organizationId) } : undefined,
    include: { _count: { select: { detectedDomains: true } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json(brands);
});

// Get brand by ID
router.get('/:id', async (req, res) => {
  const brand = await prisma.brand.findUnique({
    where: { id: req.params.id },
    include: {
      organization: true,
      _count: { select: { detectedDomains: true, scanJobs: true } },
    },
  });
  if (!brand) return res.status(404).json({ error: 'Brand not found' });
  res.json(brand);
});

// Create brand
router.post('/', async (req, res) => {
  const parsed = createBrandSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const brand = await prisma.brand.create({ data: parsed.data });
  res.status(201).json(brand);
});

// Update brand
router.put('/:id', async (req, res) => {
  const parsed = updateBrandSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const brand = await prisma.brand.update({
    where: { id: req.params.id },
    data: parsed.data,
  });
  res.json(brand);
});

// Delete brand
router.delete('/:id', async (req, res) => {
  await prisma.brand.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

export default router;
