#!/usr/bin/env node
/**
 * upload-audio.mjs — Upload a locally-generated MP3 to Vercel Blob + Redis
 *
 * Usage:
 *   node scripts/upload-audio.mjs 2026-03-06
 *   node scripts/upload-audio.mjs 2026-03-06 --force
 *
 * Reads from: scripts/output/{date}.mp3
 * Uploads to: Vercel Blob (public CDN)
 * Stores metadata in: Upstash Redis (audio:episode:{date})
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// Load env
dotenv.config({ path: path.join(ROOT, '.env.local') });

const BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN;
const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

if (!BLOB_TOKEN) { console.error('Missing BLOB_READ_WRITE_TOKEN'); process.exit(1); }
if (!REDIS_URL || !REDIS_TOKEN) { console.error('Missing UPSTASH_REDIS env vars'); process.exit(1); }

// ─── Args ────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const date = args.find(a => /^\d{4}-\d{2}-\d{2}$/.test(a));
const force = args.includes('--force');

if (!date) {
  console.error('Usage: node scripts/upload-audio.mjs YYYY-MM-DD [--force]');
  process.exit(1);
}

const mp3Path = path.join(ROOT, 'scripts', 'output', `${date}.mp3`);

if (!fs.existsSync(mp3Path)) {
  console.error(`MP3 not found: ${mp3Path}`);
  process.exit(1);
}

// ─── Redis helpers ───────────────────────────────────────────────────────────

async function redisCommand(command, ...cmdArgs) {
  const resp = await fetch(`${REDIS_URL}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${REDIS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify([command, ...cmdArgs]),
  });
  const data = await resp.json();
  if (data.error) throw new Error(`Redis error: ${data.error}`);
  return data.result;
}

async function checkExisting(d) {
  const raw = await redisCommand('GET', `audio:episode:${d}`);
  return raw ? (typeof raw === 'string' ? JSON.parse(raw) : raw) : null;
}

async function writeMetadata(episode) {
  const key = `audio:episode:${episode.date}`;
  const score = new Date(episode.date).getTime();
  await Promise.all([
    redisCommand('SET', key, JSON.stringify(episode)),
    redisCommand('ZADD', 'audio:episodes', score, episode.date),
  ]);
}

// ─── Vercel Blob upload (direct PUT API) ─────────────────────────────────────

async function uploadToBlob(filePath, pathname) {
  const stream = fs.createReadStream(filePath);
  const stats = fs.statSync(filePath);

  // Use the @vercel/blob REST API directly
  const url = `https://blob.vercel-storage.com/${pathname}`;

  const resp = await fetch(url, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${BLOB_TOKEN}`,
      'x-api-version': '7',
      'x-content-type': 'audio/mpeg',
      'x-cache-control-max-age': '31536000',
      'x-add-random-suffix': '0',
      'Content-Length': String(stats.size),
    },
    body: stream,
    duplex: 'half',
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Blob upload failed (${resp.status}): ${text}`);
  }

  return resp.json();
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\nUpload audio for ${date}`);
  console.log(`  MP3: ${mp3Path}`);

  // Check if already exists
  if (!force) {
    const existing = await checkExisting(date);
    if (existing) {
      console.log(`\nAudio already exists for ${date}:`);
      console.log(`  URL: ${existing.audioUrl}`);
      console.log(`  Duration: ${Math.floor(existing.duration / 60)}:${String(existing.duration % 60).padStart(2, '0')}`);
      console.log(`\n  Use --force to overwrite.`);
      return;
    }
  }

  const stats = fs.statSync(mp3Path);
  const fileSizeBytes = stats.size;
  const fileSizeMB = (fileSizeBytes / 1024 / 1024).toFixed(1);
  const estimatedDuration = Math.round(fileSizeBytes / (128000 / 8));

  console.log(`  Size: ${fileSizeMB} MB`);
  console.log(`  Est. duration: ${Math.floor(estimatedDuration / 60)}:${String(estimatedDuration % 60).padStart(2, '0')}`);

  // Upload to Vercel Blob
  console.log(`\nUploading to Vercel Blob (streaming)...`);
  const pathname = `audio/daily-brief-${date}.mp3`;
  const blob = await uploadToBlob(mp3Path, pathname);
  console.log(`  Uploaded: ${blob.url}`);

  // Write metadata to Redis
  console.log(`\nWriting metadata to Redis...`);
  const episode = {
    date,
    title: `Daily Brief — ${date}`,
    description: 'Daily market intelligence: macro, crypto, AI, geopolitics, and the mental models that connect them.',
    audioUrl: blob.url,
    duration: estimatedDuration,
    fileSize: fileSizeBytes,
    generatedAt: new Date().toISOString(),
  };

  await writeMetadata(episode);
  console.log(`  Metadata stored`);

  console.log(`\nDone! Audio available at:`);
  console.log(`  CDN: ${blob.url}`);
  console.log(`  API: https://mentalmodelsobservatory.com/api/audio/${date}`);
  console.log(`  Duration: ${Math.floor(estimatedDuration / 60)}:${String(estimatedDuration % 60).padStart(2, '0')}`);
}

main().catch(err => {
  console.error('\nUpload failed:', err.message || err);
  process.exit(1);
});
