import { ImageResponse } from 'next/og';
import { getBriefLightByDate } from '@/lib/brief-light-parser';
import { readMarketingPack } from '@/lib/marketing/distribute-log';

export const runtime = 'nodejs';

function formatDisplayDate(date: string): string {
  const d = new Date(`${date}T12:00:00`);
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function stripMarkdown(text: string): string {
  return text.replace(/\*\*/g, '').replace(/\*/g, '').slice(0, 140);
}

interface OgContent {
  title: string;
  displayDate: string;
  lede: string;
}

async function resolveOgContent(date: string): Promise<OgContent | null> {
  const brief = getBriefLightByDate(date);
  if (brief) {
    return {
      title: brief.dailyTitle || 'Super Brief',
      displayDate: brief.displayDate,
      lede: stripMarkdown(brief.lede || brief.epigraph || ''),
    };
  }

  const pack = await readMarketingPack<{
    dailyTitle?: string;
    ogDescription?: string;
  }>(date);

  if (!pack?.dailyTitle && !pack?.ogDescription) {
    return null;
  }

  return {
    title: pack.dailyTitle || 'Super Brief',
    displayDate: formatDisplayDate(date),
    lede: stripMarkdown(pack.ogDescription || ''),
  };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ date: string }> }
) {
  const { date } = await params;
  const content = await resolveOgContent(date);

  if (!content) {
    return new Response('Not found', { status: 404 });
  }

  const { title, displayDate, lede } = content;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          backgroundColor: '#0D0D0D',
          padding: '56px 64px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              backgroundColor: '#FFE600',
              color: '#0D0D0D',
              padding: '6px 12px',
              fontSize: 22,
              fontWeight: 700,
              fontFamily: 'monospace',
            }}
          >
            CT
          </div>
          <span
            style={{
              color: '#888888',
              fontSize: 20,
              fontFamily: 'monospace',
              fontWeight: 600,
            }}
          >
            cosmic_trex
          </span>
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div
            style={{
              color: '#FFE600',
              fontSize: 18,
              fontFamily: 'monospace',
              fontWeight: 600,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              marginBottom: 16,
            }}
          >
            Super Brief · {displayDate}
          </div>
          <div
            style={{
              color: '#FFFFFF',
              fontSize: 52,
              fontWeight: 600,
              lineHeight: 1.15,
              marginBottom: 24,
              maxWidth: 1000,
            }}
          >
            {title}
          </div>
          {lede && (
            <div
              style={{
                color: '#DDDDDD',
                fontSize: 24,
                lineHeight: 1.45,
                fontStyle: 'italic',
                maxWidth: 900,
              }}
            >
              {lede}
            </div>
          )}
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderTop: '3px solid #FFE600',
            paddingTop: 24,
          }}
        >
          <span style={{ color: '#888888', fontSize: 18, fontFamily: 'monospace' }}>
            Markets, Meditations &amp; Mental Models
          </span>
          <span style={{ color: '#FF2E63', fontSize: 18, fontFamily: 'monospace', fontWeight: 700 }}>
            cosmictrex.com
          </span>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}
