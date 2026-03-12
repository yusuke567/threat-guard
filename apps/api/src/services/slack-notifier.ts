import { prisma } from '../lib/prisma.js';

const GLOBAL_SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL;

interface ThreatAlert {
  brandName: string;
  domain: string;
  riskScore: number;
  category: string;
  source: string;
}

interface SiteChangeAlert {
  brandName: string;
  domain: string;
  changes: string[];
}

function riskEmoji(score: number): string {
  if (score >= 80) return '🔴';
  if (score >= 60) return '🟠';
  if (score >= 40) return '🟡';
  return '🟢';
}

/**
 * Resolve webhook URLs for a brand — returns org-level + global fallback.
 */
async function resolveWebhookUrls(brandId: string): Promise<string[]> {
  const urls: string[] = [];

  try {
    const brand = await prisma.brand.findUnique({
      where: { id: brandId },
      include: {
        organization: {
          select: {
            slackWebhookUrl: true,
            slackNotifyEnabled: true,
            slackNotifyThreshold: true,
            slackNotifyTypes: true,
          },
        },
      },
    });

    if (brand?.organization?.slackNotifyEnabled && brand.organization.slackWebhookUrl) {
      urls.push(brand.organization.slackWebhookUrl);
    }
  } catch (err) {
    console.error('[Slack] Failed to resolve org webhook:', err);
  }

  // Global fallback (always send to internal channel if configured)
  if (GLOBAL_SLACK_WEBHOOK_URL) {
    urls.push(GLOBAL_SLACK_WEBHOOK_URL);
  }

  return [...new Set(urls)]; // dedupe
}

/**
 * Check if org allows this notification type and meets threshold.
 */
async function shouldNotifyOrg(
  brandId: string,
  type: 'new_threat' | 'site_change' | 'scan_summary',
  riskScore?: number,
): Promise<boolean> {
  try {
    const brand = await prisma.brand.findUnique({
      where: { id: brandId },
      include: {
        organization: {
          select: {
            slackNotifyEnabled: true,
            slackNotifyThreshold: true,
            slackNotifyTypes: true,
          },
        },
      },
    });

    if (!brand?.organization?.slackNotifyEnabled) return false;

    const allowedTypes = brand.organization.slackNotifyTypes.split(',').map((t) => t.trim());
    if (!allowedTypes.includes(type)) return false;

    if (riskScore !== undefined && riskScore < brand.organization.slackNotifyThreshold) return false;

    return true;
  } catch {
    return false;
  }
}

async function sendToWebhook(url: string, payload: object): Promise<void> {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      console.error(`[Slack] Webhook failed: ${res.status} ${await res.text()}`);
    }
  } catch (err) {
    console.error('[Slack] Webhook error:', err);
  }
}

// ── Public notification functions (backward-compatible signatures + brandId overloads) ──

export async function notifyNewThreat(alert: ThreatAlert & { brandId?: string }): Promise<void> {
  const emoji = riskEmoji(alert.riskScore);

  const payload = {
    blocks: [
      {
        type: 'header',
        text: { type: 'plain_text', text: `${emoji} 新規脅威検知`, emoji: true },
      },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*ブランド:*\n${alert.brandName}` },
          { type: 'mrkdwn', text: `*リスクスコア:*\n${alert.riskScore}/100` },
          { type: 'mrkdwn', text: `*ドメイン:*\n\`${alert.domain}\`` },
          { type: 'mrkdwn', text: `*カテゴリ:*\n${alert.category}` },
          { type: 'mrkdwn', text: `*ソース:*\n${alert.source}` },
        ],
      },
    ],
  };

  if (alert.brandId) {
    const orgAllowed = await shouldNotifyOrg(alert.brandId, 'new_threat', alert.riskScore);
    const urls = await resolveWebhookUrls(alert.brandId);

    for (const url of urls) {
      // Skip org webhook if org settings don't allow this notification
      if (url !== GLOBAL_SLACK_WEBHOOK_URL && !orgAllowed) continue;
      await sendToWebhook(url, payload);
    }
  } else {
    // Legacy fallback: global webhook only
    if (GLOBAL_SLACK_WEBHOOK_URL) {
      await sendToWebhook(GLOBAL_SLACK_WEBHOOK_URL, payload);
    }
  }
}

export async function notifySiteChange(alert: SiteChangeAlert & { brandId?: string }): Promise<void> {
  const changeList = alert.changes.map((c) => `• ${c}`).join('\n');

  const payload = {
    blocks: [
      {
        type: 'header',
        text: { type: 'plain_text', text: '🔄 サイト変化検知', emoji: true },
      },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*ブランド:*\n${alert.brandName}` },
          { type: 'mrkdwn', text: `*ドメイン:*\n\`${alert.domain}\`` },
        ],
      },
      {
        type: 'section',
        text: { type: 'mrkdwn', text: `*変更内容:*\n${changeList}` },
      },
    ],
  };

  if (alert.brandId) {
    const orgAllowed = await shouldNotifyOrg(alert.brandId, 'site_change');
    const urls = await resolveWebhookUrls(alert.brandId);

    for (const url of urls) {
      if (url !== GLOBAL_SLACK_WEBHOOK_URL && !orgAllowed) continue;
      await sendToWebhook(url, payload);
    }
  } else {
    if (GLOBAL_SLACK_WEBHOOK_URL) {
      await sendToWebhook(GLOBAL_SLACK_WEBHOOK_URL, payload);
    }
  }
}

export async function notifyScanSummary(
  brandName: string,
  newThreats: number,
  highRiskCount: number,
  brandId?: string,
): Promise<void> {
  if (newThreats === 0) return;

  const payload = {
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `🛡️ *スキャン完了: ${brandName}*\n• 新規脅威: *${newThreats}*\n• 高リスク (≥80): *${highRiskCount}*`,
        },
      },
    ],
  };

  if (brandId) {
    const orgAllowed = await shouldNotifyOrg(brandId, 'scan_summary');
    const urls = await resolveWebhookUrls(brandId);

    for (const url of urls) {
      if (url !== GLOBAL_SLACK_WEBHOOK_URL && !orgAllowed) continue;
      await sendToWebhook(url, payload);
    }
  } else {
    if (GLOBAL_SLACK_WEBHOOK_URL) {
      await sendToWebhook(GLOBAL_SLACK_WEBHOOK_URL, payload);
    }
  }
}

/**
 * Send a test message to a specific webhook URL.
 */
export async function sendSlackTest(webhookUrl: string, orgName: string): Promise<boolean> {
  const payload = {
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `✅ *ThreatGuard テスト通知*\n組織「${orgName}」のSlack連携が正常に動作しています。`,
        },
      },
    ],
  };

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return res.ok;
  } catch (err) {
    console.error('[Slack] Test webhook error:', err);
    return false;
  }
}
