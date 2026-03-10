import { Resend } from 'resend';

interface SendMailOptions {
  from?: string;
  to: string;
  subject: string;
  html: string;
  attachments?: Array<{ filename: string; content: Buffer }>;
}

const RESEND_API_KEY = process.env.RESEND_API_KEY;

/**
 * Send email via Resend API.
 * Brand-specific SMTP is handled separately in email-notifier / takedown-export.
 */
export async function sendMail(opts: SendMailOptions): Promise<void> {
  if (!RESEND_API_KEY) {
    throw new Error('メール設定が未設定です（RESEND_API_KEY を環境変数に追加してください）');
  }

  const resend = new Resend(RESEND_API_KEY);
  const from = opts.from || process.env.RESEND_FROM || 'ThreatGuard <noreply@threatguard.jp>';

  const result = await resend.emails.send({
    from,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
    attachments: opts.attachments?.map((a) => ({
      filename: a.filename,
      content: a.content,
    })),
  });

  if (result.error) {
    throw new Error(`Resend error: ${result.error.message}`);
  }

  console.log(`[Mail/Resend] Sent to ${opts.to}: ${opts.subject}`);
}

/**
 * Check if mail sending is configured (Resend API key set).
 */
export function isMailConfigured(): boolean {
  return !!RESEND_API_KEY;
}
