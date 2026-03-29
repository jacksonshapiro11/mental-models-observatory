/**
 * Local audio test script — generates a podcast episode from sample brief text.
 * Runs the full pipeline: section extraction → GPT-4o scriptwriter → regex normalize → gpt-4o-mini-tts → MP3
 *
 * Usage: npx tsx scripts/test-audio-local.ts
 *
 * Outputs: test-audio-output.mp3 in the project root
 */

import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Load env vars from .env.local
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

import { OpenAITTSClient, generateFullAudio } from '../lib/audio/tts-client';
import { preprocessBriefForTTS } from '../lib/audio/text-preprocessor';

// The example brief from Editorial Bible v11 — saved as a raw markdown string
const EXAMPLE_BRIEF_MD = fs.readFileSync(
  path.join(__dirname, 'test-brief-sample.md'),
  'utf-8'
);

// Minimal brief object matching what daily-update-parser returns
const mockBrief = {
  date: '2026-03-29',
  displayDate: 'Sunday, March 29, 2026',
  epigraph: 'The person you\'ll be in five years is being built by the decisions you\'re making this week. Most of them aren\'t about money.',
  lede: 'Rate hike probability crossed 50% for the first time this cycle. All five US indices now in correction. Iran blocked Chinese ships from Hormuz — ending preferential passage. The regime changed this week.',
  orientation: '',
  sections: [], // We'll use rawMarkdown parsing instead
};

async function main() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error('Missing OPENAI_API_KEY in .env.local');
    process.exit(1);
  }

  console.log('=== Local Audio Test ===\n');

  // Step 1: Preprocess (scriptwriter + regex)
  console.log('[1/3] Preprocessing brief through GPT-4o scriptwriter...');
  const startPreprocess = Date.now();

  const preprocessed = await preprocessBriefForTTS(mockBrief as any, {
    openaiApiKey: apiKey,
    skipLlmCleanup: false,
    rawMarkdown: EXAMPLE_BRIEF_MD,
  });

  const preprocessMs = Date.now() - startPreprocess;
  console.log(`  → ${preprocessed.sections.length} sections, ${preprocessed.characterCount} chars (${(preprocessMs / 1000).toFixed(1)}s)`);

  // Save the script for review
  const scriptPath = path.join(__dirname, '..', 'test-audio-script.txt');
  fs.writeFileSync(scriptPath, preprocessed.fullText);
  console.log(`  → Script saved to ${scriptPath}`);

  // Step 2: Generate TTS audio
  console.log('\n[2/3] Generating audio via gpt-4o-mini-tts...');
  const startTTS = Date.now();

  const ttsClient = new OpenAITTSClient(apiKey, {
    voice: 'onyx',
    model: 'gpt-4o-mini-tts',
  });

  const { audio, chunks, characterCount } = await generateFullAudio(
    ttsClient,
    preprocessed.fullText,
    {
      instructions: `Voice: warm, grounded, conversational — like a smart friend sharing what they know over morning coffee. Not a podcast host performing. Not a news anchor. A real person who reads widely and thinks clearly.

Pacing: Vary naturally. Slow down and let weight land on key insights — the "so what" moments. Move briskly through data and transitions. Pause briefly between sections to let the listener reset.

Tone: Steady and confident but never cocky. Genuinely curious when something is surprising. Reflective and warm during Inner Game and Discovery sections. Direct and clear during market sections.

Energy: Medium — present and engaged, not hyped. Think NPR meets a really smart group chat. Let real interest come through rather than performed excitement.

Avoid: Robotic cadence, singsong patterns, dramatic pauses for effect, breathy emphasis on every other word, rushed delivery through dense financial content.`,
      onProgress: (completed, total) => {
        console.log(`  → TTS chunk ${completed}/${total}`);
      },
    }
  );

  const ttsMs = Date.now() - startTTS;
  const estimatedDuration = Math.round(audio.length / (128000 / 8));

  console.log(`  → ${audio.length} bytes, ${chunks} chunks, ${characterCount} chars (${(ttsMs / 1000).toFixed(1)}s)`);
  console.log(`  → Estimated duration: ${Math.floor(estimatedDuration / 60)}m ${estimatedDuration % 60}s`);

  // Step 3: Save MP3
  const outputPath = path.join(__dirname, '..', 'test-audio-output.mp3');
  fs.writeFileSync(outputPath, audio);
  console.log(`\n[3/3] Audio saved to ${outputPath}`);
  console.log(`\nTotal time: ${((Date.now() - startPreprocess) / 1000).toFixed(1)}s`);
  console.log('\nDone! Open test-audio-output.mp3 to listen.');
}

main().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
