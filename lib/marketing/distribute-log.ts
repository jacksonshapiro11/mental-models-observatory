import { Redis } from '@upstash/redis';

export type StepStatus = 'success' | 'failed' | 'skipped';

export interface StepLogEntry {
  status: StepStatus;
  details?: string;
  error?: string;
  tweetId?: string;
  at: string;
}

export interface DistributeLog {
  email?: StepLogEntry;
  x?: StepLogEntry;
}

export interface AudioLog {
  status: StepStatus;
  details?: string;
  error?: string;
  at: string;
}

let redis: Redis | null = null;

function getRedis(): Redis {
  if (!redis) {
    redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    });
  }
  return redis;
}

async function safeRedisGet<T>(key: string): Promise<T | null> {
  try {
    return await getRedis().get<T>(key);
  } catch (err) {
    console.error(`[distribute-log] Redis read failed for ${key}:`, err);
    return null;
  }
}

async function safeRedisSet(key: string, value: unknown): Promise<void> {
  try {
    await getRedis().set(key, value);
  } catch (err) {
    console.error(`[distribute-log] Redis write failed for ${key}:`, err);
  }
}

export async function writeStepLog(
  date: string,
  step: 'email' | 'x',
  result: StepLogEntry,
): Promise<void> {
  const key = `distribute:log:${date}`;
  const existing = (await safeRedisGet<DistributeLog>(key)) || {};
  const updated: DistributeLog = { ...existing, [step]: result };
  await safeRedisSet(key, updated);
}

export async function writeAudioLog(date: string, result: AudioLog): Promise<void> {
  await safeRedisSet(`audio:log:${date}`, result);
}

export async function readDistributeLog(date: string): Promise<DistributeLog | null> {
  return safeRedisGet<DistributeLog>(`distribute:log:${date}`);
}

export async function readAudioLog(date: string): Promise<AudioLog | null> {
  return safeRedisGet<AudioLog>(`audio:log:${date}`);
}

export async function readMarketingPack<T = Record<string, unknown>>(date: string): Promise<T | null> {
  return safeRedisGet<T>(`marketing:pack:${date}`);
}
