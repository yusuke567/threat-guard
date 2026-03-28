import { chromium, Browser } from 'playwright';
import nodemailer from 'nodemailer';
import { prisma } from '../lib/prisma.js';
import path from 'path';
import fs from 'fs/promises';
import { sendMail, isMailConfigured } from './mail.js';

const DATA_DIR = process.env.DATA_DIR || process.cwd();
const EXPORT_DIR = path.join(DATA_DIR, 'exports');

// Standard Docker/containerized Chromium flags
const CHROMIUM_ARGS = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',
  '--disable-gpu',
  '--disable-software-rasterizer',
  '--disable-extensions',
  '--disable-background-networking',
  '--disable-default-apps',
  '--disable-sync',
  '--disable-translate',
  '--hide-scrollbars',
  '--metrics-recording-only',
  '--mute-audio',
  '--no-first-run',
  '--safebrowsing-disable-auto-update',
  '--single-process',
  '--no-zygote',
];

/**
 * Get Chromium executable path for the current environment
 */
async function getChromiumPath(): Promise<string | undefined> {
  try {
    const execPath = chromium.executablePath();
    if (execPath) {
      await fs.access(execPath);
      return execPath;
    }
  } catch {
    // Playwright path not accessible
  }

  const browserPath = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (browserPath) {
    try {
      const entries = await fs.readdir(browserPath);
      const chromiumDir = entries.find(e => e.startsWith('chromium-'));
      if (chromiumDir) {
        const chromePath = path.join(browserPath, chromiumDir, 'chrome-linux', 'chrome');
        await fs.access(chromePath);
        return chromePath;
      }
    } catch {
      // Could not find in PLAYWRIGHT_BROWSERS_PATH
    }
  }

  return undefined;
}

/**
 * Load full takedown data with evidence
 */
async function loadTakedownWithEvidence(takedownId: string) {
  const takedown = await prisma.takedownRequest.findUniqueOrThrow({
    where: { id: takedownId },
    include: {
      detectedDomain: {
        include: {
          brand: { include: { organization: true } },
          analyses: { orderBy: { analyzedAt: 'desc' }, take: 3 },
        },
      },
    },
  });

  const dd = takedown.detectedDomain;
  let whois: Record<string, any> = {};
  if (dd.whoisData) {
    try { whois = JSON.parse(dd.whoisData); } catch { /* raw text */ }
  }

  let ssl: Record<string, any> = {};
  if (dd.sslInfo) {
    try { ssl = JSON.parse(dd.sslInfo); } catch {}
  }

  return { takedown, dd, whois, ssl };
}

/**
 * Build evidence HTML section
 */
function buildEvidenceHtml(dd: any, whois: Record<string, any>, ssl: Record<string, any>): string {
  const analysis = dd.analyses?.[0];
  const sections: string[] = [];

  // 1. Threat Analysis
  if (analysis) {
    const categoryMap: Record<string, string> = {
      phishing: 'Phishing',
      brand_abuse: 'Brand Abuse',
      parked: 'Parked Domain',
      legitimate: 'Legitimate',
      unknown: 'Unknown',
    };
    sections.push(`
      <div class="evidence-section">
        <h3>1. Threat Analysis</h3>
        <table class="evidence-table">
          <tr><td class="label">Category</td><td>${categoryMap[analysis.category] || analysis.category}</td></tr>
          <tr><td class="label">Confidence</td><td>${Math.round(analysis.confidence * 100)}%</td></tr>
          <tr><td class="label">Risk Score</td><td><strong>${dd.riskScore ?? 'N/A'}</strong> / 100</td></tr>
          <tr><td class="label">Analysis Date</td><td>${new Date(analysis.analyzedAt).toISOString().split('T')[0]}</td></tr>
        </table>
        <div class="reasoning">${escapeHtml(analysis.reasoning || '')}</div>
      </div>
    `);
  }

  // 2. Domain Registration Info
  const regDate = whois.creationDate || whois.creation_date || whois['Creation Date'] || null;
  const registrar = whois.registrar || whois.Registrar || null;
  const registrant = whois.registrantOrganization || whois['Registrant Organization'] || whois.registrant_organization || null;

  sections.push(`
    <div class="evidence-section">
      <h3>2. Domain Registration Details</h3>
      <table class="evidence-table">
        <tr><td class="label">Infringing Domain</td><td><strong>${escapeHtml(dd.domain)}</strong></td></tr>
        <tr><td class="label">First Detected</td><td>${new Date(dd.firstSeen).toISOString().split('T')[0]}</td></tr>
        <tr><td class="label">Last Seen Active</td><td>${new Date(dd.lastSeen).toISOString().split('T')[0]}</td></tr>
        <tr><td class="label">Detection Source</td><td>${escapeHtml(dd.source)}</td></tr>
        ${registrar ? `<tr><td class="label">Registrar</td><td>${escapeHtml(String(registrar))}</td></tr>` : ''}
        ${regDate ? `<tr><td class="label">Registration Date</td><td>${escapeHtml(String(regDate))}</td></tr>` : ''}
        ${registrant ? `<tr><td class="label">Registrant Org</td><td>${escapeHtml(String(registrant))}</td></tr>` : ''}
      </table>
    </div>
  `);

  // 3. SSL Certificate Info
  if (ssl && Object.keys(ssl).length > 0) {
    const issuer = ssl.issuer || ssl.Issuer || 'Unknown';
    const validFrom = ssl.valid_from || ssl.validFrom || '';
    const validTo = ssl.valid_to || ssl.validTo || '';
    sections.push(`
      <div class="evidence-section">
        <h3>3. SSL Certificate</h3>
        <table class="evidence-table">
          <tr><td class="label">Issuer</td><td>${escapeHtml(String(issuer))}</td></tr>
          ${validFrom ? `<tr><td class="label">Valid From</td><td>${escapeHtml(String(validFrom))}</td></tr>` : ''}
          ${validTo ? `<tr><td class="label">Valid To</td><td>${escapeHtml(String(validTo))}</td></tr>` : ''}
        </table>
      </div>
    `);
  }

  // 4. Screenshot
  if (dd.screenshotUrl) {
    sections.push(`
      <div class="evidence-section">
        <h3>${ssl && Object.keys(ssl).length > 0 ? '4' : '3'}. Screenshot Evidence</h3>
        <img src="${escapeHtml(dd.screenshotUrl)}" style="max-width:100%;border:1px solid #ddd;border-radius:8px;" />
        <p class="caption">Screenshot captured on ${new Date(dd.lastSeen).toISOString().split('T')[0]}</p>
      </div>
    `);
  }

  return sections.join('\n');
}

