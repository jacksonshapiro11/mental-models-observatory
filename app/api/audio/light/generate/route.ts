/**
 * /api/audio/light/generate — Brief Light (Super Brief) audio generation endpoint
 *
 * Completely standalone — does NOT modify or depend on the main brief audio pipeline.
 *
 * POST: Generates audio for a Brief Light. Reads the -light.md file,
 * preprocesses it for TTS, generates audio via OpenAI, uploads to
 * Vercel Blob, and stores metadata in Redis (light namespace).
 *
 * Query params:
 *   ?date=YYYY-MM-DD  — Generate for a specific date (defaults to latest)
 *   ?force=true       — Regenerate even if audio already exists
 *
 * Protected by SNAPSHOT_SECRET / CRON_SECRET (same auth pattern as main pipeline).
 * Triggered by Vercel cron or manual POST.
 */

// Allow up to 5 minutes for audio generation
export const maxDuration = 300;

import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import OpenAI from 'openai';
import { getBriefLightByDate, getLatestBriefLight } from '@/lib/brief-light-parser';
import { preprocessBriefLightForTTS } from '@/lib/audio/text-preprocessor';
import { OpenAITTSClient, generateFullAudio } from '@/lib/audio/tts-client';
import { writeLightEpisodeMetadata, readLightEpisodeMetadata } from '@/lib/audio/podcast-feed';

// ─── Auth ───────────────────────────────────────────────────────────────────

