import { Router } from 'express';
import { prisma } from '../lib/prisma.js';

const router = Router();

// List organizations
router.get('/', async (_req, res) => {
  const orgs = await prisma.organization.findMany({
    include: { _count: { select: { brands: true } } },
    orderBy: { name: 'asc' },
  });
  res.json(orgs);
});

export default router;
