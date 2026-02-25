import { Router } from 'express';
import { prisma } from '../lib/prisma.js';

const router = Router();

// List patterns for a brand
router.get('/brands/:brandId/phishing-patterns', async (req, res) => {
  try {
    const { brandId } = req.params;
    const { status } = req.query;

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
    const { brandId } = req.params;
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
    const { id } = req.params;
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
    await prisma.phishingPattern.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting phishing pattern:', err);
    res.status(500).json({ error: 'Failed to delete pattern' });
  }
});

// Apply pattern to detection — creates a DetectedDomain from a reported pattern
router.post('/phishing-patterns/:id/apply', async (req, res) => {
  try {
    const pattern = await prisma.phishingPattern.findUniqueOrThrow({
      where: { id: req.params.id },
    });

    if (!pattern.domain) {
      return res.status(400).json({ error: 'Pattern has no domain to apply' });
    }

    // Check if already detected
    const existing = await prisma.detectedDomain.findFirst({
      where: { brandId: pattern.brandId, domain: pattern.domain },
    });

    if (existing) {
      // Update status of pattern
      await prisma.phishingPattern.update({
        where: { id: pattern.id },
        data: { status: 'rule_created' },
      });
      return res.json({ detectedDomain: existing, alreadyExisted: true });
    }

    // Create new DetectedDomain from user report
    const detectedDomain = await prisma.detectedDomain.create({
      data: {
        brandId: pattern.brandId,
        domain: pattern.domain,
        source: 'user_report',
        status: 'confirmed_threat',
      },
    });

    // Mark pattern as applied
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