function isAuthorized(req: NextRequest): boolean {
  const snapshotSecret = process.env.SNAPSHOT_SECRET;
  const cronSecret = process.env.CRON_SECRET;

  if (!snapshotSecret && !cronSecret) {
    console.error('[audio:light] Neither SNAPSHOT_SECRET nor CRON_SECRET is set');
    return false;
  }

  const secret = req.headers.get('x-snapshot-secret') || req.nextUrl.searchParams.get('secret');
  if (secret && snapshotSecret && secret === snapshotSecret) return true;

  const authHeader = req.headers.get('authorization');
  if (authHeader) {
    const token = authHeader.replace('Bearer ', '');
    if (cronSecret && token === cronSecret) return true;
    if (snapshotSecret && token === snapshotSecret) return true;
  }

  console.warn(`[audio:light] Auth failed.`);
  return false;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function extractDescription(brief: { sections: { content: string }[]; epigraph?: string }): string {
  // Use first section's first paragraph as description, or fall back to epigraph
  const firstContent = brief.sections[0]?.content || brief.epigraph || '';
  return firstContent
    .split('\n')
    .find(l => l.trim() && !l.startsWith('**') && !l.startsWith('#'))
    ?.replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .slice(0, 300) || 'Your compressed daily intelligence brief.';
}

/** Generate a punchy episode title for the Super Brief */
async function generateEpisodeTitle(lede: string, displayDate: string, apiKey: string): Promise<string> {
  try {
    const client = new OpenAI({ apiKey });
    const resp = await client.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You generate punchy, clickbaity podcast episode titles for the "Super Brief" — a compressed daily intelligence update. 4-8 words max. Make someone NEED to tap play.

Rules:
- Pull from the 1-2 most dramatic/surprising stories
- Use power words: Breaks, Hits, Crashes, Secret, Nobody Saw, Unravels, Explodes
- Be specific — name the company, asset, or event
- No dates in the title
- No generic titles like "Market Update" or "Daily Roundup"
- Use sentence case, not title case
- Return ONLY the title, nothing else`,
        },
        {
          role: 'user',
          content: `Generate an episode title from this lede:\n\n${lede}`,
        },
      ],
      temperature: 0.8,
      max_tokens: 50,
    });
    const title = resp.choices[0]?.message?.content?.trim();
    if (title && title.length > 0 && title.length < 80) {
      return title;
    }
  } catch (err) {
    console.warn(`[audio:light] Title generation failed (${err}), using fallback`);
  }
  return `Super Brief — ${displayDate}`;
}

// ─── POST handler ───────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const dateParam = req.nextUrl.searchParams.get('date');
  const force = req.nextUrl.searchParams.get('force') === 'true';

  try {
    // 1. Load the Brief Light
    const brief = dateParam ? getBriefLightByDate(dateParam) : getLatestBriefLight();

    if (!brief) {
      return NextResponse.json(
        { error: 'Brief Light not found', date: dateParam || 'latest' },
        { status: 404 }
      );
    }

    // 2. Check if audio already exists
    if (!force) {
      const existing = await readLightEpisodeMetadata(brief.date);
      if (existing) {
        return NextResponse.json({
          status: 'exists',
          message: `Super Brief audio already exists for ${brief.date}. Use ?force=true to regenerate.`,
          episode: existing,
        });
      }
    }

    console.log(`[audio:light] Generating Super Brief audio for ${brief.date}...`);

    // 3. Prepare for TTS
    const openaiApiKey = process.env.OPENAI_API_KEY!;

    // 4. Preprocess for TTS — use dedicated Brief Light preprocessor
    //    (The main preprocessBriefForTTS looks for full-brief section markers
    //     like "# ▸ THE SIX" which don't exist in the light format)
    const preprocessed = await preprocessBriefLightForTTS(
      {
        date: brief.date,
        displayDate: brief.displayDate,
        epigraph: brief.epigraph,
        sections: brief.sections.map(s => ({ id: s.id, label: s.label, content: s.content })),
      },
      {
        openaiApiKey,
        skipLlmCleanup: false,
      }
    );

    console.log(`[audio:light] Script: ${preprocessed.characterCount} characters, ${preprocessed.sections.length} sections`);

    // 5. Generate audio via TTS
    const selectedVoice = process.env.TTS_VOICE || 'onyx';
    console.log(`[audio:light] TTS voice: ${selectedVoice}`);

    const ttsClient = new OpenAITTSClient(openaiApiKey, {
      voice: selectedVoice,
      model: 'gpt-4o-mini-tts',
    });

    const { audio, chunks, characterCount } = await generateFullAudio(
      ttsClient,
      preprocessed.fullText,
      {
        instructions: `Voice: bright, energized, genuinely curious. This is the SUPER BRIEF — the compressed version. Move with pace and purpose. Every sentence earns its spot. Like a smart friend giving you the 5-minute version over coffee because you're both running late but the stories are too good to skip.

Pacing: Faster than the full brief. Keep momentum high. Brief pauses between stories to let the listener reset, but no lingering. This is the express lane.

Tone: Confident, curious, punchy. Even serious stories get delivered with energy — "isn't it wild that this is happening?" not doom and gloom. The listener should feel like they just speed-ran the day's most important stories and came out sharper.

Energy: HIGH throughout. This is short — every second counts. No warm-up, no wind-down. Hit the ground running and end strong.

Voice consistency: CRITICAL. Maintain the SAME pitch, register, and speaking pace throughout. One consistent voice from start to finish.

Avoid: Robotic cadence, singsong patterns, dramatic pauses, breathy emphasis, monotone delivery, NPR flatness, sleepy energy.`,
        onProgress: (completed, total) => {
          console.log(`[audio:light] TTS chunk ${completed}/${total}`);
        },
      }
    );

    console.log(`[audio:light] Generated ${audio.length} bytes from ${chunks} chunks (${characterCount} chars)`);

    // 6. Upload to Vercel Blob (separate path from main brief)
    const filename = `audio/brief-light-${brief.date}.mp3`;
    const blob = await put(filename, audio, {
      access: 'public',
      contentType: 'audio/mpeg',
      addRandomSuffix: false,
      ...(process.env.public_READ_WRITE_TOKEN ? { token: process.env.public_READ_WRITE_TOKEN } : {}),
    });

    console.log(`[audio:light] Uploaded to Blob: ${blob.url}`);

    // 7. Estimate duration (128kbps MP3)
    const estimatedDuration = Math.round(audio.length / (128000 / 8));

    // 8. Generate episode title + store metadata in Redis (light namespace)
    const titleInput = brief.sections[0]?.content?.slice(0, 500) || '';
    const episodeTitle = await generateEpisodeTitle(titleInput, brief.displayDate, openaiApiKey);
    console.log(`[audio:light] Episode title: ${episodeTitle}`);

    const episode = {
      date: brief.date,
      title: episodeTitle,
      description: extractDescription(brief),
      audioUrl: blob.url,
      duration: estimatedDuration,
      fileSize: audio.length,
      voice: selectedVoice,
      generatedAt: new Date().toISOString(),
    };

    await writeLightEpisodeMetadata(episode);
    console.log(`[audio:light] Metadata stored for ${brief.date}`);

    // 9. Verify
    let feedVerified = false;
    try {
      const storedEpisode = await readLightEpisodeMetadata(brief.date);
      feedVerified = !!storedEpisode && storedEpisode.audioUrl === blob.url;
      console.log(`[audio:light] Verification: ${feedVerified ? 'PASS' : 'FAIL'}`);
    } catch (verifyErr) {
      console.warn(`[audio:light] Verification error: ${verifyErr}`);
    }

    return NextResponse.json({
      status: 'success',
      episode,
      feedVerified,
      stats: {
        characterCount,
        chunks,
        audioSizeBytes: audio.length,
        estimatedDurationSeconds: estimatedDuration,
      },
    });
  } catch (err) {
    console.error('[audio:light] Generation failed:', err);
    return NextResponse.json(
      { error: 'Super Brief audio generation failed', detail: String(err) },
      { status: 500 }
    );
  }
}

// Support GET for Vercel cron
export async function GET(req: NextRequest) {
  return POST(req);
}
