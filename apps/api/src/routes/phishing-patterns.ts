import { Router } from 'express';
import { prisma } from '../lib/prisma.js';

const router = Router();

// Helper: verify brand belongs to user's org (superadmin bypasses)
async function verifyBrandOrg(brandId: string, organizationId: string | null, isSuperadmin: boolean) {
  if (isSuperadmin) return prisma.brand.findFirst({ where: { id: brandId } });
  return prisma.brand.findFirst({ where: { id: brandId, organizationId: organizationId! } });
}

// Helper: verify pattern belongs to user's org (superadmin bypasses)
async function verifyPatternOrg(patternId: string, organizationId: string | null, isSuperadmin: boolean) {
  if (isSuperadmin) return prisma.phishingPattern.findFirst({ where: { id: patternId } });
  return prisma.phishingPattern.findFirst({ where: { id: patternId, brand: { organizationId: organizationId! } } });
}

// List patterns for a brand
router.get('/brands/:brandId/phishing-patterns', async (req, res) => {
  try {
    const isSuperadmin = req.user?.role === 'superadmin' && !req.user?.organizationId;
    const orgId = req.user!.organizationId;
    const { brandId } = req.params;
    const { status } = req.query;

    const brand = await verifyBrandOrg(brandId, orgId, isSuperadmin);
    if (!brand) return res.status(404).json({ error: '指定されたブランドが見つかりません。' });

    const where: any = { brandId };
    if (status) where.status = status as string;

    const patterns = await prisma.phishingPattern.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
    res.json(patterns);
  } catch (err) {
    console.error('Error listing phishing patterns:', err);
    res.status(500).json({ error: 'パターン一覧の取得に失敗しました。しばらくしてからもう一度お試しください。' });
  }
});

