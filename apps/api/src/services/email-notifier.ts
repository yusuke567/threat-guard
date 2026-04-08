import nodemailer from 'nodemailer';
import { prisma } from '../lib/prisma.js';
import { sendMail, isMailConfigured } from './mail.js';

interface EmailThreatAlert {
  brandId: string;
  brandName: string;
  domain: string;
  detectedDomainId: string;
  riskScore: number;
  category: string;
  source: string;
}

interface EmailSiteChangeAlert {
  brandId: string;
  brandName: string;
  domain: string;
  detectedDomainId: string;
  riskScore: number;
  changes: string[];
}

function riskColor(score: number): string {
  if (score >= 80) return '#dc2626';
  if (score >= 60) return '#ea580c';
  if (score >= 40) return '#ca8a04';
  return '#16a34a';
}

function riskEmoji(score: number): string {
  if (score >= 80) return '🔴';
  if (score >= 60) return '🟠';
  if (score >= 40) return '🟡';
  return '🟢';
}

function riskLabel(score: number): string {
  if (score >= 80) return '危険';
  if (score >= 60) return '高';
  if (score >= 40) return '中';
  return '低';
}

async function getSenderConfig(brandId: string) {
  const brand = await prisma.brand.findUnique({ where: { id: brandId } });
  const senderEmail = brand?.senderEmail || process.env.RESEND_FROM;

  // Brand-specific SMTP takes priority
  if (brand?.smtpHost && brand?.smtpUser && brand?.smtpPass) {
    const port = brand.smtpPort || 465;
    const transporter = nodemailer.createTransport({
      host: brand.smtpHost,
      port,
      secure: port === 465,
      auth: { user: brand.smtpUser, pass: brand.smtpPass },
    });
    return { type: 'smtp' as const, transporter, senderEmail };
  }

  // Otherwise use shared mail service (Resend or env SMTP)
  if (isMailConfigured()) {
    return { type: 'shared' as const, transporter: null, senderEmail };
  }

  return null;
}

async function sendEmailViaConfig(
  config: NonNullable<Awaited<ReturnType<typeof getSenderConfig>>>,
  to: string,
  subject: string,
  html: string,
): Promise<void> {
  if (config.type === 'smtp' && config.transporter) {
    await config.transporter.sendMail({ from: config.senderEmail, to, subject, html });
  } else {
    await sendMail({ from: config.senderEmail || undefined, to, subject, html });
  }
}

function wrapHtml(title: string, body: string): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:24px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
<tr><td style="background:#1e293b;padding:20px 24px;">
  <h1 style="margin:0;color:#ffffff;font-size:18px;"><img src="https://app.threatguard.jp/favicon.svg" width="20" height="20" style="vertical-align:middle;margin-right:6px;" alt="" />ThreatGuard アラート</h1>
</td></tr>
<tr><td style="padding:24px;">
${body}
</td></tr>
<tr><td style="background:#f8fafc;padding:16px 24px;border-top:1px solid #e2e8f0;">
  <p style="margin:0;font-size:12px;color:#94a3b8;text-align:center;">
    アカウントのアラート設定が有効のため、このメールが送信されました。<br>
    <a href="#unsubscribe" style="color:#64748b;">アラート配信を停止する</a>
  </p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

function buildNewThreatHtml(alert: EmailThreatAlert): string {
  const color = riskColor(alert.riskScore);
  const emoji = riskEmoji(alert.riskScore);
  const label = riskLabel(alert.riskScore);

  const body = `
<h2 style="margin:0 0 16px;font-size:16px;color:#1e293b;">${emoji} 新しい脅威を検知しました</h2>
<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;">
<tr>
  <td style="padding:12px;background:#f8fafc;border-radius:6px;">
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="padding:4px 0;"><strong style="color:#475569;">ブランド:</strong></td>
        <td style="padding:4px 0;color:#1e293b;">${alert.brandName}</td>
      </tr>
      <tr>
        <td style="padding:4px 0;"><strong style="color:#475569;">検知ドメイン:</strong></td>
        <td style="padding:4px 0;"><code style="background:#e2e8f0;padding:2px 6px;border-radius:3px;font-size:14px;">${alert.domain}</code></td>
      </tr>
      <tr>
        <td style="padding:4px 0;"><strong style="color:#475569;">リスクスコア:</strong></td>
        <td style="padding:4px 0;"><span style="display:inline-block;background:${color};color:#fff;padding:2px 10px;border-radius:12px;font-size:13px;font-weight:600;">${alert.riskScore}/100 ${label}</span></td>
      </tr>
      <tr>
        <td style="padding:4px 0;"><strong style="color:#475569;">カテゴリ:</strong></td>
        <td style="padding:4px 0;color:#1e293b;">${alert.category}</td>
      </tr>
      <tr>
        <td style="padding:4px 0;"><strong style="color:#475569;">検知元:</strong></td>
        <td style="padding:4px 0;color:#1e293b;">${alert.source}</td>
      </tr>
    </table>
  </td>
</tr>
</table>
<p style="margin:0;font-size:13px;color:#64748b;">お客様のブランドに対する脅威の可能性があるドメインが検知されました。内容をご確認のうえ、適切な対応をお願いいたします。</p>`;

  return body;
}

