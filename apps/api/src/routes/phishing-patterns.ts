import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { lookupWhois } from '../services/whois-lookup.js';

const router = Router();

// グローバル検知ルールを作成/更新（登録元の会社情報は保存しない）
async function upsertGlobalDetectionRule(pattern: {
  domain: string | null;
  patternType: string;
  description: string;
  tags: string;
  severity: string;
  victimCount: number;
}) {
  if (!pattern.domain) return;

  const existing = await prisma.globalDetectionRule.findUnique({
    where: { domain: pattern.domain },
  });

  if (existing) {
    // 既存ルールがあれば、より高い severity と victimCount の合算で更新
    const severityOrder: Record<string, number> = { low: 1, medium: 2, high: 3 };
    const newSeverity =
      (severityOrder[pattern.severity] ?? 0) > (severityOrder[existing.severity] ?? 0)
        ? pattern.severity
        : existing.severity;

    await prisma.globalDetectionRule.update({
      where: { domain: pattern.domain },
      data: {
        severity: newSeverity,
        victimCount: existing.victimCount + pattern.victimCount,
      },
    });
  } else {
    await prisma.globalDetectionRule.create({
      data: {
        domain: pattern.domain,
        patternType: pattern.patternType,
        description: pattern.description,
        tags: pattern.tags,
        severity: pattern.severity,
        victimCount: pattern.victimCount,
      },
    });
  }
}

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

// CSV bulk import patterns
router.post('/brands/:brandId/phishing-patterns/import-csv', async (req, res) => {
  try {
    const isSuperadmin = req.user?.role === 'superadmin' && !req.user?.organizationId;
    const orgId = req.user!.organizationId;
    const { brandId } = req.params;

    const brand = await verifyBrandOrg(brandId, orgId, isSuperadmin);
    if (!brand) return res.status(404).json({ error: '指定されたブランドが見つかりません。' });

    const { csv } = req.body;
    if (!csv || typeof csv !== 'string') {
      return res.status(400).json({ error: 'CSVデータが必要です。' });
    }

    // Parse CSV (supports both comma and tab delimiters)
    const lines = csv.trim().split(/\r?\n/);
    if (lines.length < 2) {
      return res.status(400).json({ error: 'CSVにヘッダーとデータ行が必要です。' });
    }

    // Detect delimiter (comma or tab)
    const delimiter = lines[0].includes('\t') ? '\t' : ',';
    const headers = lines[0].split(delimiter).map(h => h.trim().toLowerCase().replace(/"/g, ''));

    // Expected headers: reportedBy, patternType, url, domain, description, severity, victimCount, tags
    const headerMap: Record<string, number> = {};
    headers.forEach((h, i) => {
      // Support various header names
      const normalized = h
        .replace(/報告者|reporter/, 'reportedby')
        .replace(/種別|type|パターン種別/, 'patterntype')
        .replace(/説明|手口/, 'description')
        .replace(/重要度|深刻度/, 'severity')
        .replace(/被害者数|被害/, 'victimcount')
        .replace(/ドメイン/, 'domain')
        .replace(/タグ/, 'tags');
      headerMap[normalized] = i;
    });

    const descIdx = headerMap['description'];
    if (descIdx === undefined) {
      return res.status(400).json({ error: '「description」列が必要です。' });
    }

    const validPatternTypes = ['domain_spoof', 'email', 'sms', 'social', 'clone_site', 'other'];
    const validSeverities = ['low', 'medium', 'high', 'critical'];

    const created: any[] = [];
    const errors: { line: number; message: string }[] = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // Parse CSV fields (handle quoted values)
      const fields: string[] = [];
      let current = '';
      let inQuotes = false;
      for (const char of line) {
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if ((char === delimiter.charAt(0)) && !inQuotes) {
          fields.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      fields.push(current.trim());

      const getValue = (key: string) => {
        const idx = headerMap[key];
        return idx !== undefined && fields[idx] ? fields[idx].replace(/^"|"$/g, '') : null;
      };

      const description = getValue('description');
      if (!description) {
        errors.push({ line: i + 1, message: '説明が空です' });
        continue;
      }

      let url = getValue('url');
      let domain = getValue('domain');

      // Extract domain from URL if domain is not provided
      if (!domain && url) {
        try {
          const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`);
          domain = urlObj.hostname;
        } catch {
          // Keep URL as-is if parsing fails
        }
      }

      let patternType = getValue('patterntype') || 'domain_spoof';
      if (!validPatternTypes.includes(patternType)) {
        patternType = 'other';
      }

      let severity = getValue('severity') || 'medium';
      if (!validSeverities.includes(severity)) {
        severity = 'medium';
      }

      const victimCountStr = getValue('victimcount');
      const victimCount = victimCountStr ? parseInt(victimCountStr, 10) || 0 : 0;

      try {
        const pattern = await prisma.phishingPattern.create({
          data: {
            brandId,
            reportedBy: getValue('reportedby'),
            patternType,
            url,
            domain,
            description,
            tags: getValue('tags') || '',
            severity,
            victimCount,
          },
        });
        created.push(pattern);
      } catch (err) {
        errors.push({ line: i + 1, message: '登録エラー' });
      }
    }

    res.json({
      success: true,
      created: created.length,
      errors: errors.length,
      errorDetails: errors.slice(0, 10), // Return first 10 errors
    });
  } catch (err) {
    console.error('Error importing CSV:', err);
    res.status(500).json({ error: 'CSVインポートに失敗しました。' });
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

      // グローバル検知ルールにも登録（他社にも適用されるよう）
      await upsertGlobalDetectionRule(pattern);

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

    // WHOIS/RDAPデータを取得
    lookupWhois(detectedDomain.id).catch((err) => {
      console.error(`[PhishingPatterns] WHOIS lookup failed for ${pattern.domain}:`, err);
    });

    // グローバル検知ルールにも登録（他社にも適用されるよう）
    await upsertGlobalDetectionRule(pattern);

    res.status(201).json({ detectedDomain, alreadyExisted: false });
  } catch (err) {
    console.error('Error applying phishing pattern:', err);
    res.status(500).json({ error: 'パターンの適用に失敗しました。しばらくしてからもう一度お試しください。' });
  }
});

export default router;
