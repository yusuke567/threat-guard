import { Resend } from 'resend';
import nodemailer from 'nodemailer';

interface SendMailOptions {
  from?: string;
  to: string;
  subject: string;
  html: string;
  attachments?: Array<{ filename: string; content: Buffer }>;
}

const RESEND_API_KEY = process.env.RESEND_API_KEY;

/**
 * Send email via Resend (preferred) or nodemailer SMTP (fallback).
 * Resend uses HTTP API so it works on Railway without SMTP port access.
 */
export async function sendMail(opts: SendMailOptions): Promise<void> {
  if (RESEND_API_KEY) {
    return sendViaResend(opts);
  }
  return sendViaSMTP(opts);
}

async function sendViaResend(opts: SendMailOptions): Promise<void> {
  const resend = new Resend(RESEND_API_KEY);
  const from = opts.from || process.env.RESEND_FROM || process.env.SMTP_FROM || 'ThreatGuard <noreply@threatguard.jp>';

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

async function sendViaSMTP(opts: SendMailOptions): Promise<void> {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT) || 465;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = opts.from || process.env.SMTP_FROM || user;

  if (!host || !user || !pass) {
    throw new Error('メール設定が未設定です（RESEND_API_KEY または SMTP_HOST/USER/PASS が必要）');
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  });

  await transporter.sendMail({
    from,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
    attachments: opts.attachments?.map((a) => ({
      filename: a.filename,
      content: a.content,
    })),
  });

  console.log(`[Mail/SMTP] Sent to ${opts.to}: ${opts.subject}`);
}

/**
 * Check if mail sending is configured.
 */
export function isMailConfigured(): boolean {
  if (RESEND_API_KEY) return true;
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}
