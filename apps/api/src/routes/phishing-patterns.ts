import { Router } from 'express';
import { prisma } from '../lib/prisma.js';

const router = Router();

// Helper: verify brand belongs to user's org
async function verifyBrandOrg(brandId: string, organizationId: string) {
  return prisma.brand.findFirst({
    where: { id: brandId, organizationId },
  });
}

// Helper: verify pattern belongs to user's org
async function verifyPatternOrg(patternId: string, organizationId: string) {
  return prisma.phishingPattern.findFirst({
    where: { id: patternId, brand: { organizationId } },
  });
}

// List patterns for a brand
router.get('/brands/:brandId/phishing-patterns', async (req, res) => {
  try {
    const orgId = req.user!.organizationId!;
    const { brandId } = req.params;
    const { status } = req.query;

    const brand = await verifyBrandOrg(brandId, orgId);
    if (!brand) return res.status(404).json({ error: 'Brand not found' });

    const where: any = { brandId };
    if (status) where.status = status as string;

    const patterns = await prisma.phishingPattern.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
    res.json(patterns);
  } catch (err) {
    console.error('Error listing phishing patterns:', err);
    res.status(500).json({ error: 'Failed to list patterns' });
  }
});

// Create pattern
router.post('/brands/:brandId/phishing-patterns', async (req, res) => {
  try {
    const orgId = req.user!.organizationId!;
    const { brandId } = req.params;

    const brand = await verifyBrandOrg(brandId, orgId);
    if (!brand) return res.status(404).json({ error: 'Brand not found' });

    const { reportedBy, patternType, url, domain, description, tags, severity, victimCount } = req.body;

    if (!description) {
      return res.status(400).json({ error: 'description is required' });
    }

    const pattern = await prisma.phishingPattern.create({
      data: {
        brandId,
        reportedBy: reportedBy || null,
        patternType: patternType || 'domain_spoof',
        url: url || null,
        domain: domain || (url ? new URL(url).hostname : null),
        description,
        tags: tags || '',
        severity: severity || 'medium',
        victimCount: victimCount || 0,
      },
    });
    res.status(201).json(pattern);
  } catch (err) {
    console.error('Error creating phishing pattern:', err);
    res.status(500).json({ error: 'Failed to create pattern' });
  }
});

// Update pattern
router.patch('/phishing-patterns/:id', async (req, res) => {
  try {
    const orgId = req.user!.organizationId!;
    const { id } = req.params;

    const existing = await verifyPatternOrg(id, orgId);
    if (!existing) return res.status(404).json({ error: 'Pattern not found' });

    const { status, severity, victimCount, tags } = req.body;

    const data: any = {};
    if (status !== undefined) data.status = status;
    if (severity !== undefined) data.severity = severity;
    if (victimCount !== undefined) data.victimCount = victimCount;
    if (tags !== undefined) data.tags = tags;

    const pattern = await prisma.phishingPattern.update({ where: { id }, data });
    res.json(pattern);
  } catch (err) {
    console.error('Error updating phishing pattern:', err);
    res.status(500).json({ error: 'Failed to update pattern' });
  }
});

// Delete pattern
router.delete('/phishing-patterns/:id', async (req, res) => {
  try {
    const orgId = req.user!.organizationId!;

    const existing = await verifyPatternOrg(req.params.id, orgId);
    if (!existing) return res.status(404).json({ error: 'Pattern not found' });

    await prisma.phishingPattern.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting phishing pattern:', err);
    res.status(500).json({ error: 'Failed to delete pattern' });
  }
});

// Apply pattern to detection
router.post('/phishing-patterns/:id/apply', async (req, res) => {
  try {
    const orgId = req.user!.organizationId!;

    const pattern = await verifyPatternOrg(req.params.id, orgId);
    if (!pattern) return res.status(404).json({ error: 'Pattern not found' });

    if (!pattern.domain) {
      return res.status(400).json({ error: 'Pattern has no domain to apply' });
    }

    const existing = await prisma.detectedDomain.findFirst({
      where: { brandId: pattern.brandId, domain: pattern.domain },
    });

    if (existing) {
      await prisma.phishingPattern.update({
        where: { id: pattern.id },
        data: { status: 'rule_created' },
      });
      return res.json({ detectedDomain: existing, alreadyExisted: true });
    }

    const detectedDomain = await prisma.detectedDomain.create({
      data: {
        brandId: pattern.brandId,
        domain: pattern.domain,
        source: 'user_report',
        status: 'confirmed_threat',
      },
    });

    await prisma.phishingPattern.update({
      where: { id: pattern.id },
      data: { status: 'rule_created' },
    });

    res.status(201).json({ detectedDomain, alreadyExisted: false });
  } catch (err) {
    console.error('Error applying phishing pattern:', err);
    res.status(500).json({ error: 'Failed to apply pattern' });
  }
});

export default router;
