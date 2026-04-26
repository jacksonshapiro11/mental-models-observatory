/**
 * Render a BriefLight as an inline-styled HTML email.
 *
 * Design principles:
 * - Table-based layout for Outlook compatibility
 * - All styles inline (no <style> blocks; email clients strip them)
 * - Mobile-first: scales down to 320px
 * - No images required (works even with images blocked)
 * - Sent via Resend; unsubscribe handled in footer link
 */

import { BriefLight } from '../brief-light-parser';

const SITE_URL = 'https://cosmictrex.com';

export interface RenderedEmail {
  subject: string;
  previewText: string;
  html: string;
}

export function renderBriefEmail(brief: BriefLight): RenderedEmail {
  const subject = extractSubject(brief);
  const previewText = truncate(brief.lede || brief.epigraph, 140);
  const webUrl = `${SITE_URL}/super-brief`;
  const fullBriefUrl = `${SITE_URL}/daily-update`;
  const audioUrl = `${SITE_URL}/super-brief`;

  const html = `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="x-apple-disable-message-reformatting">
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background-color:#faf8f3;font-family:Georgia,'Times New Roman',serif;color:#1a1a1a;-webkit-font-smoothing:antialiased;">

<!-- Preview text (hidden) -->
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${escapeHtml(previewText)}</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#faf8f3;">
<tr><td align="center" style="padding:0;">

<table role="presentation" width="620" cellpadding="0" cellspacing="0" border="0" style="max-width:620px;width:100%;background-color:#ffffff;">

  ${renderMasthead(brief, webUrl, audioUrl, fullBriefUrl)}
  ${renderEpigraph(brief)}
  ${renderDailyHeader(brief)}
  ${renderSections(brief)}
  ${renderShareBlock(brief, webUrl)}
  ${renderFooter(webUrl)}

</table>

</td></tr>
</table>

</body>
</html>`;

  return { subject, previewText, html };
}

// ─── Subject line extraction ────────────────────────────────────────────────
// The strongest subject line is the bolded thesis from THE UPDATE section #1.
// Format in markdown: **Thesis headline here.**  on its own line.

function extractSubject(brief: BriefLight): string {
  const update = brief.sections.find((s) => s.id === 'the-update');
  if (update) {
    // First **bold standalone line** — the thesis headline
    const match = update.content.match(/^\*\*(.+?)\*\*\s*$/m);
    if (match && match[1]) return match[1].trim();
  }
  // Fallback: Daily Title (e.g., "The Blockade")
  return brief.dailyTitle || `Brief — ${brief.displayDate}`;
}

// ─── Components ─────────────────────────────────────────────────────────────

function renderMasthead(brief: BriefLight, webUrl: string, audioUrl: string, fullBriefUrl?: string): string {
  return `
  <tr><td style="padding:32px 40px 16px 40px;border-bottom:1px solid #e8e2d5;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td style="font-family:Georgia,serif;font-size:13px;letter-spacing:2px;text-transform:uppercase;color:#6b5d45;font-weight:600;">
          Markets, Meditations &amp; Mental Models
        </td>
        <td align="right" style="font-family:Georgia,serif;font-size:12px;color:#8a7d64;">
          ${escapeHtml(brief.displayDate)}
        </td>
      </tr>
      <tr><td colspan="2" style="padding-top:10px;font-family:Georgia,serif;font-size:13px;">
        <a href="${webUrl}" style="color:#6b5d45;text-decoration:underline;margin-right:16px;">Read on web</a>
        <a href="${audioUrl}" style="color:#6b5d45;text-decoration:underline;margin-right:16px;">Listen · 5 min</a>
        ${fullBriefUrl ? `<a href="${fullBriefUrl}" style="color:#6b5d45;text-decoration:underline;">Read the full brief</a>` : ''}
      </td></tr>
    </table>
  </td></tr>`;
}

function renderEpigraph(brief: BriefLight): string {
  if (!brief.epigraph) return '';
  return `
  <tr><td style="padding:28px 40px 8px 40px;">
    <p style="margin:0;font-family:Georgia,serif;font-style:italic;font-size:16px;line-height:1.55;color:#5a4d38;">
      ${escapeHtml(brief.epigraph)}
    </p>
  </td></tr>`;
}

function renderDailyHeader(brief: BriefLight): string {
  return `
  <tr><td style="padding:24px 40px 8px 40px;">
    <h1 style="margin:0 0 16px 0;font-family:Georgia,serif;font-size:28px;line-height:1.2;font-weight:700;color:#1a1a1a;">
      ${escapeHtml(brief.dailyTitle)}
    </h1>
    ${brief.lede ? `<p style="margin:0;font-family:Georgia,serif;font-style:italic;font-size:15px;line-height:1.6;color:#3d3629;">${escapeInline(brief.lede)}</p>` : ''}
  </td></tr>`;
}

function renderSections(brief: BriefLight): string {
  return brief.sections
    .map((section) => {
      return `
  <tr><td style="padding:24px 40px 0 40px;">
    <div style="border-top:2px solid #c9b88a;padding-top:20px;">
      <div style="font-family:Georgia,serif;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#8a7d64;font-weight:700;margin-bottom:16px;">
        ▸ ${escapeHtml(section.label)}
      </div>
      ${markdownToHtml(section.content)}
    </div>
  </td></tr>`;
    })
    .join('\n');
}

