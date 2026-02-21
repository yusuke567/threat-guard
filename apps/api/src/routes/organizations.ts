import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { z } from 'zod';

const router = Router();

// List organizations
router.get('/', async (_req, res) => {
  const orgs = await prisma.organization.findMany({
    include: { _count: { select: { brands: true } } },
    orderBy: { name: 'asc' },
  });
  res.json(orgs);
});

// Create organization
router.post('/', async (req, res) => {
  const schema = z.object({ name: z.string().min(1) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const org = await prisma.organization.create({ data: { name: parsed.data.name } });
  res.status(201).json(org);
});

export default router;