function buildSiteChangeHtml(alert: EmailSiteChangeAlert): string {
  const color = riskColor(alert.riskScore);
  const emoji = riskEmoji(alert.riskScore);
  const changeList = alert.changes.map((c) => `<li style="padding:4px 0;color:#334155;">${c}</li>`).join('');

  const body = `
<h2 style="margin:0 0 16px;font-size:16px;color:#1e293b;">🔄 監視対象サイトの変更を検知しました</h2>
<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;">
<tr>
  <td style="padding:12px;background:#f8fafc;border-radius:6px;">
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="padding:4px 0;"><strong style="color:#475569;">ブランド:</strong></td>
        <td style="padding:4px 0;color:#1e293b;">${alert.brandName}</td>
      </tr>
      <tr>
        <td style="padding:4px 0;"><strong style="color:#475569;">対象ドメイン:</strong></td>
        <td style="padding:4px 0;"><code style="background:#e2e8f0;padding:2px 6px;border-radius:3px;font-size:14px;">${alert.domain}</code></td>
      </tr>
      <tr>
        <td style="padding:4px 0;"><strong style="color:#475569;">リスクスコア:</strong></td>
        <td style="padding:4px 0;"><span style="display:inline-block;background:${color};color:#fff;padding:2px 10px;border-radius:12px;font-size:13px;font-weight:600;">${emoji} ${alert.riskScore}/100</span></td>
      </tr>
    </table>
  </td>
</tr>
</table>
<h3 style="margin:0 0 8px;font-size:14px;color:#475569;">検知された変更:</h3>
<ul style="margin:0 0 16px;padding-left:20px;">${changeList}</ul>
<p style="margin:0;font-size:13px;color:#64748b;">監視中のドメインに変更がありました。上記の内容をご確認ください。</p>`;

  return body;
}

function buildScanSummaryHtml(brandName: string, newThreats: number, highRiskCount: number): string {
  const body = `
<h2 style="margin:0 0 16px;font-size:16px;color:#1e293b;">📊 スキャン結果サマリー</h2>
<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;">
<tr>
  <td style="padding:12px;background:#f8fafc;border-radius:6px;">
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="padding:4px 0;"><strong style="color:#475569;">ブランド:</strong></td>
        <td style="padding:4px 0;color:#1e293b;">${brandName}</td>
      </tr>
      <tr>
        <td style="padding:4px 0;"><strong style="color:#475569;">新規脅威:</strong></td>
        <td style="padding:4px 0;color:#1e293b;font-weight:600;">${newThreats}件</td>
      </tr>
      <tr>
        <td style="padding:4px 0;"><strong style="color:#475569;">高リスク（80以上）:</strong></td>
        <td style="padding:4px 0;"><span style="display:inline-block;background:${highRiskCount > 0 ? '#dc2626' : '#16a34a'};color:#fff;padding:2px 10px;border-radius:12px;font-size:13px;font-weight:600;">${highRiskCount}件</span></td>
      </tr>
    </table>
  </td>
</tr>
</table>
<p style="margin:0;font-size:13px;color:#64748b;">ブランド監視の自動スキャン結果です。</p>`;

  return body;
}

async function getEligibleUsers(brandId: string, riskScore: number) {
  const brand = await prisma.brand.findUnique({
    where: { id: brandId },
    select: { organizationId: true },
  });
  if (!brand) return [];

  return prisma.user.findMany({
    where: {
      organizationId: brand.organizationId,
      alertEnabled: true,
      alertThreshold: { lte: riskScore },
      deletedAt: null,
    },
  });
}

async function isDuplicate(userId: string, detectedDomainId: string, type: string): Promise<boolean> {
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const existing = await prisma.alertLog.findFirst({
    where: {
      userId,
      detectedDomainId,
      type,
      sentAt: { gte: twentyFourHoursAgo },
    },
  });
  return !!existing;
}

