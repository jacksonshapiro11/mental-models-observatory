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
import { getBriefLightByDate } from '@/lib/brief-light-parser';
import { resolvePublishDate, isStaleForAutoPublish, todayET } from '@/lib/publish-date';
import { preprocessBriefLightForTTS, checkScriptFidelity } from '@/lib/audio/text-preprocessor';
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
    // 1. Resolve the target date. The auto (cron) path targets TODAY and skips
    //    if today's Super Brief is missing — it must NEVER fall back to the
    //    newest file on disk, or a missed day makes every episode lag a day
    //    behind. An explicit ?date= is a deliberate manual backfill.
    const { date: targetDate, manual } = resolvePublishDate(dateParam);
    const brief = getBriefLightByDate(targetDate);

    if (!brief) {
      if (manual) {
        return NextResponse.json(
          { error: 'Brief Light not found', date: targetDate },
          { status: 404 }
        );
      }
      // Auto path, today's brief not published yet → clean skip, no stale episode.
      console.warn(`[audio:light] No Super Brief for ${targetDate} — skipping (not falling back to a stale episode).`);
      return NextResponse.json({ status: 'skipped', reason: `No Super Brief published for ${targetDate}`, date: targetDate });
    }

    // Regression tripwire: the auto path may only ever ship TODAY's brief.
    if (isStaleForAutoPublish(brief.date, manual)) {
      console.warn(`[audio:light] Stale brief blocked: resolved ${brief.date} but today is ${todayET()} — skipping.`);
      return NextResponse.json({ status: 'skipped', reason: 'stale brief blocked', date: brief.date });
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
        dailyTitle: brief.dailyTitle,
        epigraph: brief.epigraph,
        sections: brief.sections.map(s => ({ id: s.id, label: s.label, content: s.content })),
      },
      {
        openaiApiKey,
        skipLlmCleanup: false,
      }
    );

    console.log(`[audio:light] Script: ${preprocessed.characterCount} characters, ${preprocessed.sections.length} sections`);

    // Fidelity tripwire: the super brief should be delivered nearly whole, so flag if the
    // script came back too thin against the written brief (caught here, not on Spotify).
    const fidelity = checkScriptFidelity(
      brief.sections.map(s => s.content).join('\n'),
      preprocessed.fullText,
      { minRatio: 0.7 },
    );
    for (const w of fidelity.warnings) console.warn(`[audio:light] ⚠ FIDELITY — ${w}`);
    console.log(`[audio:light] Fidelity ratio: ${Math.round(fidelity.ratio * 100)}% (script/brief words)`);

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
        instructions: `Voice: bright, warm, genuinely curious, a smart friend walking you through the day's biggest ideas over coffee. This is the SUPER BRIEF: ideas-first and substantial, around ten minutes. Not rushed.

Pacing: lively but unhurried. Keep momentum, but let the ideas land. Give the meditation and the mental model room to breathe; do not race through them. Natural pauses between sections. This is a real conversation, not a speed-run.

Tone: confident, curious, human. Even serious stories carry energy and interest, never doom, never NPR-flat. The listener should finish feeling sharper and a little more grounded, like they actually learned something.

Energy: engaged and awake throughout, but modulated to the material: punchy on the ideas and the market read, slower and warmer on the meditation and the model.

Voice consistency: CRITICAL. Maintain the SAME pitch, register, and base pace throughout. One consistent voice from start to finish.

Avoid: rushing, robotic cadence, singsong patterns, dramatic over-pausing, breathy emphasis, monotone, NPR flatness, sleepy energy, and any sense of speed-running the content.`,
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
      allowOverwrite: true,
      ...(process.env.public_READ_WRITE_TOKEN ? { token: process.env.public_READ_WRITE_TOKEN } : {}),
    });

    console.log(`[audio:light] Uploaded to Blob: ${blob.url}`);

    // Persist the generated script next to the audio so the episode is always reviewable
    // (removes the blind spot where only the mp3 shipped and the script was thrown away).
    try {
      await put(`audio/brief-light-${brief.date}.txt`, preprocessed.fullText, {
        access: 'public',
        contentType: 'text/plain; charset=utf-8',
        addRandomSuffix: false,
        allowOverwrite: true,
        ...(process.env.public_READ_WRITE_TOKEN ? { token: process.env.public_READ_WRITE_TOKEN } : {}),
      });
      console.log('[audio:light] Script saved next to audio for review.');
    } catch (scriptErr) {
      console.warn('[audio:light] Script save failed (non-fatal):', scriptErr);
    }

    // 7. Estimate duration (128kbps MP3)
    const estimatedDuration = Math.round(audio.length / (128000 / 8));

    // 8. Use the Daily Title from the brief (consistent across brief, light, and audio)
    const episodeTitle = brief.dailyTitle
      ? `${brief.dailyTitle} — Super Brief`
      : `Super Brief — ${brief.displayDate}`;
    console.log(`[audio:light] Episode title: ${episodeTitle}`);

    const episode = {
      date: brief.date,
      title: episodeTitle,
      dailyTitle: brief.dailyTitle || '',
      description: brief.dailyTitle
        ? `${brief.dailyTitle}. ${extractDescription(brief)}`
        : extractDescription(brief),
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
