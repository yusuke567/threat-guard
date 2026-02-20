import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { z } from 'zod';
import { generateTakedownTemplate } from '../services/takedown.js';

const router = Router();

// Generate takedown request
router.post('/', async (req, res) => {
  const schema = z.object({ detectedDomainId: z.string().uuid() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const template = await generateTakedownTemplate(parsed.data.detectedDomainId);
  const takedown = await prisma.takedownRequest.findFirst({
    where: { detectedDomainId: parsed.data.detectedDomainId },
    orderBy: { createdAt: 'desc' },
  });

  res.status(201).json(takedown ?? { template });
});

// Update takedown status
router.put('/:id', async (req, res) => {
  const schema = z.object({
    status: z.enum(['draft', 'sent', 'acknowledged', 'completed', 'rejected']),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const takedown = await prisma.takedownRequest.update({
    where: { id: req.params.id },
    data: {
      status: parsed.data.status,
      sentAt: parsed.data.status === 'sent' ? new Date() : undefined,
      respondedAt: ['acknowledged', 'completed', 'rejected'].includes(parsed.data.status)
        ? new Date()
        : undefined,
    },
  });
  res.json(takedown);
});

export default router;
