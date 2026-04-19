/**
 * Thin beehiiv API v2 client.
 *
 * Docs: https://developers.beehiiv.com/api-reference
 *
 * Required env vars:
 *   BEEHIIV_API_KEY         — from beehiiv Settings → Integrations → API
 *   BEEHIIV_PUBLICATION_ID  — "pub_xxxxxxxxxxxx" from same page
 */

const BASE_URL = 'https://api.beehiiv.com/v2';

function getCreds(): { apiKey: string; publicationId: string } {
  const apiKey = process.env.BEEHIIV_API_KEY;
  const publicationId = process.env.BEEHIIV_PUBLICATION_ID;
  if (!apiKey) throw new Error('BEEHIIV_API_KEY not set');
  if (!publicationId) throw new Error('BEEHIIV_PUBLICATION_ID not set');
  return { apiKey, publicationId };
}

async function request<T>(
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  path: string,
  body?: unknown
): Promise<T> {
  const { apiKey } = getCreds();
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`beehiiv ${method} ${path} failed: ${res.status} ${text}`);
  }

  return res.json() as Promise<T>;
}

// ─── Posts (emails) ─────────────────────────────────────────────────────────

export interface CreatePostInput {
  title: string;            // used as subject line
  subtitle?: string;        // preview text
  body_content: string;     // HTML
  status: 'draft' | 'confirmed';  // 'confirmed' = scheduled/sent
  scheduled_at?: string;    // ISO 8601, required if status=confirmed
  content_tags?: string[];
  thumbnail_url?: string;
  // Recipients (Scale tier+)
  email_settings?: {
    email_subject_line?: string;
    email_preview_text?: string;
    display_name?: string;
  };
}

export interface PostResponse {
  data: {
    id: string;
    title: string;
    subtitle?: string;
    status: string;
    web_url?: string;
    scheduled_at?: string;
  };
}

export async function createPost(input: CreatePostInput): Promise<PostResponse> {
  const { publicationId } = getCreds();
  return request<PostResponse>('POST', `/publications/${publicationId}/posts`, input);
}

// ─── Subscriptions ──────────────────────────────────────────────────────────

export interface CreateSubscriptionInput {
  email: string;
  reactivate_existing?: boolean;
  send_welcome_email?: boolean;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  referring_site?: string;
  custom_fields?: Array<{ name: string; value: string }>;
}

export interface SubscriptionResponse {
  data: {
    id: string;
    email: string;
    status: string;
    created: number;
    subscription_tier: string;
  };
}

export async function createSubscription(
  input: CreateSubscriptionInput
): Promise<SubscriptionResponse> {
  const { publicationId } = getCreds();
  return request<SubscriptionResponse>(
    'POST',
    `/publications/${publicationId}/subscriptions`,
    input
  );
}

export async function createSubscriptionsBulk(
  emails: Array<{ email: string; subscribedAt?: string; source?: string }>
): Promise<{ succeeded: number; failed: Array<{ email: string; error: string }> }> {
  const failed: Array<{ email: string; error: string }> = [];
  let succeeded = 0;

  // beehiiv rate limit is 100 req/min on standard tiers — pace at ~50/min
  for (const row of emails) {
    try {
      await createSubscription({
        email: row.email,
        reactivate_existing: true,
        send_welcome_email: true,
        utm_source: row.source ?? 'legacy_import',
        utm_medium: 'api_import',
      });
      succeeded++;
    } catch (err) {
      failed.push({
        email: row.email,
        error: err instanceof Error ? err.message : String(err),
      });
    }
    await sleep(1200); // ~50 req/min
  }

  return { succeeded, failed };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
