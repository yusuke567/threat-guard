import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { z } from 'zod';
import { generateTakedownTemplate } from '../services/takedown.js';
import { generateTakedownPdf, sendTakedownEmail } from '../services/takedown-export.js';

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

// Download takedown as PDF
router.get('/:id/pdf', async (req, res) => {
  try {
    const pdf = await generateTakedownPdf(req.params.id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="takedown-${req.params.id.slice(0, 8)}.pdf"`);
    res.send(pdf);
  } catch (err) {
    console.error('PDF generation failed:', err);
    res.status(500).json({ error: 'PDF generation failed' });
  }
});

// Send takedown via email
router.post('/:id/send', async (req, res) => {
  const schema = z.object({ email: z.string().email() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  try {
    // Save the abuse email to the takedown record
    await prisma.takedownRequest.update({
      where: { id: req.params.id },
      data: { abuseEmail: parsed.data.email },
    });

    await sendTakedownEmail(req.params.id, parsed.data.email);

    // Update status to sent
    await prisma.takedownRequest.update({
      where: { id: req.params.id },
      data: { status: 'sent', sentAt: new Date() },
    });

    res.json({ success: true, message: `Takedown sent to ${parsed.data.email}` });
  } catch (err) {
    console.error('Email send failed:', err);
    res.status(500).json({ error: 'Email send failed' });
  }
});

export default router;
