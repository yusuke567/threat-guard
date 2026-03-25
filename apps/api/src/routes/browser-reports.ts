import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { z } from 'zod';
import {
  checkGoogleSafeBrowsing,
  reportToGoogleSafeBrowsing,
  reportToSmartScreen,
  getManualReportUrls,
} from '../services/browser-report.js';

const router = Router();

// Helper: verify detectedDomain belongs to user's org
async function verifyDomainOrg(domainId: string, organizationId: string | null, isSuperadmin: boolean) {
  if (isSuperadmin) {
    return prisma.detectedDomain.findFirst({ where: { id: domainId } });
  }
  return prisma.detectedDomain.findFirst({
    where: { id: domainId, brand: { organizationId: organizationId! } },
  });
}

// List browser reports for a threat
router.get('/threat/:threatId', async (req, res) => {
  try {
    const isSuperadmin = req.user?.role === 'superadmin' && !req.user?.organizationId;
    const orgId = req.user!.organizationId;

    const domain = await verifyDomainOrg(req.params.threatId, orgId, isSuperadmin);
    if (!domain) return res.status(404).json({ error: '指定された脅威情報が見つかりません。' });

    const reports = await prisma.browserReport.findMany({
      where: { detectedDomainId: req.params.threatId },
      orderBy: { createdAt: 'desc' },
    });

    const manualUrls = getManualReportUrls(domain.domain.startsWith('http') ? domain.domain : `https://${domain.domain}`);

    res.json({ reports, manualUrls });
  } catch (err) {
    console.error('Browser reports list error:', err);
    res.status(500).json({ error: 'ブラウザ申請一覧の取得に失敗しました。' });
  }
});

// Check Google Safe Browsing status for a URL
router.get('/check/:threatId', async (req, res) => {
  try {
    const isSuperadmin = req.user?.role === 'superadmin' && !req.user?.organizationId;
    const orgId = req.user!.organizationId;

    const domain = await verifyDomainOrg(req.params.threatId, orgId, isSuperadmin);
    if (!domain) return res.status(404).json({ error: '指定された脅威情報が見つかりません。' });

    const url = domain.domain.startsWith('http') ? domain.domain : `https://${domain.domain}`;
    const result = await checkGoogleSafeBrowsing(url);

    res.json(result);
  } catch (err: any) {
    console.error('Safe Browsing check error:', err);
    res.status(500).json({ error: `Safe Browsingチェックに失敗しました: ${err.message}` });
  }
});

// Submit to Google Safe Browsing
router.post('/google', async (req, res) => {
  try {
    const isSuperadmin = req.user?.role === 'superadmin' && !req.user?.organizationId;
    const orgId = req.user!.organizationId;

    const schema = z.object({ detectedDomainId: z.string().uuid() });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const domain = await verifyDomainOrg(parsed.data.detectedDomainId, orgId, isSuperadmin);
    if (!domain) return res.status(404).json({ error: '指定された脅威情報が見つかりません。' });

    const url = domain.domain.startsWith('http') ? domain.domain : `https://${domain.domain}`;

    // Check for existing report
    const existing = await prisma.browserReport.findUnique({
      where: {
        detectedDomainId_provider: {
          detectedDomainId: parsed.data.detectedDomainId,
          provider: 'GOOGLE_SAFE_BROWSING',
        },
      },
    });
    if (existing && ['submitted', 'confirmed'].includes(existing.status)) {
      return res.status(409).json({ error: '既にGoogle Safe Browsingに申請済みです。', report: existing });
    }

    // Submit report
    const result = await reportToGoogleSafeBrowsing(url);

    const report = await prisma.browserReport.upsert({
      where: {
        detectedDomainId_provider: {
          detectedDomainId: parsed.data.detectedDomainId,
          provider: 'GOOGLE_SAFE_BROWSING',
        },
      },
      update: {
        status: result.success ? 'submitted' : 'error',
        submittedUrl: url,
        submittedAt: result.success ? new Date() : undefined,
        errorMessage: result.success ? null : result.message,
      },
      create: {
        detectedDomainId: parsed.data.detectedDomainId,
        provider: 'GOOGLE_SAFE_BROWSING',
        status: result.success ? 'submitted' : 'error',
        submittedUrl: url,
        submittedAt: result.success ? new Date() : undefined,
        errorMessage: result.success ? null : result.message,
      },
    });

    res.status(201).json({ report, result });
  } catch (err: any) {
    console.error('Google Safe Browsing submit error:', err);
    res.status(500).json({ error: `Google Safe Browsing申請に失敗しました: ${err.message}` });
  }
});