/**
 * Convert a takedown request template to PDF with evidence
 */
export async function generateTakedownPdf(takedownId: string): Promise<Buffer> {
  const { takedown, dd, whois, ssl } = await loadTakedownWithEvidence(takedownId);
  const evidenceHtml = buildEvidenceHtml(dd, whois, ssl);

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {
      font-family: 'Helvetica Neue', Arial, sans-serif;
      max-width: 700px;
      margin: 40px auto;
      padding: 40px;
      color: #222;
      font-size: 13px;
      line-height: 1.7;
    }
    .header {
      border-bottom: 3px solid #1a56db;
      padding-bottom: 16px;
      margin-bottom: 24px;
    }
    .header h1 { color: #1a56db; font-size: 22px; margin: 0; }
    .header .org { color: #666; font-size: 13px; margin-top: 4px; }
    .meta {
      background: #f8f9fa;
      border-left: 4px solid #1a56db;
      padding: 12px 16px;
      margin: 20px 0;
      font-size: 12px;
    }
    .meta strong { color: #1a56db; }
    .content { white-space: pre-wrap; margin-bottom: 32px; }
    .evidence-divider {
      border-top: 2px solid #e74c3c;
      margin: 32px 0 24px;
      padding-top: 16px;
    }
    .evidence-divider h2 { color: #e74c3c; font-size: 18px; margin: 0 0 4px; }
    .evidence-divider p { color: #666; font-size: 12px; margin: 0; }
    .evidence-section {
      margin: 20px 0;
      padding: 16px;
      background: #fafafa;
      border: 1px solid #eee;
      border-radius: 8px;
    }
    .evidence-section h3 { color: #333; font-size: 14px; margin: 0 0 12px; }
    .evidence-table { width: 100%; border-collapse: collapse; font-size: 12px; }
    .evidence-table td { padding: 6px 8px; border-bottom: 1px solid #eee; }
    .evidence-table .label { color: #666; width: 160px; font-weight: 500; }
    .reasoning {
      margin-top: 12px;
      padding: 10px;
      background: #fff;
      border: 1px solid #e0e0e0;
      border-radius: 4px;
      font-size: 12px;
      color: #444;
    }
    .caption { font-size: 11px; color: #999; margin-top: 8px; }
    .footer {
      margin-top: 40px;
      padding-top: 16px;
      border-top: 1px solid #ddd;
      font-size: 11px;
      color: #999;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>Takedown Request</h1>
    <div class="org">${escapeHtml(dd.brand.organization.name)}</div>
  </div>
  <div class="meta">
    <strong>Infringing Domain:</strong> ${escapeHtml(dd.domain)}<br>
    <strong>Protected Brand:</strong> ${escapeHtml(dd.brand.name)} (${escapeHtml(dd.brand.domain)})<br>
    <strong>Registrar:</strong> ${escapeHtml(takedown.registrar)}<br>
    <strong>Date:</strong> ${new Date().toISOString().split('T')[0]}<br>
    <strong>Risk Score:</strong> ${dd.riskScore ?? 'N/A'} / 100
  </div>
  <div class="content">${escapeHtml(takedown.template)}</div>

  <div class="evidence-divider">
    <h2>Supporting Evidence</h2>
    <p>The following evidence supports this takedown request.</p>
  </div>
  ${evidenceHtml}

  <div class="footer">
    Generated by ThreatGuard — ${new Date().toISOString()}
  </div>
</body>
</html>`;

  let browser: Browser | null = null;
  try {
    const executablePath = await getChromiumPath();
    console.log('[TakedownExport] Launching browser for PDF generation');
    browser = await chromium.launch({
      headless: true,
      executablePath,
      args: CHROMIUM_ARGS,
    });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
    const pdf = await page.pdf({
      format: 'A4',
      margin: { top: '20mm', bottom: '20mm', left: '15mm', right: '15mm' },
      printBackground: true,
    });
    await page.close();
    console.log('[TakedownExport] PDF generated successfully');
    return Buffer.from(pdf);
  } catch (err: any) {
    console.error('[TakedownExport] PDF generation failed:', err.message);
    console.error('[TakedownExport] PDF generation error stack:', err.stack);
    throw err;
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch (closeErr) {
        console.error('[TakedownExport] Error closing browser:', closeErr);
      }
    }
  }
}

/**
 * Save PDF to disk and return path
 */
export async function saveTakedownPdf(takedownId: string): Promise<string> {
  await fs.mkdir(EXPORT_DIR, { recursive: true });
  const pdf = await generateTakedownPdf(takedownId);
  const filename = `takedown-${takedownId.slice(0, 8)}-${Date.now()}.pdf`;
  const filepath = path.join(EXPORT_DIR, filename);
  await fs.writeFile(filepath, pdf);
  return filepath;
}

/**
 * Build plain-text evidence summary for email body
 */
function buildEvidenceText(dd: any, whois: Record<string, any>): string {
  const lines: string[] = [];
  lines.push('\n--- SUPPORTING EVIDENCE ---\n');

  const analysis = dd.analyses?.[0];
  if (analysis) {
    lines.push(`Threat Category: ${analysis.category}`);
    lines.push(`Confidence: ${Math.round(analysis.confidence * 100)}%`);
    lines.push(`Risk Score: ${dd.riskScore ?? 'N/A'} / 100`);
    if (analysis.reasoning) {
      lines.push(`Analysis: ${analysis.reasoning}`);
    }
    lines.push('');
  }

  lines.push(`Domain: ${dd.domain}`);
  lines.push(`First Detected: ${new Date(dd.firstSeen).toISOString().split('T')[0]}`);
  lines.push(`Last Seen: ${new Date(dd.lastSeen).toISOString().split('T')[0]}`);
  lines.push(`Source: ${dd.source}`);

  const registrar = whois.registrar || whois.Registrar || null;
  const regDate = whois.creationDate || whois.creation_date || whois['Creation Date'] || null;
  if (registrar) lines.push(`Registrar: ${registrar}`);
  if (regDate) lines.push(`Registration Date: ${regDate}`);

  lines.push('\nPlease refer to the attached PDF for full evidence including screenshots.');

  return lines.join('\n');
}

/**
 * Send takedown request via email with PDF + evidence
 */
export async function sendTakedownEmail(
  takedownId: string,
  recipientEmail: string,
): Promise<void> {
  const { takedown, dd, whois } = await loadTakedownWithEvidence(takedownId);

  // Try PDF generation with timeout, but don't fail the whole email if Chromium is unavailable
  let pdf: Buffer | null = null;
  try {
    const pdfPromise = generateTakedownPdf(takedownId);
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('PDF generation timed out (15s)')), 15000)
    );
    pdf = await Promise.race([pdfPromise, timeoutPromise]);
  } catch (err) {
    console.warn('PDF generation failed (Chromium may not be installed or timed out), sending email without PDF attachment:', err);
  }

  const brand = dd.brand;

  const senderEmail = brand.senderEmail || process.env.RESEND_FROM;
  const brandName = brand.name;
  const domain = dd.domain;

  // Email body = template + evidence summary
  const evidenceText = buildEvidenceText(dd, whois);
  const fullBody = takedown.template + '\n' + evidenceText;

  const pdfAttachments = pdf
    ? [{ filename: `takedown-${domain}-evidence.pdf`, content: pdf as Buffer }]
    : undefined;

  // Use brand-specific SMTP if configured, otherwise use shared mail (Resend/SMTP)
  if (brand.smtpHost && brand.smtpUser && brand.smtpPass) {
    const port = brand.smtpPort || 465;
    const transporter = nodemailer.createTransport({
      host: brand.smtpHost,
      port,
      secure: port === 465,
      auth: { user: brand.smtpUser, pass: brand.smtpPass },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
    });
    await transporter.sendMail({
      from: senderEmail,
      to: recipientEmail,
      subject: `Takedown Request: ${domain} — Brand Infringement on ${brandName} [Risk: ${dd.riskScore ?? 'N/A'}/100]`,
      text: fullBody,
      attachments: pdfAttachments,
    });
  } else {
    await sendMail({
      from: senderEmail || undefined,
      to: recipientEmail,
      subject: `Takedown Request: ${domain} — Brand Infringement on ${brandName} [Risk: ${dd.riskScore ?? 'N/A'}/100]`,
      html: `<pre>${fullBody}</pre>`,
      attachments: pdfAttachments,
    });
  }

  // Update status
  await prisma.takedownRequest.update({
    where: { id: takedownId },
    data: { status: 'sent', sentAt: new Date() },
  });
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
