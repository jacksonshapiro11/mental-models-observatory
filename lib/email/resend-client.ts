/**
 * Resend email client for sending daily Brief Light emails.
 *
 * Replaces Beehiiv for email delivery. Redis remains source of truth for subscribers.
 *
 * Required env vars:
 *   RESEND_API_KEY       — from Resend dashboard
 *   EMAIL_FROM_ADDRESS   — verified domain email (e.g., jackson@cosmictrex.com)
 *   EMAIL_FROM_NAME      — display name (default: "Jackson @ Mental Models Observatory")
 */

const RESEND_API_URL = 'https://api.resend.com/emails';

export interface SendEmailInput {
  to: string | string[];
  subject: string;
  html: string;
  replyTo?: string;
  tags?: Array<{ name: string; value: string }>;
}

export interface SendEmailResult {
  success: boolean;
  id?: string;
  error?: string;
}

export interface BatchSendResult {
  sent: number;
  failed: Array<{ email: string; error: string }>;
  total: number;
}

function getConfig() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error('RESEND_API_KEY not set');

  const fromAddress = process.env.EMAIL_FROM_ADDRESS || 'jackson@cosmictrex.com';
  const fromName = process.env.EMAIL_FROM_NAME || 'Jackson @ Mental Models Observatory';

  return { apiKey, from: `${fromName} <${fromAddress}>` };
}

/**
 * Send a single email via Resend API.
 * No SDK dependency — just fetch.
 */
export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const { apiKey, from } = getConfig();

  try {
    const res = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: Array.isArray(input.to) ? input.to : [input.to],
        subject: input.subject,
        html: input.html,
        reply_to: input.replyTo || process.env.EMAIL_FROM_ADDRESS || 'jackson@cosmictrex.com',
        tags: input.tags,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      return { success: false, error: `Resend API error: ${res.status} ${text}` };
    }

    const data = (await res.json()) as { id: string };
    return { success: true, id: data.id };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Send email to a batch of subscribers.
 *
 * Resend free tier: 100 emails/day, 2 emails/second.
 * We pace at ~1 email/second for safety.
 */
export async function sendBatch(
  emails: string[],
  subject: string,
  html: string,
  options?: { dryRun?: boolean; tags?: Array<{ name: string; value: string }> }
): Promise<BatchSendResult> {
  const result: BatchSendResult = { sent: 0, failed: [], total: emails.length };

  for (const email of emails) {
    if (options?.dryRun) {
      console.log(`[dry-run] Would send to: ${email}`);
      result.sent++;
      continue;
    }

    const input: SendEmailInput = { to: email, subject, html };
    if (options?.tags) input.tags = options.tags;
    const res = await sendEmail(input);

    if (res.success) {
      result.sent++;
    } else {
      result.failed.push({ email, error: res.error || 'Unknown error' });
    }

    // Rate limit: ~1 email/second (Resend free tier = 2/sec)
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  return result;
}