// Create pattern
router.post('/brands/:brandId/phishing-patterns', async (req, res) => {
  try {
    const isSuperadmin = req.user?.role === 'superadmin' && !req.user?.organizationId;
    const orgId = req.user!.organizationId;
    const { brandId } = req.params;

    const brand = await verifyBrandOrg(brandId, orgId, isSuperadmin);
    if (!brand) return res.status(404).json({ error: '指定されたブランドが見つかりません。' });

    const { reportedBy, patternType, url, domain, description, tags, severity, victimCount } = req.body;

    if (!description) {
      return res.status(400).json({ error: 'パターンの説明を入力してください。' });
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
    res.status(500).json({ error: 'パターンの登録に失敗しました。しばらくしてからもう一度お試しください。' });
  }
});

// Update pattern
router.patch('/phishing-patterns/:id', async (req, res) => {
  try {
    const isSuperadmin = req.user?.role === 'superadmin' && !req.user?.organizationId;
    const orgId = req.user!.organizationId;
    const { id } = req.params;

    const existing = await verifyPatternOrg(id, orgId, isSuperadmin);
    if (!existing) return res.status(404).json({ error: '指定されたパターンが見つかりません。' });

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
    res.status(500).json({ error: 'パターンの更新に失敗しました。しばらくしてからもう一度お試しください。' });
  }
});

// Delete pattern
router.delete('/phishing-patterns/:id', async (req, res) => {
  try {
    const isSuperadmin = req.user?.role === 'superadmin' && !req.user?.organizationId;
    const orgId = req.user!.organizationId;

    const existing = await verifyPatternOrg(req.params.id, orgId, isSuperadmin);
    if (!existing) return res.status(404).json({ error: '指定されたパターンが見つかりません。' });

    await prisma.phishingPattern.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting phishing pattern:', err);
    res.status(500).json({ error: 'パターンの削除に失敗しました。しばらくしてからもう一度お試しください。' });
  }
});

// Apply pattern to detection
router.post('/phishing-patterns/:id/apply', async (req, res) => {
  try {
    const isSuperadmin = req.user?.role === 'superadmin' && !req.user?.organizationId;
    const orgId = req.user!.organizationId;

    const pattern = await verifyPatternOrg(req.params.id, orgId, isSuperadmin);
    if (!pattern) return res.status(404).json({ error: '指定されたパターンが見つかりません。' });

    if (!pattern.domain) {
      return res.status(400).json({ error: 'このパターンには対象ドメインが設定されていません。ドメインを追加してから適用してください。' });
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
    res.status(500).json({ error: 'パターンの適用に失敗しました。しばらくしてからもう一度お試しください。' });
  }
});

// Share pattern to all companies (anonymized - source company not identifiable)
router.post('/phishing-patterns/:id/share', async (req, res) => {
  try {
    const isSuperadmin = req.user?.role === 'superadmin' && !req.user?.organizationId;
    const orgId = req.user!.organizationId;

    const pattern = await verifyPatternOrg(req.params.id, orgId, isSuperadmin);
    if (!pattern) return res.status(404).json({ error: '指定されたパターンが見つかりません。' });

    if (pattern.isShared) {
      return res.status(400).json({ error: 'このパターンは既に共有されています。' });
    }

    // Create anonymized shared pattern (no brandId, no organization reference)
    const sharedPattern = await prisma.sharedPhishingPattern.create({
      data: {
        patternType: pattern.patternType,
        url: pattern.url,
        domain: pattern.domain,
        description: pattern.description,
        tags: pattern.tags,
        severity: pattern.severity,
        victimCount: pattern.victimCount,
      },
    });

    // Mark original pattern as shared
    await prisma.phishingPattern.update({
      where: { id: pattern.id },
      data: { isShared: true },
    });

    res.status(201).json({ sharedPattern, message: 'パターンを匿名で共有しました。' });
  } catch (err) {
    console.error('Error sharing phishing pattern:', err);
    res.status(500).json({ error: 'パターンの共有に失敗しました。しばらくしてからもう一度お試しください。' });
  }
});

// List all shared patterns (available to all companies)
router.get('/shared-patterns', async (req, res) => {
  try {
    const { patternType, severity } = req.query;

    const where: any = {};
    if (patternType) where.patternType = patternType as string;
    if (severity) where.severity = severity as string;

    const sharedPatterns = await prisma.sharedPhishingPattern.findMany({
      where,
      orderBy: { sharedAt: 'desc' },
    });
    res.json(sharedPatterns);
  } catch (err) {
    console.error('Error listing shared patterns:', err);
    res.status(500).json({ error: '共有パターン一覧の取得に失敗しました。しばらくしてからもう一度お試しください。' });
  }
});

// Apply shared pattern to a brand (creates DetectedDomain for the brand)
router.post('/shared-patterns/:id/apply', async (req, res) => {
  try {
    const isSuperadmin = req.user?.role === 'superadmin' && !req.user?.organizationId;
    const orgId = req.user!.organizationId;
    const { brandId } = req.body;

    if (!brandId) {
      return res.status(400).json({ error: '適用先のブランドIDを指定してください。' });
    }

    const brand = await verifyBrandOrg(brandId, orgId, isSuperadmin);
    if (!brand) return res.status(404).json({ error: '指定されたブランドが見つかりません。' });

    const sharedPattern = await prisma.sharedPhishingPattern.findUnique({
      where: { id: req.params.id },
    });
    if (!sharedPattern) {
      return res.status(404).json({ error: '指定された共有パターンが見つかりません。' });
    }

    if (!sharedPattern.domain) {
      return res.status(400).json({ error: 'この共有パターンには対象ドメインが設定されていません。' });
    }

    // Check if domain already exists for this brand
    const existing = await prisma.detectedDomain.findFirst({
      where: { brandId, domain: sharedPattern.domain },
    });

    if (existing) {
      return res.json({ detectedDomain: existing, alreadyExisted: true });
    }

    // Create DetectedDomain for this brand from shared pattern
    const detectedDomain = await prisma.detectedDomain.create({
      data: {
        brandId,
        domain: sharedPattern.domain,
        source: 'shared_pattern',
        status: 'confirmed_threat',
      },
    });

    res.status(201).json({ detectedDomain, alreadyExisted: false });
  } catch (err) {
    console.error('Error applying shared pattern:', err);
    res.status(500).json({ error: '共有パターンの適用に失敗しました。しばらくしてからもう一度お試しください。' });
  }
});

export default router;
