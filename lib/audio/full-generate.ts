/**
 * Full daily brief podcast audio — shared logic for route + publish orchestrator.
 */

import fs from 'fs';
import path from 'path';
import { put } from '@vercel/blob';
import OpenAI from 'openai';
import { getBriefByDate, getWeeklyBySlug } from '@/lib/daily-update-parser';
import { isStaleForAutoPublish, todayET } from '@/lib/publish-date';
import { preprocessBriefForTTS, checkScriptFidelity } from '@/lib/audio/text-preprocessor';
import { OpenAITTSClient, generateFullAudio } from '@/lib/audio/tts-client';
import { writeEpisodeMetadata, readEpisodeMetadata } from '@/lib/audio/podcast-feed';
import { weeklyFullEpisodeKey } from '@/lib/audio/episode-keys';

export { weeklyFullEpisodeKey };

const CONTENT_DIR = path.join(process.cwd(), 'content/daily-updates');
const WEEKLY_CONTENT_DIR = path.join(CONTENT_DIR, 'weekly');

export type FullAudioStatus = 'success' | 'exists' | 'skipped' | 'error';

export interface FullAudioResult {
  status: FullAudioStatus;
  date: string;
  details?: string;
  episode?: Awaited<ReturnType<typeof readEpisodeMetadata>>;
  error?: string;
}

function extractDescription(brief: { lede: string; orientation?: string }): string {
  const source = brief.lede || brief.orientation || '';
  return source
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .slice(0, 300);
}

async function generateEpisodeTitle(
  lede: string,
  displayDate: string,
  apiKey: string,
): Promise<string> {
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
    console.warn(`[audio:full] Title generation failed (${err}), using fallback`);
  }
  return `Markets, Meditations, and Mental Models — ${displayDate}`;
}

export interface GenerateFullAudioOptions {
  date: string;
  /** Week slug (e.g. "2026-W26") — reads content/daily-updates/weekly/ instead of daily */
  weeklySlug?: string;
  force?: boolean;
  manual?: boolean;
}

export async function generateFullBriefAudio(
  options: GenerateFullAudioOptions,
): Promise<FullAudioResult> {
  const { date: targetDate, weeklySlug, force = false, manual = false } = options;
  const isWeekly = !!weeklySlug;
  const episodeKey = isWeekly ? weeklyFullEpisodeKey(weeklySlug) : targetDate;

  const brief = isWeekly ? getWeeklyBySlug(weeklySlug) : getBriefByDate(targetDate);

  if (!brief) {
    const label = isWeekly ? `weekly ${weeklySlug}` : targetDate;
    if (manual) {
      return { status: 'error', date: episodeKey, error: `Brief not found for ${label}` };
    }
    return {
      status: 'skipped',
      date: episodeKey,
      details: isWeekly
        ? `No full weekly published for ${weeklySlug}`
        : `No full brief published for ${targetDate}`,
    };
  }

  if (!isWeekly && isStaleForAutoPublish(brief.date, manual)) {
    return {
      status: 'skipped',
      date: brief.date,
      details: `Stale brief blocked (today is ${todayET()})`,
    };
  }

  if (!force) {
    const existing = await readEpisodeMetadata(episodeKey);
    if (existing) {
      return {
        status: 'exists',
        date: episodeKey,
        details: `Full brief audio already exists for ${episodeKey}`,
        episode: existing,
      };
    }
  }

  try {
    console.log(`[audio:full] Generating audio for ${episodeKey}...`);

    const openaiApiKey = process.env.OPENAI_API_KEY!;
    const mdPath = isWeekly
      ? path.join(WEEKLY_CONTENT_DIR, `${weeklySlug}.md`)
      : path.join(CONTENT_DIR, `${brief.date}.md`);
    // Weekly files use {slug}-{mon-dd-dd}.md — fall back to prefix match
    let rawMarkdown: string | undefined;
    if (isWeekly) {
      const exact = path.join(WEEKLY_CONTENT_DIR, `${weeklySlug}.md`);
      if (fs.existsSync(exact)) {
        rawMarkdown = fs.readFileSync(exact, 'utf-8');
      } else if (fs.existsSync(WEEKLY_CONTENT_DIR)) {
        const match = fs
          .readdirSync(WEEKLY_CONTENT_DIR)
          .find((f) => f.startsWith(`${weeklySlug}-`) && f.endsWith('.md') && !f.includes('-light'));
        if (match) {
          rawMarkdown = fs.readFileSync(path.join(WEEKLY_CONTENT_DIR, match), 'utf-8');
        }
      }
    } else {
      rawMarkdown = fs.existsSync(mdPath) ? fs.readFileSync(mdPath, 'utf-8') : undefined;
    }

    const preprocessOpts: Parameters<typeof preprocessBriefForTTS>[1] = {
      openaiApiKey,
      skipLlmCleanup: false,
      isWeekly,
    };
    if (rawMarkdown) preprocessOpts.rawMarkdown = rawMarkdown;

    const preprocessed = await preprocessBriefForTTS(brief, preprocessOpts);

    console.log(
      `[audio:full] Script: ${preprocessed.characterCount} characters, ${preprocessed.sections.length} sections`,
    );

    const fidelity = checkScriptFidelity(rawMarkdown || '', preprocessed.fullText, { minRatio: 0.45 });
    for (const w of fidelity.warnings) console.warn(`[audio:full] ⚠ FIDELITY — ${w}`);

    const selectedVoice = process.env.TTS_VOICE || 'onyx';
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
          console.log(`[audio:full] TTS chunk ${completed}/${total}`);
        },
      },
    );

    const filename = isWeekly
      ? `audio/weekly-${weeklySlug}.mp3`
      : `audio/daily-brief-${brief.date}.mp3`;
    const blob = await put(filename, audio, {
      access: 'public',
      contentType: 'audio/mpeg',
      addRandomSuffix: false,
      allowOverwrite: true,
      ...(process.env.public_READ_WRITE_TOKEN ? { token: process.env.public_READ_WRITE_TOKEN } : {}),
    });

    try {
      await put(isWeekly ? `audio/weekly-${weeklySlug}.txt` : `audio/daily-brief-${brief.date}.txt`, preprocessed.fullText, {
        access: 'public',
        contentType: 'text/plain; charset=utf-8',
        addRandomSuffix: false,
        allowOverwrite: true,
        ...(process.env.public_READ_WRITE_TOKEN ? { token: process.env.public_READ_WRITE_TOKEN } : {}),
      });
    } catch (scriptErr) {
      console.warn('[audio:full] Script save failed (non-fatal):', scriptErr);
    }

    const estimatedDuration = Math.round(audio.length / (128000 / 8));

    let episodeTitle: string;
    if (brief.dailyTitle) {
      episodeTitle = brief.dailyTitle;
    } else {
      const titleInput =
        brief.lede || brief.orientation || (rawMarkdown ? rawMarkdown.slice(0, 500) : '');
      episodeTitle = await generateEpisodeTitle(titleInput, brief.displayDate, openaiApiKey);
    }

    const episode = {
      date: episodeKey,
      title: episodeTitle,
      description: extractDescription(brief),
      audioUrl: blob.url,
      duration: estimatedDuration,
      fileSize: audio.length,
      voice: selectedVoice,
      generatedAt: new Date().toISOString(),
    };

    await writeEpisodeMetadata(episode);

    return {
      status: 'success',
      date: episodeKey,
      details: `Generated ${characterCount} chars, ${chunks} chunks`,
      episode,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[audio:full] Generation failed:', err);
    return { status: 'error', date: episodeKey, error: msg };
  }
}
