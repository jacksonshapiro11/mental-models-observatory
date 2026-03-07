/**
 * TTS client with provider abstraction.
 *
 * Currently implements OpenAI tts-1-hd. The interface is provider-agnostic
 * so Google Cloud TTS or ElevenLabs can be swapped in later.
 */

import OpenAI from 'openai';

// ─── Provider interface ─────────────────────────────────────────────────────

export interface TTSOptions {
  /** Voice ID / name */
  voice?: string;
  /** Model to use */
  model?: string;
  /** Natural language instructions (OpenAI gpt-4o-mini-tts only) */
  instructions?: string;
  /** Audio format */
  format?: 'mp3' | 'opus' | 'aac' | 'flac';
  /** Playback speed (0.25 to 4.0) */
  speed?: number;
}

export interface TTSProvider {
  name: string;
  /** Generate audio from text. Returns raw audio buffer. */
  generateAudio(text: string, options?: TTSOptions): Promise<Buffer>;
  /** Maximum characters per request */
  maxCharsPerRequest: number;
}

// ─── OpenAI TTS implementation ──────────────────────────────────────────────

export class OpenAITTSClient implements TTSProvider {
  name = 'openai';
  maxCharsPerRequest = 4096;

  private client: OpenAI;
  private defaultVoice: string;
  private defaultModel: string;

  constructor(apiKey: string, options?: { voice?: string; model?: string }) {
    this.client = new OpenAI({ apiKey });
    this.defaultVoice = options?.voice || 'onyx'; // Deep, authoritative — good for financial news
    this.defaultModel = options?.model || 'tts-1-hd';
  }

  async generateAudio(text: string, options?: TTSOptions): Promise<Buffer> {
    const response = await this.client.audio.speech.create({
      model: options?.model || this.defaultModel,
      voice: (options?.voice || this.defaultVoice) as 'onyx' | 'alloy' | 'echo' | 'fable' | 'nova' | 'shimmer',
      input: text,
      response_format: options?.format || 'mp3',
      speed: options?.speed || 1.0,
    });

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }
}

// ─── Audio generation orchestrator ──────────────────────────────────────────

/**
 * Split text into chunks that fit within the provider's character limit.
 * Splits on paragraph boundaries first, then sentence boundaries.
 */
function chunkText(text: string, maxChars: number): string[] {
  // Split on double newlines first (paragraph boundaries)
  const paragraphs = text.split(/\n\n+/);
  const chunks: string[] = [];
  let currentChunk = '';

  for (const paragraph of paragraphs) {
    const trimmed = paragraph.trim();
    if (!trimmed) continue;

    // If a single paragraph exceeds the limit, split on sentences
    if (trimmed.length > maxChars) {
      // Flush current chunk
      if (currentChunk.trim()) {
        chunks.push(currentChunk.trim());
        currentChunk = '';
      }

      // Split paragraph on sentence boundaries
      const sentences = trimmed.match(/[^.!?]+[.!?]+\s*/g) || [trimmed];
      for (const sentence of sentences) {
        if ((currentChunk + sentence).length > maxChars) {
          if (currentChunk.trim()) {
            chunks.push(currentChunk.trim());
          }
          currentChunk = sentence;
        } else {
          currentChunk += sentence;
        }
      }
      continue;
    }

    // Check if adding this paragraph exceeds the limit
    const combined = currentChunk ? `${currentChunk}\n\n${trimmed}` : trimmed;
    if (combined.length > maxChars) {
      chunks.push(currentChunk.trim());
      currentChunk = trimmed;
    } else {
      currentChunk = combined;
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

/**
 * Concatenate multiple MP3 buffers into one.
 *
 * MP3 is a streamable format — concatenating MP3 frames produces a valid MP3.
 * This is a well-known property of the format and works reliably for TTS output
 * where all chunks use the same bitrate and sample rate.
 */
function concatenateMP3Buffers(buffers: Buffer[]): Buffer {
  return Buffer.concat(buffers);
}

export interface GenerateFullAudioOptions extends TTSOptions {
  /** Callback for progress updates */
  onProgress?: (completed: number, total: number) => void;
}

/**
 * Generate audio for a full brief text, handling chunking and concatenation.
 */
export async function generateFullAudio(
  provider: TTSProvider,
  text: string,
  options?: GenerateFullAudioOptions
): Promise<{ audio: Buffer; chunks: number; characterCount: number }> {
  const chunks = chunkText(text, provider.maxCharsPerRequest);
  const audioBuffers: Buffer[] = [];

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i]!;
    const buffer = await provider.generateAudio(chunk, options);
    audioBuffers.push(buffer);
    options?.onProgress?.(i + 1, chunks.length);
  }

  const audio = concatenateMP3Buffers(audioBuffers);
  const characterCount = chunks.reduce((sum, c) => sum + c.length, 0);

  return { audio, chunks: chunks.length, characterCount };
}

// ─── Exports for testing ────────────────────────────────────────────────────

export const _test = { chunkText, concatenateMP3Buffers };
