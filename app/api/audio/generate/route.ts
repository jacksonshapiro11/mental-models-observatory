/**
 * /api/audio/generate — Audio generation endpoint
 *
 * POST: Generates audio for a daily brief. Reads the brief markdown,
 * preprocesses it for TTS, generates audio via OpenAI, uploads to
 * Vercel Blob, and stores metadata in Redis.
 *
 * Query params:
 *   ?date=YYYY-MM-DD  — Generate for a specific date (defaults to latest)
 *   ?force=true       — Regenerate even if audio already exists
 *
 * Protected by SNAPSHOT_SECRET (same auth as dashboard snapshot).
 * Triggered by Vercel cron or manual POST.
 */

// Allow up to 5 minutes for audio generation (GPT-4o script + TTS + upload)
export const maxDuration = 300;

import fs from 'fs';
import path from 'path';
import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import OpenAI from 'openai';
import { getBriefByDate, getLatestBrief } from '@/lib/daily-update-parser';
import { preprocessBriefForTTS } from '@/lib/audio/text-preprocessor';
import { OpenAITTSClient, generateFullAudio } from '@/lib/audio/tts-client';
import { writeEpisodeMetadata, readEpisodeMetadata } from '@/lib/audio/podcast-feed';

const CONTENT_DIR = path.join(process.cwd(), 'content/daily-updates');

// ─── Auth ───────────────────────────────────────────────────────────────────
// Uses SNAPSHOT_SECRET — the same secret you already have for the dashboard.
// Works via query param (?secret=xxx), header (x-snapshot-secret), or
// Vercel cron (which sends Authorization: Bearer <CRON_SECRET>).

