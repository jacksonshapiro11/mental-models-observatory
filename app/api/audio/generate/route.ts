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
  if (!snapshotSecret) return false;

  // Check query param or header (manual triggers + publish script)
  const secret = req.headers.get('x-snapshot-secret') || req.nextUrl.searchParams.get('secret');
  if (secret === snapshotSecret) return true;

  // Check Vercel cron header (uses CRON_SECRET env var — set this to the same value as SNAPSHOT_SECRET)
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET || snapshotSecret;
  if (authHeader === `Bearer ${cronSecret}`) return true;

  return false;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function extractDescription(brief: { lede: string }): string {
  // Strip markdown from lede for podcast episode description
  return brief.lede
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .slice(0, 300);
}

// ─── POST handler ───────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const dateParam = req.nextUrl.searchParams.get('date');
  const force = req.nextUrl.searchParams.get('force') === 'true';

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

    // 5. Generate audio via TTS
    const ttsClient = new OpenAITTSClient(openaiApiKey, {
      voice: 'onyx',
      model: 'tts-1-hd',
    });

    const { audio, chunks, characterCount } = await generateFullAudio(
      ttsClient,
      preprocessed.fullText,
      {
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
    });

    console.log(`[audio] Uploaded to Blob: ${blob.url}`);

    // 7. Estimate duration (128kbps MP3 → bytes / (128000/8) = seconds)
    const estimatedDuration = Math.round(audio.length / (128000 / 8));

    // 8. Store episode metadata in Redis
    const episode = {
      date: brief.date,
      title: `Daily Brief — ${brief.displayDate}`,
      description: extractDescription(brief),
      audioUrl: blob.url,
      duration: estimatedDuration,
      fileSize: audio.length,
      generatedAt: new Date().toISOString(),
    };

    await writeEpisodeMetadata(episode);
    console.log(`[audio] Metadata stored for ${brief.date}`);

    return NextResponse.json({
      status: 'success',
      episode,
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
