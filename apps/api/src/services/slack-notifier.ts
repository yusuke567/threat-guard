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

interface SiteChangeAlert {
  brandName: string;
  domain: string;
  changes: string[];
}

export async function notifySiteChange(alert: SiteChangeAlert): Promise<void> {
  if (!SLACK_WEBHOOK_URL) {
    console.log('[Slack] SLACK_WEBHOOK_URL not set, skipping site change notification');
    return;
  }

  const changeList = alert.changes.map((c) => `• ${c}`).join('\n');

  const payload = {
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '🔄 サイト変化検知',
          emoji: true,
        },
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
        text: {
          type: 'mrkdwn',
          text: `*変更内容:*\n${changeList}`,
        },
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
      console.error(`[Slack] Site change webhook failed: ${res.status}`);
    } else {
      console.log(`[Slack] Site change alert sent for ${alert.domain}`);
    }
  } catch (err) {
    console.error('[Slack] Site change webhook error:', err);
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
