const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL;

interface ThreatAlert {
  brandName: string;
  domain: string;
  riskScore: number;
  category: string;
  source: string;
}

function riskEmoji(score: number): string {
  if (score >= 80) return '🔴';
  if (score >= 60) return '🟠';
  if (score >= 40) return '🟡';
  return '🟢';
}

export async function notifyNewThreat(alert: ThreatAlert): Promise<void> {
  if (!SLACK_WEBHOOK_URL) {
    console.log('[Slack] SLACK_WEBHOOK_URL not set, skipping notification');
    return;
  }

  const emoji = riskEmoji(alert.riskScore);

  const payload = {
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `${emoji} New Threat Detected`,
          emoji: true,
        },
      },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*Brand:*\n${alert.brandName}` },
          { type: 'mrkdwn', text: `*Risk Score:*\n${alert.riskScore}/100` },
          { type: 'mrkdwn', text: `*Domain:*\n\`${alert.domain}\`` },
          { type: 'mrkdwn', text: `*Category:*\n${alert.category}` },
          { type: 'mrkdwn', text: `*Source:*\n${alert.source}` },
        ],
      },
    ],
  };

  try {
    const res = await fetch(SLACK_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      console.error(`[Slack] Webhook failed: ${res.status} ${await res.text()}`);
    } else {
      console.log(`[Slack] Alert sent for ${alert.domain}`);
    }
  } catch (err) {
    console.error('[Slack] Webhook error:', err);
  }
}

export async function notifyScanSummary(
  brandName: string,
  newThreats: number,
  highRiskCount: number,
): Promise<void> {
  if (!SLACK_WEBHOOK_URL || newThreats === 0) return;

  const payload = {
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `🛡️ *Scan Complete: ${brandName}*\n• New threats: *${newThreats}*\n• High risk (≥80): *${highRiskCount}*`,
        },
      },
    ],
  };

  try {
    await fetch(SLACK_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.error('[Slack] Summary webhook error:', err);
  }
}