function isAuthorized(req: NextRequest): boolean {
  const snapshotSecret = process.env.SNAPSHOT_SECRET;
  const cronSecret = process.env.CRON_SECRET;

  if (!snapshotSecret && !cronSecret) {
    console.error('[audio] Neither SNAPSHOT_SECRET nor CRON_SECRET is set');
    return false;
  }

  // Check query param or header (manual triggers + publish script)
  const secret = req.headers.get('x-snapshot-secret') || req.nextUrl.searchParams.get('secret');
  if (secret && snapshotSecret && secret === snapshotSecret) return true;

  // Check Vercel cron header — accepts either CRON_SECRET or SNAPSHOT_SECRET
  const authHeader = req.headers.get('authorization');
  if (authHeader) {
    const token = authHeader.replace('Bearer ', '');
    if (cronSecret && token === cronSecret) return true;
    if (snapshotSecret && token === snapshotSecret) return true;
  }

  console.warn(`[audio] Auth failed. Has SNAPSHOT_SECRET: ${!!snapshotSecret}, Has CRON_SECRET: ${!!cronSecret}, Has auth header: ${!!authHeader}, Has secret param: ${!!secret}`);
  return false;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function extractDescription(brief: { lede: string; orientation?: string }): string {
  // Strip markdown from lede for podcast episode description, with fallback to orientation
  const source = brief.lede || brief.orientation || '';
  return source
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .slice(0, 300);
}

/** Generate a punchy, clickbaity episode title from the lede via GPT-4o */
async function generateEpisodeTitle(lede: string, displayDate: string, apiKey: string): Promise<string> {
  try {
    const client = new OpenAI({ apiKey });
    const resp = await client.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You generate punchy, clickbaity podcast episode titles. 4-8 words max. The title should make someone NEED to tap play.

Rules:
- Pull from the 1-2 most dramatic/surprising stories in the lede
- Use power words: Breaks, Hits, Crashes, Secret, Nobody Saw, Unravels, Explodes
- Be specific — name the company, asset, or event
- No dates in the title
- No generic titles like "Market Update" or "Daily Roundup"
- Use sentence case, not title case
- Return ONLY the title, nothing else

Examples of great titles:
- "SaaSpocalypse hits private credit"
- "Oil at $100 and nobody's ready"
- "Adobe's CEO walks, markets shrug"
- "The dollar's dirty secret"
- "Five funds gate in one day"
- "Bitcoin holds while everything breaks"
- "NVIDIA's trillion-dollar tell"`,
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
    console.warn(`[audio] Title generation failed (${err}), using fallback`);
  }
  // Fallback: generic but branded
  return `Markets, Meditations, and Mental Models — ${displayDate}`;
}

// ─── POST handler ───────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const dateParam = req.nextUrl.searchParams.get('date');
  const force = req.nextUrl.searchParams.get('force') === 'true';

  // Guard: the full-brief endpoint must never receive a Light date.
  // This caused a real incident (2026-04-14) where the full pipeline ran on a
  // -light.md file, produced the wrong audio, and then crashed on Redis zadd
  // because `new Date("2026-04-14-light").getTime()` is NaN.
  if (dateParam && /-light$/i.test(dateParam)) {
    return NextResponse.json(
      {
        error: 'Wrong endpoint',
        detail: `Date "${dateParam}" is a Brief Light date. Call /api/audio/light/generate?date=${dateParam.replace(/-light$/i, '')} instead.`,
      },
      { status: 400 }
    );
  }

  try {
    // 1. Load the brief
    const brief = dateParam ? getBriefByDate(dateParam) : getLatestBrief();

    if (!brief) {
      return NextResponse.json(
        { error: 'Brief not found', date: dateParam || 'latest' },
        { status: 404 }
      );
    }

    // 2. Check if audio already exists (skip if not forcing)
    if (!force) {
      const existing = await readEpisodeMetadata(brief.date);
      if (existing) {
        return NextResponse.json({
          status: 'exists',
          message: `Audio already exists for ${brief.date}. Use ?force=true to regenerate.`,
          episode: existing,
        });
      }
    }

    console.log(`[audio] Generating audio for ${brief.date}...`);

    // 3. Load raw markdown (for better section parsing with markers)
    const openaiApiKey = process.env.OPENAI_API_KEY!;
    const mdPath = path.join(CONTENT_DIR, `${brief.date}.md`);
    const rawMarkdown = fs.existsSync(mdPath) ? fs.readFileSync(mdPath, 'utf-8') : undefined;

    // 4. Preprocess: extract sections → GPT-4o scriptwriter → regex normalize
    const preprocessOpts: Parameters<typeof preprocessBriefForTTS>[1] = {
      openaiApiKey,
      skipLlmCleanup: false,
    };
    if (rawMarkdown) preprocessOpts.rawMarkdown = rawMarkdown;

    const preprocessed = await preprocessBriefForTTS(brief, preprocessOpts);

    console.log(`[audio] Script: ${preprocessed.characterCount} characters, ${preprocessed.sections.length} sections`);

    // 5. Generate audio via TTS (gpt-4o-mini-tts with voice instructions for natural delivery)
    // Voice: pinned to onyx. No more rotation — one consistent voice per episode.
    const selectedVoice = process.env.TTS_VOICE || 'onyx';

    console.log(`[audio] TTS voice: ${selectedVoice}${process.env.TTS_VOICE ? ' (env override)' : ' (default: onyx)'}`);


    const ttsClient = new OpenAITTSClient(openaiApiKey, {
      voice: selectedVoice,
      model: 'gpt-4o-mini-tts',
    });

    const { audio, chunks, characterCount } = await generateFullAudio(
      ttsClient,
      preprocessed.fullText,
      {
        instructions: `Voice: bright, energized, genuinely curious. Like a smart friend who is fired up to share what they have been reading over morning coffee. This is the listener's MORNING show. They are waking up. You are waking them up. Not a podcast host performing. Not NPR. Not a news anchor delivering bad news. A real person who finds this stuff fascinating and wants you to find it fascinating too. Bring LIFE to it.

Pacing: Vary naturally. Slow down and let weight land on key insights, the "so what" moments. Move briskly through transitions. Pause briefly between sections to let the listener reset. But keep the momentum. This should feel like a conversation that is going somewhere, not a lecture.

Tone: Confident, curious, and ALIVE. Even when the content is serious (rate hikes, geopolitical crises), the energy should be "is it not interesting that we get to think about this?" Not doom and gloom. The listener should feel sharper and more awake after listening, not drained or lulled to sleep. Warm and present during Inner Game. Intellectually excited during Discovery and The Model. Direct, clear, and upbeat during market sections.

Energy: HIGH. Present, engaged, genuinely enthusiastic. Think: the best conversation at a dinner party where everyone is smart and curious and the coffee just kicked in. Let real enthusiasm come through. The listener chose to spend their morning with you. Reward that choice with energy that makes them glad they pressed play.

Voice consistency: CRITICAL. Maintain the SAME pitch, register, and speaking pace throughout the entire passage. Do NOT shift into a different octave, do NOT suddenly speak faster or slower, do NOT change your vocal register mid-sentence or between paragraphs. One consistent voice from start to finish. If you feel yourself drifting to a different pitch or energy level, come back to your baseline. The listener should never feel like a different person jumped in.

Avoid: Robotic cadence, singsong patterns, dramatic pauses for effect, breathy emphasis on every other word, monotone delivery through dense content, depressive gravity, funeral-director solemnity, NPR flatness, sleepy energy, droning.`,
        onProgress: (completed, total) => {
          console.log(`[audio] TTS chunk ${completed}/${total}`);
        },
      }
    );

    console.log(`[audio] Generated ${audio.length} bytes from ${chunks} chunks (${characterCount} chars)`);

    // 6. Upload to Vercel Blob
    const filename = `audio/daily-brief-${brief.date}.mp3`;
    const blob = await put(filename, audio, {
      access: 'public',
      contentType: 'audio/mpeg',
      addRandomSuffix: false,
      ...(process.env.public_READ_WRITE_TOKEN ? { token: process.env.public_READ_WRITE_TOKEN } : {}),
    });

    console.log(`[audio] Uploaded to Blob: ${blob.url}`);

    // 7. Estimate duration (128kbps MP3 → bytes / (128000/8) = seconds)
    const estimatedDuration = Math.round(audio.length / (128000 / 8));

    // 8. Use Daily Title from the brief for episode title (consistent across all formats)
    // Fall back to AI-generated title only if Daily Title is missing
    let episodeTitle: string;
    if (brief.dailyTitle) {
      episodeTitle = brief.dailyTitle;
      console.log(`[audio] Using Daily Title: ${episodeTitle}`);
    } else {
      const openaiKey = process.env.OPENAI_API_KEY!;
      const titleInput = brief.lede || brief.orientation || (rawMarkdown ? rawMarkdown.slice(0, 500) : '');
      console.log(`[audio] No Daily Title found, generating from ${brief.lede ? 'lede' : 'rawMarkdown'} (${titleInput.length} chars)`);
      episodeTitle = await generateEpisodeTitle(titleInput, brief.displayDate, openaiKey);
    }
    console.log(`[audio] Episode title: ${episodeTitle}`);

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

    await writeEpisodeMetadata(episode);
    console.log(`[audio] Metadata stored for ${brief.date}`);

    // 9. Verify episode is in RSS feed
    let feedVerified = false;
    try {
      const storedEpisode = await readEpisodeMetadata(brief.date);
      feedVerified = !!storedEpisode && storedEpisode.audioUrl === blob.url;
      console.log(`[audio] RSS feed verification: ${feedVerified ? 'PASS' : 'FAIL'}`);
    } catch (verifyErr) {
      console.warn(`[audio] RSS feed verification error: ${verifyErr}`);
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
    console.error('[audio] Generation failed:', err);
    return NextResponse.json(
      { error: 'Audio generation failed', detail: String(err) },
      { status: 500 }
    );
  }
}

// Also support GET for Vercel cron (cron hits GET by default)
export async function GET(req: NextRequest) {
  return POST(req);
}
