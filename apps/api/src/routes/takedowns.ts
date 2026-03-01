import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { z } from 'zod';
import { generateTakedownTemplate } from '../services/takedown.js';
import { generateTakedownPdf, sendTakedownEmail } from '../services/takedown-export.js';

const router = Router();

// Helper: verify detectedDomain belongs to user's org
async function verifyDomainOrg(domainId: string, organizationId: string) {
  return prisma.detectedDomain.findFirst({
    where: { id: domainId, brand: { organizationId } },
  });
}

// Helper: verify takedown belongs to user's org
async function verifyTakedownOrg(takedownId: string, organizationId: string) {
  return prisma.takedownRequest.findFirst({
    where: { id: takedownId, detectedDomain: { brand: { organizationId } } },
  });
}

// Generate takedown request
router.post('/', async (req, res) => {
  const orgId = req.user!.organizationId!;
  const schema = z.object({ detectedDomainId: z.string().uuid() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const domain = await verifyDomainOrg(parsed.data.detectedDomainId, orgId);
  if (!domain) return res.status(404).json({ error: 'Domain not found' });

  const result = await generateTakedownTemplate(parsed.data.detectedDomainId);
  res.status(201).json(result);
});

// Update takedown status
router.put('/:id', async (req, res) => {
  const orgId = req.user!.organizationId!;
  const schema = z.object({
    status: z.enum(['draft', 'sent', 'acknowledged', 'completed', 'rejected']),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const existing = await verifyTakedownOrg(req.params.id, orgId);
  if (!existing) return res.status(404).json({ error: 'Takedown not found' });

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
  const orgId = req.user!.organizationId!;
  const existing = await verifyTakedownOrg(req.params.id, orgId);
  if (!existing) return res.status(404).json({ error: 'Takedown not found' });

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
  const orgId = req.user!.organizationId!;
  const schema = z.object({ email: z.string().email() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const existing = await verifyTakedownOrg(req.params.id, orgId);
  if (!existing) return res.status(404).json({ error: 'Takedown not found' });

  try {
    await prisma.takedownRequest.update({
      where: { id: req.params.id },
      data: { abuseEmail: parsed.data.email },
    });

    await sendTakedownEmail(req.params.id, parsed.data.email);

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