// Submit to Microsoft SmartScreen
router.post('/microsoft', async (req, res) => {
  try {
    const isSuperadmin = req.user?.role === 'superadmin' && !req.user?.organizationId;
    const orgId = req.user!.organizationId;

    const schema = z.object({ detectedDomainId: z.string().uuid() });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const domain = await verifyDomainOrg(parsed.data.detectedDomainId, orgId, isSuperadmin);
    if (!domain) return res.status(404).json({ error: '指定された脅威情報が見つかりません。' });

    const url = domain.domain.startsWith('http') ? domain.domain : `https://${domain.domain}`;

    // Check for existing report
    const existing = await prisma.browserReport.findUnique({
      where: {
        detectedDomainId_provider: {
          detectedDomainId: parsed.data.detectedDomainId,
          provider: 'MICROSOFT_SMARTSCREEN',
        },
      },
    });
    if (existing && ['submitted', 'confirmed'].includes(existing.status)) {
      return res.status(409).json({ error: '既にMicrosoft SmartScreenに申請済みです。', report: existing });
    }

    // Submit report
    const result = await reportToSmartScreen(url);

    const report = await prisma.browserReport.upsert({
      where: {
        detectedDomainId_provider: {
          detectedDomainId: parsed.data.detectedDomainId,
          provider: 'MICROSOFT_SMARTSCREEN',
        },
      },
      update: {
        status: result.success ? 'submitted' : 'error',
        submittedUrl: url,
        submittedAt: result.success ? new Date() : undefined,
        errorMessage: result.success ? null : result.message,
      },
      create: {
        detectedDomainId: parsed.data.detectedDomainId,
        provider: 'MICROSOFT_SMARTSCREEN',
        status: result.success ? 'submitted' : 'error',
        submittedUrl: url,
        submittedAt: result.success ? new Date() : undefined,
        errorMessage: result.success ? null : result.message,
      },
    });

    res.status(201).json({ report, result });
  } catch (err: any) {
    console.error('SmartScreen submit error:', err);
    res.status(500).json({ error: `SmartScreen申請に失敗しました: ${err.message}` });
  }
});

// Bulk submit - report to both providers for multiple threats
router.post('/bulk', async (req, res) => {
  try {
    const isSuperadmin = req.user?.role === 'superadmin' && !req.user?.organizationId;
    const orgId = req.user!.organizationId;

    const schema = z.object({
      detectedDomainIds: z.array(z.string().uuid()).min(1).max(50),
      providers: z.array(z.enum(['GOOGLE_SAFE_BROWSING', 'MICROSOFT_SMARTSCREEN'])).min(1),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const results: Array<{
      detectedDomainId: string;
      provider: string;
      success: boolean;
      message: string;
    }> = [];

    for (const domainId of parsed.data.detectedDomainIds) {
      const domain = await verifyDomainOrg(domainId, orgId, isSuperadmin);
      if (!domain) {
        results.push({ detectedDomainId: domainId, provider: 'all', success: false, message: 'ドメインが見つかりません' });
        continue;
      }

      const url = domain.domain.startsWith('http') ? domain.domain : `https://${domain.domain}`;

      for (const provider of parsed.data.providers) {
        // Skip if already submitted
        const existing = await prisma.browserReport.findUnique({
          where: { detectedDomainId_provider: { detectedDomainId: domainId, provider } },
        });
        if (existing && ['submitted', 'confirmed'].includes(existing.status)) {
          results.push({ detectedDomainId: domainId, provider, success: true, message: '既に申請済み' });
          continue;
        }

        try {
          let submitResult: { success: boolean; message: string };
          if (provider === 'GOOGLE_SAFE_BROWSING') {
            submitResult = await reportToGoogleSafeBrowsing(url);
          } else {
            const msResult = await reportToSmartScreen(url);
            submitResult = { success: msResult.success, message: msResult.message };
          }

          await prisma.browserReport.upsert({
            where: { detectedDomainId_provider: { detectedDomainId: domainId, provider } },
            update: {
              status: submitResult.success ? 'submitted' : 'error',
              submittedUrl: url,
              submittedAt: submitResult.success ? new Date() : undefined,
              errorMessage: submitResult.success ? null : submitResult.message,
            },
            create: {
              detectedDomainId: domainId,
              provider,
              status: submitResult.success ? 'submitted' : 'error',
              submittedUrl: url,
              submittedAt: submitResult.success ? new Date() : undefined,
              errorMessage: submitResult.success ? null : submitResult.message,
            },
          });

          results.push({ detectedDomainId: domainId, provider, success: submitResult.success, message: submitResult.message });
        } catch (err: any) {
          results.push({ detectedDomainId: domainId, provider, success: false, message: err.message });
        }
      }
    }

    const successCount = results.filter((r) => r.success).length;
    const errorCount = results.filter((r) => !r.success).length;

    res.json({ results, summary: { total: results.length, success: successCount, error: errorCount } });
  } catch (err: any) {
    console.error('Bulk browser report error:', err);
    res.status(500).json({ error: `一括申請に失敗しました: ${err.message}` });
  }
});

export default router;
