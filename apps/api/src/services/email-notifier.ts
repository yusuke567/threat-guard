import nodemailer from 'nodemailer';
import { prisma } from '../lib/prisma.js';

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
  if (score >= 80) return 'Critical';
  if (score >= 60) return 'High';
  if (score >= 40) return 'Medium';
  return 'Low';
}

async function getTransporter(brandId: string) {
  const brand = await prisma.brand.findUnique({ where: { id: brandId } });

  const host = brand?.smtpHost || process.env.SMTP_HOST;
  const port = brand?.smtpPort || Number(process.env.SMTP_PORT) || 587;
  const user = brand?.smtpUser || process.env.SMTP_USER;
  const pass = brand?.smtpPass || process.env.SMTP_PASS;
  const senderEmail = brand?.senderEmail || process.env.SMTP_FROM || user;

  if (!host || !user || !pass) {
    return null;
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  return { transporter, senderEmail };
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
  <h1 style="margin:0;color:#ffffff;font-size:18px;">🛡️ ThreatGuard Alert</h1>
</td></tr>
<tr><td style="padding:24px;">
${body}
</td></tr>
<tr><td style="background:#f8fafc;padding:16px 24px;border-top:1px solid #e2e8f0;">
  <p style="margin:0;font-size:12px;color:#94a3b8;text-align:center;">
    You are receiving this because alerts are enabled for your account.<br>
    <a href="#unsubscribe" style="color:#64748b;">Unsubscribe from alerts</a>
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
<h2 style="margin:0 0 16px;font-size:16px;color:#1e293b;">${emoji} New Threat Detected</h2>
<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;">
<tr>
  <td style="padding:12px;background:#f8fafc;border-radius:6px;">
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="padding:4px 0;"><strong style="color:#475569;">Brand:</strong></td>
        <td style="padding:4px 0;color:#1e293b;">${alert.brandName}</td>
      </tr>
      <tr>
        <td style="padding:4px 0;"><strong style="color:#475569;">Domain:</strong></td>
        <td style="padding:4px 0;"><code style="background:#e2e8f0;padding:2px 6px;border-radius:3px;font-size:14px;">${alert.domain}</code></td>
      </tr>
      <tr>
        <td style="padding:4px 0;"><strong style="color:#475569;">Risk Score:</strong></td>
        <td style="padding:4px 0;"><span style="display:inline-block;background:${color};color:#fff;padding:2px 10px;border-radius:12px;font-size:13px;font-weight:600;">${alert.riskScore}/100 ${label}</span></td>
      </tr>
      <tr>
        <td style="padding:4px 0;"><strong style="color:#475569;">Category:</strong></td>
        <td style="padding:4px 0;color:#1e293b;">${alert.category}</td>
      </tr>
      <tr>
        <td style="padding:4px 0;"><strong style="color:#475569;">Source:</strong></td>
        <td style="padding:4px 0;color:#1e293b;">${alert.source}</td>
      </tr>
    </table>
  </td>
</tr>
</table>
<p style="margin:0;font-size:13px;color:#64748b;">This domain was detected and may pose a threat to your brand. Please review and take appropriate action.</p>`;

  return body;
}

function buildSiteChangeHtml(alert: EmailSiteChangeAlert): string {
  const color = riskColor(alert.riskScore);
  const emoji = riskEmoji(alert.riskScore);
  const changeList = alert.changes.map((c) => `<li style="padding:4px 0;color:#334155;">${c}</li>`).join('');

  const body = `
<h2 style="margin:0 0 16px;font-size:16px;color:#1e293b;">🔄 Site Change Detected</h2>
<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;">
<tr>
  <td style="padding:12px;background:#f8fafc;border-radius:6px;">
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="padding:4px 0;"><strong style="color:#475569;">Brand:</strong></td>
        <td style="padding:4px 0;color:#1e293b;">${alert.brandName}</td>
      </tr>
      <tr>
        <td style="padding:4px 0;"><strong style="color:#475569;">Domain:</strong></td>
        <td style="padding:4px 0;"><code style="background:#e2e8f0;padding:2px 6px;border-radius:3px;font-size:14px;">${alert.domain}</code></td>
      </tr>
      <tr>
        <td style="padding:4px 0;"><strong style="color:#475569;">Risk Score:</strong></td>
        <td style="padding:4px 0;"><span style="display:inline-block;background:${color};color:#fff;padding:2px 10px;border-radius:12px;font-size:13px;font-weight:600;">${emoji} ${alert.riskScore}/100</span></td>
      </tr>
    </table>
  </td>
</tr>
</table>
<h3 style="margin:0 0 8px;font-size:14px;color:#475569;">Changes Detected:</h3>
<ul style="margin:0 0 16px;padding-left:20px;">${changeList}</ul>
<p style="margin:0;font-size:13px;color:#64748b;">The monitored domain has changed. Please review the changes above.</p>`;

  return body;
}

function buildScanSummaryHtml(brandName: string, newThreats: number, highRiskCount: number): string {
  const body = `
<h2 style="margin:0 0 16px;font-size:16px;color:#1e293b;">📊 Scan Summary</h2>
<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;">
<tr>
  <td style="padding:12px;background:#f8fafc;border-radius:6px;">
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="padding:4px 0;"><strong style="color:#475569;">Brand:</strong></td>
        <td style="padding:4px 0;color:#1e293b;">${brandName}</td>
      </tr>
      <tr>
        <td style="padding:4px 0;"><strong style="color:#475569;">New Threats:</strong></td>
        <td style="padding:4px 0;color:#1e293b;font-weight:600;">${newThreats}</td>
      </tr>
      <tr>
        <td style="padding:4px 0;"><strong style="color:#475569;">High Risk (≥80):</strong></td>
        <td style="padding:4px 0;"><span style="display:inline-block;background:${highRiskCount > 0 ? '#dc2626' : '#16a34a'};color:#fff;padding:2px 10px;border-radius:12px;font-size:13px;font-weight:600;">${highRiskCount}</span></td>
      </tr>
    </table>
  </td>
</tr>
</table>
<p style="margin:0;font-size:13px;color:#64748b;">This is an automated scan summary for your brand monitoring.</p>`;

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
  const smtp = await getTransporter(alert.brandId);
  if (!smtp) {
    console.log('[Email] SMTP not configured, skipping email notification');
    return;
  }

  const users = await getEligibleUsers(alert.brandId, alert.riskScore);
  if (users.length === 0) return;

  const subject = `[ThreatGuard] ${riskEmoji(alert.riskScore)} New Threat: ${alert.domain} (Score: ${alert.riskScore})`;
  const html = wrapHtml(subject, buildNewThreatHtml(alert));

  for (const user of users) {
    if (await isDuplicate(user.id, alert.detectedDomainId, 'new_threat')) {
      console.log(`[Email] Skipping duplicate alert for ${user.email} - ${alert.domain}`);
      continue;
    }

    try {
      await smtp.transporter.sendMail({
        from: smtp.senderEmail,
        to: user.email,
        subject,
        html,
      });

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
  const smtp = await getTransporter(alert.brandId);
  if (!smtp) {
    console.log('[Email] SMTP not configured, skipping site change notification');
    return;
  }

  const users = await getEligibleUsers(alert.brandId, alert.riskScore);
  if (users.length === 0) return;

  const subject = `[ThreatGuard] 🔄 Site Change: ${alert.domain}`;
  const html = wrapHtml(subject, buildSiteChangeHtml(alert));

  for (const user of users) {
    if (await isDuplicate(user.id, alert.detectedDomainId, 'site_change')) {
      console.log(`[Email] Skipping duplicate site change alert for ${user.email} - ${alert.domain}`);
      continue;
    }

    try {
      await smtp.transporter.sendMail({
        from: smtp.senderEmail,
        to: user.email,
        subject,
        html,
      });

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

  const smtp = await getTransporter(brandId);
  if (!smtp) {
    console.log('[Email] SMTP not configured, skipping scan summary notification');
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
    },
  });
  if (users.length === 0) return;

  // For scan summary, we need a detectedDomainId. We'll use the most recent one for this brand.
  const latestDomain = await prisma.detectedDomain.findFirst({
    where: { brandId },
    orderBy: { createdAt: 'desc' },
  });
  if (!latestDomain) return;

  const subject = `[ThreatGuard] 📊 Scan Summary: ${brandName} — ${newThreats} new threats`;
  const html = wrapHtml(subject, buildScanSummaryHtml(brandName, newThreats, highRiskCount));

  for (const user of users) {
    if (await isDuplicate(user.id, latestDomain.id, 'scan_summary')) {
      console.log(`[Email] Skipping duplicate scan summary for ${user.email}`);
      continue;
    }

    try {
      await smtp.transporter.sendMail({
        from: smtp.senderEmail,
        to: user.email,
        subject,
        html,
      });

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