export async function emailNotifyNewThreat(alert: EmailThreatAlert): Promise<void> {
  const config = await getSenderConfig(alert.brandId);
  if (!config) {
    console.log('[Email] Mail not configured, skipping email notification');
    return;
  }

  const users = await getEligibleUsers(alert.brandId, alert.riskScore);
  if (users.length === 0) return;

  const subject = `[ThreatGuard] ${riskEmoji(alert.riskScore)} 新しい脅威を検知: ${alert.domain}（スコア: ${alert.riskScore}）`;
  const html = wrapHtml(subject, buildNewThreatHtml(alert));

  for (const user of users) {
    if (await isDuplicate(user.id, alert.detectedDomainId, 'new_threat')) {
      console.log(`[Email] Skipping duplicate alert for ${user.email} - ${alert.domain}`);
      continue;
    }

    try {
      await sendEmailViaConfig(config, user.email, subject, html);

      await prisma.alertLog.create({
        data: {
          userId: user.id,
          detectedDomainId: alert.detectedDomainId,
          type: 'new_threat',
          subject,
          status: 'sent',
        },
      });

      console.log(`[Email] New threat alert sent to ${user.email} for ${alert.domain}`);
    } catch (err) {
      console.error(`[Email] Failed to send to ${user.email}:`, err);
      await prisma.alertLog.create({
        data: {
          userId: user.id,
          detectedDomainId: alert.detectedDomainId,
          type: 'new_threat',
          subject,
          status: 'failed',
          error: String(err),
        },
      });
    }
  }
}

export async function emailNotifySiteChange(alert: EmailSiteChangeAlert): Promise<void> {
  const config = await getSenderConfig(alert.brandId);
  if (!config) {
    console.log('[Email] Mail not configured, skipping site change notification');
    return;
  }

  const users = await getEligibleUsers(alert.brandId, alert.riskScore);
  if (users.length === 0) return;

  const subject = `[ThreatGuard] 🔄 サイト変更を検知: ${alert.domain}`;
  const html = wrapHtml(subject, buildSiteChangeHtml(alert));

  for (const user of users) {
    if (await isDuplicate(user.id, alert.detectedDomainId, 'site_change')) {
      console.log(`[Email] Skipping duplicate site change alert for ${user.email} - ${alert.domain}`);
      continue;
    }

    try {
      await sendEmailViaConfig(config, user.email, subject, html);

      await prisma.alertLog.create({
        data: {
          userId: user.id,
          detectedDomainId: alert.detectedDomainId,
          type: 'site_change',
          subject,
          status: 'sent',
        },
      });

      console.log(`[Email] Site change alert sent to ${user.email} for ${alert.domain}`);
    } catch (err) {
      console.error(`[Email] Failed to send site change to ${user.email}:`, err);
      await prisma.alertLog.create({
        data: {
          userId: user.id,
          detectedDomainId: alert.detectedDomainId,
          type: 'site_change',
          subject,
          status: 'failed',
          error: String(err),
        },
      });
    }
  }
}

export async function emailNotifyScanSummary(
  brandId: string,
  brandName: string,
  newThreats: number,
  highRiskCount: number,
): Promise<void> {
  if (newThreats === 0) return;

  const config = await getSenderConfig(brandId);
  if (!config) {
    console.log('[Email] Mail not configured, skipping scan summary notification');
    return;
  }

  // For scan summary, use a threshold of 0 — anyone with alerts enabled gets it
  const brand = await prisma.brand.findUnique({
    where: { id: brandId },
    select: { organizationId: true },
  });
  if (!brand) return;

  const users = await prisma.user.findMany({
    where: {
      organizationId: brand.organizationId,
      alertEnabled: true,
      deletedAt: null,
    },
  });
  if (users.length === 0) return;

  // For scan summary, we need a detectedDomainId. We'll use the most recent one for this brand.
  const latestDomain = await prisma.detectedDomain.findFirst({
    where: { brandId },
    orderBy: { createdAt: 'desc' },
  });
  if (!latestDomain) return;

  const subject = `[ThreatGuard] 📊 スキャン結果: ${brandName} — 新規脅威 ${newThreats}件`;
  const html = wrapHtml(subject, buildScanSummaryHtml(brandName, newThreats, highRiskCount));

  for (const user of users) {
    if (await isDuplicate(user.id, latestDomain.id, 'scan_summary')) {
      console.log(`[Email] Skipping duplicate scan summary for ${user.email}`);
      continue;
    }

    try {
      await sendEmailViaConfig(config, user.email, subject, html);

      await prisma.alertLog.create({
        data: {
          userId: user.id,
          detectedDomainId: latestDomain.id,
          type: 'scan_summary',
          subject,
          status: 'sent',
        },
      });

      console.log(`[Email] Scan summary sent to ${user.email} for ${brandName}`);
    } catch (err) {
      console.error(`[Email] Failed to send scan summary to ${user.email}:`, err);
      await prisma.alertLog.create({
        data: {
          userId: user.id,
          detectedDomainId: latestDomain.id,
          type: 'scan_summary',
          subject,
          status: 'failed',
          error: String(err),
        },
      });
    }
  }
}
