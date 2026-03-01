import { Router } from 'express';
import { prisma } from '../lib/prisma.js';

const router = Router();

// Get current user's organization
router.get('/', async (req, res) => {
  const orgId = req.user!.organizationId;
  if (!orgId) return res.json([]);

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    include: { _count: { select: { brands: true } } },
  });

  res.json(org ? [org] : []);
});

export default router;
