/**
 * Light (Super Brief) audio generation — shared logic for route + publish orchestrator.
 */

import { put } from '@vercel/blob';
import { getBriefLightByDate } from '@/lib/brief-light-parser';
import { isStaleForAutoPublish, todayET } from '@/lib/publish-date';
import { preprocessBriefLightForTTS, checkScriptFidelity } from '@/lib/audio/text-preprocessor';
import { OpenAITTSClient, generateFullAudio } from '@/lib/audio/tts-client';
import { writeLightEpisodeMetadata, readLightEpisodeMetadata } from '@/lib/audio/podcast-feed';

export type LightAudioStatus = 'success' | 'exists' | 'skipped' | 'error';

export interface LightAudioResult {
  status: LightAudioStatus;
  date: string;
  details?: string;
  episode?: Awaited<ReturnType<typeof readLightEpisodeMetadata>>;
  error?: string;
}

function extractDescription(brief: { sections: { content: string }[]; epigraph?: string }): string {
  const firstContent = brief.sections[0]?.content || brief.epigraph || '';
  return (
    firstContent
      .split('\n')
      .find((l) => l.trim() && !l.startsWith('**') && !l.startsWith('#'))
      ?.replace(/\*\*(.+?)\*\*/g, '$1')
      .replace(/\*(.+?)\*/g, '$1')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .slice(0, 300) || 'Your compressed daily intelligence brief.'
  );
}

export interface GenerateLightAudioOptions {
  date: string;
  force?: boolean;
  manual?: boolean;
}

export async function generateLightAudio(
  options: GenerateLightAudioOptions,
): Promise<LightAudioResult> {
  const { date: targetDate, force = false, manual = false } = options;
  const brief = getBriefLightByDate(targetDate);

  if (!brief) {
    if (manual) {
      return { status: 'error', date: targetDate, error: `Brief Light not found for ${targetDate}` };
    }
    return {
      status: 'skipped',
      date: targetDate,
      details: `No Super Brief published for ${targetDate}`,
    };
  }

  if (isStaleForAutoPublish(brief.date, manual)) {
    return {
      status: 'skipped',
      date: brief.date,
      details: `Stale brief blocked (today is ${todayET()})`,
    };
  }

  if (!force) {
    const existing = await readLightEpisodeMetadata(brief.date);
    if (existing) {
      return {
        status: 'exists',
        date: brief.date,
        details: `Super Brief audio already exists for ${brief.date}`,
        episode: existing,
      };
    }
  }

  try {
    console.log(`[audio:light] Generating Super Brief audio for ${brief.date}...`);

    const openaiApiKey = process.env.OPENAI_API_KEY!;

    const preprocessed = await preprocessBriefLightForTTS(
      {
        date: brief.date,
        displayDate: brief.displayDate,
        dailyTitle: brief.dailyTitle,
        epigraph: brief.epigraph,
        sections: brief.sections.map((s) => ({ id: s.id, label: s.label, content: s.content })),
      },
      {
        openaiApiKey,
        skipLlmCleanup: false,
      },
    );

    console.log(
      `[audio:light] Script: ${preprocessed.characterCount} characters, ${preprocessed.sections.length} sections`,
    );

    const fidelity = checkScriptFidelity(
      brief.sections.map((s) => s.content).join('\n'),
      preprocessed.fullText,
      { minRatio: 0.7 },
    );
    for (const w of fidelity.warnings) console.warn(`[audio:light] ⚠ FIDELITY — ${w}`);

    const selectedVoice = process.env.TTS_VOICE || 'onyx';
    const ttsClient = new OpenAITTSClient(openaiApiKey, {
      voice: selectedVoice,
      model: 'gpt-4o-mini-tts',
    });

    const { audio, chunks, characterCount } = await generateFullAudio(ttsClient, preprocessed.fullText, {
      instructions: `Voice: bright, warm, genuinely curious, a smart friend walking you through the day's biggest stories over coffee. This is the SUPER BRIEF: wide-ranging and substantial, around ten minutes. Not rushed.

Pacing: lively but unhurried. Keep momentum, but let the ideas land. Give the meditation and the mental model room to breathe; do not race through them. Natural pauses between sections. This is a real conversation, not a speed-run.

Tone: confident, curious, human. Even serious stories carry energy and interest, never doom, never NPR-flat. The listener should finish feeling sharper and a little more grounded, like they actually learned something.

Energy: engaged and awake throughout, but modulated to the material: punchy on the ideas and the market read, slower and warmer on the meditation and the model.

Voice consistency: CRITICAL. Maintain the SAME pitch, register, and base pace throughout. One consistent voice from start to finish.

Avoid: rushing, robotic cadence, singsong patterns, dramatic over-pausing, breathy emphasis, monotone, NPR flatness, sleepy energy, and any sense of speed-running the content.`,
      onProgress: (completed, total) => {
        console.log(`[audio:light] TTS chunk ${completed}/${total}`);
      },
    });

    const filename = `audio/brief-light-${brief.date}.mp3`;
    const blob = await put(filename, audio, {
      access: 'public',
      contentType: 'audio/mpeg',
      addRandomSuffix: false,
      allowOverwrite: true,
      ...(process.env.public_READ_WRITE_TOKEN ? { token: process.env.public_READ_WRITE_TOKEN } : {}),
    });

    try {
      await put(`audio/brief-light-${brief.date}.txt`, preprocessed.fullText, {
        access: 'public',
        contentType: 'text/plain; charset=utf-8',
        addRandomSuffix: false,
        allowOverwrite: true,
        ...(process.env.public_READ_WRITE_TOKEN ? { token: process.env.public_READ_WRITE_TOKEN } : {}),
      });
    } catch (scriptErr) {
      console.warn('[audio:light] Script save failed (non-fatal):', scriptErr);
    }

    const estimatedDuration = Math.round(audio.length / (128000 / 8));
    const episodeTitle = brief.dailyTitle
      ? `${brief.dailyTitle} — Super Brief`
      : `Super Brief — ${brief.displayDate}`;

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

    return {
      status: 'success',
      date: brief.date,
      details: `Generated ${characterCount} chars, ${chunks} chunks`,
      episode,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[audio:light] Generation failed:', err);
    return { status: 'error', date: targetDate, error: msg };
  }
}
