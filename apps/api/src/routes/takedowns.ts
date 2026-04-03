import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { z } from 'zod';
import { generateTakedownTemplate, generatePoliceTemplate, generateJpcertTemplate, JPCERT_RECIPIENT } from '../services/takedown.js';
import { generateTakedownPdf, sendTakedownEmail } from '../services/takedown-export.js';

const router = Router();

// Helper: verify detectedDomain belongs to user's org (superadmin bypasses org check)
async function verifyDomainOrg(domainId: string, organizationId: string | null, isSuperadmin: boolean) {
  if (isSuperadmin) {
    return prisma.detectedDomain.findFirst({ where: { id: domainId } });
  }
  return prisma.detectedDomain.findFirst({
    where: { id: domainId, brand: { organizationId: organizationId! } },
  });
}

// Helper: verify takedown belongs to user's org (superadmin bypasses org check)
async function verifyTakedownOrg(takedownId: string, organizationId: string | null, isSuperadmin: boolean) {
  if (isSuperadmin) {
    return prisma.takedownRequest.findFirst({ where: { id: takedownId } });
  }
  return prisma.takedownRequest.findFirst({
    where: { id: takedownId, detectedDomain: { brand: { organizationId: organizationId! } } },
  });
}

// Generate takedown request
router.post('/', async (req, res) => {
  const isSuperadmin = req.user?.role === 'superadmin' && !req.user?.organizationId;
  const orgId = req.user!.organizationId;
  const schema = z.object({
    detectedDomainId: z.string().uuid(),
    recipientType: z.enum(['registrar', 'police', 'jpcert']).default('registrar'),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const domain = await verifyDomainOrg(parsed.data.detectedDomainId, orgId, isSuperadmin);
  if (!domain) return res.status(404).json({ error: '指定されたドメインが見つかりません。' });

  let result;
  if (parsed.data.recipientType === 'police') {
    result = await generatePoliceTemplate(parsed.data.detectedDomainId);
  } else if (parsed.data.recipientType === 'jpcert') {
    result = await generateJpcertTemplate(parsed.data.detectedDomainId, req.user?.name || undefined);
  } else {
    result = await generateTakedownTemplate(parsed.data.detectedDomainId);
  }
  res.status(201).json(result);
});

// Get JPCERT recipient info
router.get('/jpcert-info', (_req, res) => {
  res.json(JPCERT_RECIPIENT);
});

// Update takedown status
router.put('/:id', async (req, res) => {
  const isSuperadmin = req.user?.role === 'superadmin' && !req.user?.organizationId;
  const orgId = req.user!.organizationId;
  const schema = z.object({
    status: z.enum(['draft', 'sent', 'acknowledged', 'completed', 'rejected']),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const existing = await verifyTakedownOrg(req.params.id, orgId, isSuperadmin);
  if (!existing) return res.status(404).json({ error: '指定された削除申請が見つかりません。' });

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
  const isSuperadmin = req.user?.role === 'superadmin' && !req.user?.organizationId;
  const orgId = req.user!.organizationId;
  const existing = await verifyTakedownOrg(req.params.id, orgId, isSuperadmin);
  if (!existing) return res.status(404).json({ error: '指定された削除申請が見つかりません。' });

  try {
    const pdf = await generateTakedownPdf(req.params.id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="takedown-${req.params.id.slice(0, 8)}.pdf"`);
    res.send(pdf);
  } catch (err) {
    console.error('PDF generation failed:', err);
    res.status(500).json({ error: 'PDFの作成に失敗しました。しばらくしてからもう一度お試しください。' });
  }
});

// Send takedown via email
router.post('/:id/send', async (req, res) => {
  const isSuperadmin = req.user?.role === 'superadmin' && !req.user?.organizationId;
  const orgId = req.user!.organizationId;
  const schema = z.object({ email: z.string().email() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const existing = await verifyTakedownOrg(req.params.id, orgId, isSuperadmin);
  if (!existing) return res.status(404).json({ error: '指定された削除申請が見つかりません。' });

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
  } catch (err: any) {
    console.error('Email send failed:', err);
    const detail = err?.message || String(err);
    // Classify error for user-friendly message
    let userMsg = 'メールの送信に失敗しました。';
    if (detail.includes('EAUTH') || detail.includes('Invalid login') || detail.includes('535')) {
      userMsg += ' SMTP認証エラー: メールサーバーのユーザー名またはパスワードが正しくありません。';
    } else if (detail.includes('ECONNREFUSED') || detail.includes('ENOTFOUND')) {
      userMsg += ' SMTPサーバーに接続できません。SMTP_HOSTを確認してください。';
    } else if (detail.includes('chromium') || detail.includes('playwright') || detail.includes('browser')) {
      userMsg += ' PDF生成に失敗しました（Chromiumエラー）。';
    } else {
      userMsg += ` 詳細: ${detail.slice(0, 200)}`;
    }
    res.status(500).json({ error: userMsg });
  }
});

export default router;
