/**
 * Welcome email sent on new subscription.
 */

import { sendEmail } from '@/lib/email/resend-client';

const SITE_URL = 'https://cosmictrex.com';

export async function sendWelcomeEmail(email: string): Promise<{ success: boolean; error?: string }> {
  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#faf8f3;font-family:Georgia,'Times New Roman',serif;color:#1a1a1a;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#faf8f3;">
<tr><td align="center" style="padding:40px 20px;">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;background-color:#ffffff;">
  <tr><td style="padding:40px;">
    <p style="margin:0 0 8px 0;font-size:13px;letter-spacing:2px;text-transform:uppercase;color:#6b5d45;font-weight:600;">
      Cosmic Trex
    </p>
    <h1 style="margin:0 0 20px 0;font-size:24px;line-height:1.3;font-weight:700;color:#1a1a1a;">
      You're in.
    </h1>
    <p style="margin:0 0 16px 0;font-size:16px;line-height:1.7;color:#1a1a1a;">
      Every morning you'll get the Super Brief — markets, meditations, and mental models in one tight read.
    </p>
    <p style="margin:0 0 24px 0;font-size:16px;line-height:1.7;color:#3d3629;">
      While you wait, catch up on the archive or listen on Apple Podcasts.
    </p>
    <p style="margin:0;font-size:14px;line-height:1.6;">
      <a href="${SITE_URL}/super-brief" style="color:#6b5d45;text-decoration:underline;">Read today's brief</a>
      &nbsp;·&nbsp;
      <a href="${SITE_URL}/archive" style="color:#6b5d45;text-decoration:underline;">Archive</a>
    </p>
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;

  const result = await sendEmail({
    to: email,
    subject: "You're in — Cosmic Trex",
    html,
    tags: [{ name: 'type', value: 'welcome' }],
  });

  if (result.success) return { success: true };
  return { success: false, error: result.error || 'Unknown error' };
}
