import { NextRequest, NextResponse } from 'next/server';

// ─── In-Memory Store Fallback ──────────────────────────────────────────────────
// This is used when @upstash/redis is not available or not configured.
// Maps votes:{briefDate}:{sectionId}:{direction} to count, or votes:user:... to direction

const inMemoryVoteStore = new Map<string, number>();
const inMemoryUserVoteStore = new Map<string, string>();

// ─── Utility: Get Redis client if available ────────────────────────────────────

let redisClient: any = null;
let redisInitialized = false;

async function getRedisClient() {
  if (redisInitialized) {
    return redisClient;
  }

  try {
    const { Redis } = await import('@upstash/redis');
    redisClient = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL || '',
      token: process.env.UPSTASH_REDIS_REST_TOKEN || '',
    });
    redisInitialized = true;
    return redisClient;
  } catch (error) {
    // @upstash/redis not installed or not configured
    redisInitialized = true;
  }
  return null;
}

// ─── User Vote Tracking ───────────────────────────────────────────────────────
// Maps: votes:user:{userId}:{briefDate}:{sectionId} to direction ('up' | 'down' | null)

async function getUserVote(
  briefDate: string,
  sectionId: string,
  userId: string,
) {
  const redis = await getRedisClient();
  const userVoteKey = `votes:user:${userId}:${briefDate}:${sectionId}`;

  if (redis) {
    try {
      const vote = await redis.get(userVoteKey);
      return vote ?? null;
    } catch (error) {
      console.error('Redis get failed, falling back to in-memory store:', error);
    }
  }

  return inMemoryUserVoteStore.get(userVoteKey) ?? null;
}

async function getVoteCounts(briefDate: string, sectionId: string) {
  const redis = await getRedisClient();

  const upKey = `votes:${briefDate}:${sectionId}:up`;
  const downKey = `votes:${briefDate}:${sectionId}:down`;

  if (redis) {
    try {
      const up = await redis.get(upKey);
      const down = await redis.get(downKey);
      return {
        up: typeof up === 'number' ? up : 0,
        down: typeof down === 'number' ? down : 0,
      };
    } catch (error) {
      console.error('Redis get failed, falling back to in-memory store:', error);
      // Fall through to in-memory store
    }
  }

  // In-memory fallback
  const up = inMemoryVoteStore.get(upKey) ?? 0;
  const down = inMemoryVoteStore.get(downKey) ?? 0;
  return { up, down };
}

async function updateVote(
  briefDate: string,
  sectionId: string,
  direction: 'up' | 'down' | null,
  oldDirection: 'up' | 'down' | null,
  userId: string,
) {
  const redis = await getRedisClient();

  const upKey = `votes:${briefDate}:${sectionId}:up`;
  const downKey = `votes:${briefDate}:${sectionId}:down`;
  const userVoteKey = `votes:user:${userId}:${briefDate}:${sectionId}`;

  if (redis) {
    try {
      // Decrement the old vote direction if it exists
      if (oldDirection === 'up') {
        await redis.decr(upKey);
      } else if (oldDirection === 'down') {
        await redis.decr(downKey);
      }

      // Increment the new vote direction if it's not null
      if (direction === 'up') {
        await redis.incr(upKey);
      } else if (direction === 'down') {
        await redis.incr(downKey);
      }

      // Store the user's vote choice
      if (direction) {
        await redis.set(userVoteKey, direction);
      } else {
        await redis.del(userVoteKey);
      }

      const up = await redis.get(upKey);
      const down = await redis.get(downKey);
      return {
        up: typeof up === 'number' ? up : 0,
        down: typeof down === 'number' ? down : 0,
      };
    } catch (error) {
      console.error('Redis update failed, falling back to in-memory store:', error);
      // Fall through to in-memory store
    }
  }

  // In-memory fallback
  if (oldDirection === 'up') {
    const oldUp = inMemoryVoteStore.get(upKey) ?? 1;
    inMemoryVoteStore.set(upKey, Math.max(0, oldUp - 1));
  } else if (oldDirection === 'down') {
    const oldDown = inMemoryVoteStore.get(downKey) ?? 1;
    inMemoryVoteStore.set(downKey, Math.max(0, oldDown - 1));
  }

  if (direction === 'up') {
    const currentUp = inMemoryVoteStore.get(upKey) ?? 0;
    inMemoryVoteStore.set(upKey, currentUp + 1);
  } else if (direction === 'down') {
    const currentDown = inMemoryVoteStore.get(downKey) ?? 0;
    inMemoryVoteStore.set(downKey, currentDown + 1);
  }

  // Store the user's vote choice
  if (direction) {
    inMemoryUserVoteStore.set(userVoteKey, direction);
  } else {
    inMemoryUserVoteStore.delete(userVoteKey);
  }

  const up = inMemoryVoteStore.get(upKey) ?? 0;
  const down = inMemoryVoteStore.get(downKey) ?? 0;
  return { up, down };
}

// ─── GET Handler ──────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const briefDate = searchParams.get('briefDate');
  const sectionId = searchParams.get('sectionId');

  if (!briefDate || !sectionId) {
    return NextResponse.json(
      { error: 'Missing briefDate or sectionId' },
      { status: 400 },
    );
  }

  try {
    const counts = await getVoteCounts(briefDate, sectionId);
    return NextResponse.json(counts);
  } catch (error) {
    console.error('Error fetching vote counts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch vote counts' },
      { status: 500 },
    );
  }
}

// ─── POST Handler ──────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { briefDate, sectionId, direction } = body;

    if (!briefDate || !sectionId) {
      return NextResponse.json(
        { error: 'Missing briefDate or sectionId' },
        { status: 400 },
      );
    }

    if (direction !== null && direction !== 'up' && direction !== 'down') {
      return NextResponse.json(
        { error: 'Invalid direction' },
        { status: 400 },
      );
    }

    // Generate a simple user ID from request headers (IP + user agent)
    // In production, use proper authentication (session, JWT, etc.)
    const userIp = request.headers.get('x-forwarded-for') ||
                   request.headers.get('x-real-ip') ||
                   'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';
    const userId = Buffer.from(`${userIp}:${userAgent}`).toString('base64').substring(0, 32);

    // Check the user's existing vote
    const oldVote = await getUserVote(briefDate, sectionId, userId);

    // Update the vote
    const counts = await updateVote(
      briefDate,
      sectionId,
      direction,
      oldVote || null,
      userId,
    );

    return NextResponse.json(counts);
  } catch (error) {
    console.error('Error processing vote:', error);
    return NextResponse.json(
      { error: 'Failed to process vote' },
      { status: 500 },
    );
  }
}
