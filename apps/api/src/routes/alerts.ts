import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { z } from 'zod';

const router = Router();

// GET /api/alerts — list alert logs for current user (paginated)
router.get('/', async (req, res) => {
  const userId = req.user!.userId;
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
  const skip = (page - 1) * limit;

  const [alerts, total] = await Promise.all([
    prisma.alertLog.findMany({
      where: { userId },
      orderBy: { sentAt: 'desc' },
      skip,
      take: limit,
      include: {
        detectedDomain: {
          select: { domain: true, riskScore: true, brandId: true },
        },
      },
    }),
    prisma.alertLog.count({ where: { userId } }),
  ]);

  res.json({
    alerts,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
});

const updateSettingsSchema = z.object({
  alertEnabled: z.boolean().optional(),
  alertThreshold: z.number().int().min(0).max(100).optional(),
});

// GET /api/alerts/settings — get current alert settings
router.get('/settings', async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.userId },
    select: { alertEnabled: true, alertThreshold: true },
  });
  if (!user) return res.status(404).json({ error: 'ユーザー情報が見つかりません。再ログインをお試しください。' });
  res.json(user);
});

// PUT /api/alerts/settings — update alert settings
router.put('/settings', async (req, res) => {
  const parsed = updateSettingsSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const user = await prisma.user.update({
    where: { id: req.user!.userId },
    data: parsed.data,
    select: { alertEnabled: true, alertThreshold: true },
  });

  res.json(user);
});

// POST /api/alerts/test-email — send a test alert email to the current user
router.post('/test-email', async (req, res) => {
  const userId = req.user!.userId;

  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ error: 'ユーザー情報が見つかりません。再ログインをお試しください。' });

    const { sendMail, isMailConfigured } = await import('../services/mail.js');

    if (!isMailConfigured()) {
      return res.status(400).json({ error: 'メール設定が未設定です。RESEND_API_KEY を環境変数に追加してください。' });
    }

    await sendMail({
      to: user.email,
      subject: '[ThreatGuard] ✅ テストメール — メール送信確認',
      html: `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:24px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
<tr><td style="background:#1e293b;padding:20px 24px;">
  <h1 style="margin:0;color:#fff;font-size:18px;">🛡️ ThreatGuard</h1>
</td></tr>
<tr><td style="padding:24px;">
  <h2 style="margin:0 0 12px;color:#1e293b;">✅ メール送信テスト成功</h2>
  <p style="color:#475569;">このメールが届いていれば、メール通知は正常に動作しています。</p>
  <table style="margin:16px 0;background:#f8fafc;border-radius:6px;padding:12px;width:100%;">
    <tr><td style="padding:4px 0;color:#64748b;font-size:13px;">送信先: ${user.email}</td></tr>
    <tr><td style="padding:4px 0;color:#64748b;font-size:13px;">送信方式: Resend API</td></tr>
    <tr><td style="padding:4px 0;color:#64748b;font-size:13px;">送信日時: ${new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}</td></tr>
  </table>
</td></tr>
</table>
</td></tr>
</table>
</body></html>`,
    });

    res.json({ success: true, message: `テストメールを ${user.email} に送信しました` });
  } catch (err) {
    console.error('[Test Email] Error:', err);
    res.status(500).json({ error: 'テストメールの送信に失敗しました。メール設定を確認してください。', detail: String(err) });
  }
});

export default router;