function renderShareBlock(brief: BriefLight, webUrl: string): string {
  const subject = extractSubject(brief);
  const tweetText = encodeURIComponent(`"${subject}"\n\nFrom today's Markets, Meditations & Mental Models:`);
  const tweetUrl = `https://twitter.com/intent/tweet?text=${tweetText}&url=${encodeURIComponent(webUrl)}`;
  const forwardSubject = encodeURIComponent(`Brief — ${brief.displayDate}`);
  const forwardBody = encodeURIComponent(`Thought you'd want this:\n\n${webUrl}\n\nDaily brief for finance pros. 30 minutes of the world, every morning.`);

  return `
  <tr><td style="padding:32px 40px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f5efdf;border-left:4px solid #c9b88a;">
      <tr><td style="padding:20px 24px;">
        <p style="margin:0 0 12px 0;font-family:Georgia,serif;font-size:14px;color:#3d3629;font-weight:600;">
          Know someone who'd want this?
        </p>
        <p style="margin:0 0 16px 0;font-family:Georgia,serif;font-size:14px;line-height:1.5;color:#5a4d38;">
          Forward it to one analyst, PM, or curious friend. Word of mouth is how this grows.
        </p>
        <a href="mailto:?subject=${forwardSubject}&body=${forwardBody}" style="display:inline-block;background-color:#1a1a1a;color:#faf8f3;font-family:Georgia,serif;font-size:13px;text-decoration:none;padding:10px 20px;margin-right:8px;">Forward via email</a>
        <a href="${tweetUrl}" style="display:inline-block;background-color:#ffffff;color:#1a1a1a;font-family:Georgia,serif;font-size:13px;text-decoration:none;padding:10px 20px;border:1px solid #1a1a1a;">Share on X</a>
      </td></tr>
    </table>
  </td></tr>`;
}

function renderFooter(webUrl: string): string {
  return `
  <tr><td style="padding:24px 40px 40px 40px;border-top:1px solid #e8e2d5;">
    <p style="margin:0 0 8px 0;font-family:Georgia,serif;font-size:13px;line-height:1.6;color:#6b5d45;">
      Reply to this email and tell me what I missed. I read every one.
    </p>
    <p style="margin:0;font-family:Georgia,serif;font-size:12px;line-height:1.6;color:#8a7d64;">
      <a href="${webUrl}" style="color:#6b5d45;">View in browser</a> &nbsp;·&nbsp;
      <a href="${SITE_URL}" style="color:#6b5d45;">The Observatory</a> &nbsp;·&nbsp;
      <a href="${SITE_URL}/archive" style="color:#6b5d45;">Archive</a>
    </p>
  </td></tr>`;
}

// ─── Markdown → HTML (minimal, section-body tuned) ──────────────────────────
// Handles: paragraphs, **bold**, *italic*, [text](url), horizontal rules.
// The light-brief section bodies never use lists or code — keeping this focused.

function markdownToHtml(md: string): string {
  const blocks = md
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean);

  return blocks
    .map((block) => {
      if (/^---+$/.test(block)) return '';

      // Blockquote (used in The Meditation for the quote)
      if (block.startsWith('>')) {
        const inner = block.replace(/^>\s?/gm, '').trim();
        return `<blockquote style="margin:0 0 16px 0;padding:0 0 0 16px;border-left:3px solid #c9b88a;font-family:Georgia,serif;font-style:italic;font-size:16px;line-height:1.6;color:#3d3629;">${escapeInline(inner)}</blockquote>`;
      }

      // Fully-bold line = section-internal headline (the UPDATE theses)
      const boldHeadlineMatch = block.match(/^\*\*([\s\S]+)\*\*$/);
      if (boldHeadlineMatch && boldHeadlineMatch[1]) {
        return `<p style="margin:0 0 12px 0;font-family:Georgia,serif;font-size:17px;line-height:1.35;font-weight:700;color:#1a1a1a;">${escapeInline(boldHeadlineMatch[1])}</p>`;
      }

      // H3 (used for The Model name)
      const h3Match = block.match(/^###\s+(.+)$/);
      if (h3Match && h3Match[1]) {
        return `<h3 style="margin:0 0 12px 0;font-family:Georgia,serif;font-size:20px;line-height:1.3;font-weight:700;color:#1a1a1a;">${escapeInline(h3Match[1])}</h3>`;
      }

      // Fully-italic paragraph (markets minute, meditation frame)
      const italicMatch = block.match(/^\*([^*][\s\S]+[^*])\*$/);
      if (italicMatch && italicMatch[1]) {
        return `<p style="margin:0 0 20px 0;font-family:Georgia,serif;font-style:italic;font-size:15px;line-height:1.7;color:#3d3629;">${escapeInline(italicMatch[1])}</p>`;
      }

      // Default: body paragraph
      return `<p style="margin:0 0 20px 0;font-family:Georgia,serif;font-size:16px;line-height:1.7;color:#1a1a1a;">${escapeInline(block)}</p>`;
    })
    .join('\n');
}

// ─── Inline formatting ──────────────────────────────────────────────────────

function escapeInline(text: string): string {
  // Order matters: escape HTML first, then apply inline markdown
  let out = escapeHtml(text);

  // Links [text](url)
  out = out.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2" style="color:#6b5d45;text-decoration:underline;">$1</a>'
  );

  // Bold **text**
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong style="font-weight:700;">$1</strong>');

  // Italic *text* (but not ** already consumed)
  out = out.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');

  // Line breaks within a paragraph
  out = out.replace(/\n/g, '<br>');

  return out;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function truncate(text: string, max: number): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  return clean.slice(0, max - 1).trimEnd() + '…';
}
