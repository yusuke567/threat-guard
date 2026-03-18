import { prisma } from '../lib/prisma.js';

const GLOBAL_SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL || '';

// Track failed webhook URLs to avoid log spam (URL → failure timestamp)
const failedWebhooks = new Map<string, number>();
const WEBHOOK_COOLDOWN_MS = 30 * 60 * 1000; // 30 min cooldown after failure

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
 * Resolve webhook URLs for a brand.
 * - Org webhook: only if slackNotifyEnabled is ON
 * - Global webhook: always included if configured (internal monitoring)
 * Returns { orgEnabled, urls } so callers can skip org-specific checks when toggle is off.
 */
async function resolveWebhookUrls(brandId: string): Promise<{ orgEnabled: boolean; urls: string[] }> {
  const urls: string[] = [];
  let orgEnabled = false;

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

    orgEnabled = brand?.organization?.slackNotifyEnabled ?? false;

    if (orgEnabled && brand?.organization?.slackWebhookUrl) {
      urls.push(brand.organization.slackWebhookUrl);
    }
  } catch (err) {
    console.error('[Slack] Failed to resolve org webhook:', err);
  }

  // Global webhook for internal monitoring (independent of org toggle)
  if (GLOBAL_SLACK_WEBHOOK_URL) {
    urls.push(GLOBAL_SLACK_WEBHOOK_URL);
  }

  return { orgEnabled, urls: [...new Set(urls)] };
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
  if (!url) return;

  // Skip if this URL recently failed (avoid log spam)
  const lastFail = failedWebhooks.get(url);
  if (lastFail && Date.now() - lastFail < WEBHOOK_COOLDOWN_MS) return;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const body = await res.text();
      console.error(`[Slack] Webhook failed: ${res.status} ${body} — suppressing retries for 30min`);
      failedWebhooks.set(url, Date.now());
    } else {
      // Clear cooldown on success (e.g. URL was fixed)
      failedWebhooks.delete(url);
    }
  } catch (err) {
    console.error('[Slack] Webhook error:', err, '— suppressing retries for 30min');
    failedWebhooks.set(url, Date.now());
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
    const { orgEnabled, urls } = await resolveWebhookUrls(alert.brandId);

    if (urls.length === 0) return; // No webhooks configured at all

    const orgAllowed = orgEnabled && await shouldNotifyOrg(alert.brandId, 'new_threat', alert.riskScore);

    for (const url of urls) {
      // Org webhook: only if toggle is ON and notification type/threshold passes
      if (url !== GLOBAL_SLACK_WEBHOOK_URL && !orgAllowed) continue;
      await sendToWebhook(url, payload);
    }
  } else {
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
    const { orgEnabled, urls } = await resolveWebhookUrls(alert.brandId);

    if (urls.length === 0) return;

    const orgAllowed = orgEnabled && await shouldNotifyOrg(alert.brandId, 'site_change');

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
    const { orgEnabled, urls } = await resolveWebhookUrls(brandId);

    if (urls.length === 0) return;

    const orgAllowed = orgEnabled && await shouldNotifyOrg(brandId, 'scan_summary');

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
