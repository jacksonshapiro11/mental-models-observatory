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

export async function writeStepLog(
  date: string,
  step: 'email' | 'x',
  result: StepLogEntry,
): Promise<void> {
  const r = getRedis();
  const key = `distribute:log:${date}`;
  const existing = (await r.get<DistributeLog>(key)) || {};
  const updated: DistributeLog = { ...existing, [step]: result };
  await r.set(key, updated);
}

export async function writeAudioLog(date: string, result: AudioLog): Promise<void> {
  const r = getRedis();
  await r.set(`audio:log:${date}`, result);
}

export async function readDistributeLog(date: string): Promise<DistributeLog | null> {
  const r = getRedis();
  return r.get<DistributeLog>(`distribute:log:${date}`);
}

export async function readAudioLog(date: string): Promise<AudioLog | null> {
  const r = getRedis();
  return r.get<AudioLog>(`audio:log:${date}`);
}

export async function readMarketingPack<T = Record<string, unknown>>(date: string): Promise<T | null> {
  const r = getRedis();
  return r.get<T>(`marketing:pack:${date}`);
}
