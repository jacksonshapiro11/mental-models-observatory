/**
 * Minimal cookie-authenticated Substack client.
 *
 * Substack has no official publishing API — this drives the same internal
 * draft → prepublish → publish endpoints the web editor uses (reference
 * implementation: python-substack / scripts/publish-substack.py). Auth is a
 * browser session cookie string (SUBSTACK_COOKIES_STRING), because password
 * login is Cloudflare-blocked from datacenter IPs.
 *
 * Runs server-side on Vercel where outbound network is unrestricted — the
 * whole reason this lives in the site instead of a sandboxed session.
 */

const SUBSTACK_API = 'https://substack.com/api/v1';
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

export interface SubstackDraftPayload {
  draft_title: string;
  draft_subtitle: string;
  draft_body: string; // JSON-stringified ProseMirror doc
  draft_bylines: Array<{ id: number; is_guest: boolean }>;
  audience: string;
  draft_section_id: null;
  section_chosen: boolean;
  write_comment_permissions: string;
}

export interface SubstackPostSummary {
  id?: number;
  slug?: string;
  title?: string;
  draft_title?: string;
}

export class SubstackError extends Error {
  status: number;
  cloudflare: boolean;

  constructor(status: number, body: string) {
    const cf =
      body.includes('Just a moment') ||
      body.includes('cf-chl') ||
      status === 403;
    super(
      `Substack API ${status}: ${body.slice(0, 300)}${
        cf
          ? ' [likely Cloudflare challenge — refresh SUBSTACK_COOKIES_STRING]'
          : ''
      }`
    );
    this.status = status;
    this.cloudflare = cf;
  }
}

export class SubstackClient {
  private cookies: string;
  private pubApi: string;
  private pubUrl: string;

  constructor(cookiesString: string, publicationUrl: string) {
    this.cookies = cookiesString.trim();
    this.pubUrl = publicationUrl.trim().replace(/\/+$/, '');
    this.pubApi = `${this.pubUrl}/api/v1`;
  }

  publicationUrl(): string {
    return this.pubUrl;
  }

  private async request(
    method: 'GET' | 'POST' | 'PUT',
    url: string,
    body?: unknown
  ): Promise<unknown> {
    const headers: Record<string, string> = {
      Cookie: this.cookies,
      'User-Agent': UA,
      Accept: 'application/json',
    };
    if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
      headers.Origin = this.pubUrl;
      headers.Referer = `${this.pubUrl}/publish/home`;
    }
    const init: RequestInit = { method, headers, redirect: 'manual' };
    if (body !== undefined) init.body = JSON.stringify(body);
    const res = await fetch(url, init);
    const text = await res.text();
    if (res.status < 200 || res.status >= 300) {
      throw new SubstackError(res.status, text);
    }
    try {
      return JSON.parse(text) as unknown;
    } catch {
      throw new SubstackError(
        res.status,
        `non-JSON response: ${text.slice(0, 200)}`
      );
    }
  }

  /** Logged-in user id (needed for draft bylines). Also validates the cookie. */
  async getUserId(): Promise<number> {
    const profile = (await this.request(
      'GET',
      `${SUBSTACK_API}/user/profile/self`
    )) as { id?: number };
    if (typeof profile.id !== 'number') {
      throw new Error(
        'Substack profile response had no user id — cookie invalid?'
      );
    }
    return profile.id;
  }

  async listPublished(limit = 25): Promise<SubstackPostSummary[]> {
    const resp = await this.request(
      'GET',
      `${this.pubApi}/post_management/published?offset=0&limit=${limit}` +
        '&order_by=post_date&order_direction=desc'
    );
    return extractPosts(resp);
  }

  async listDrafts(limit = 25): Promise<SubstackPostSummary[]> {
    const resp = await this.request(
      'GET',
      `${this.pubApi}/drafts?filter=draft&offset=0&limit=${limit}`
    );
    return extractPosts(resp);
  }

  async createDraft(payload: SubstackDraftPayload): Promise<{ id: number }> {
    const draft = (await this.request(
      'POST',
      `${this.pubApi}/drafts`,
      payload
    )) as { id?: number };
    if (typeof draft.id !== 'number') {
      throw new Error('Substack draft creation returned no id');
    }
    return { id: draft.id };
  }

  async updateDraft(
    draftId: number,
    patch: Record<string, unknown>
  ): Promise<unknown> {
    return this.request('PUT', `${this.pubApi}/drafts/${draftId}`, patch);
  }

  async prepublishDraft(draftId: number): Promise<unknown> {
    return this.request('GET', `${this.pubApi}/drafts/${draftId}/prepublish`);
  }

  async publishDraft(
    draftId: number,
    send: boolean
  ): Promise<{ id?: number; slug?: string }> {
    return (await this.request(
      'POST',
      `${this.pubApi}/drafts/${draftId}/publish`,
      {
        send,
        share_automatically: false,
      }
    )) as { id?: number; slug?: string };
  }
}

function extractPosts(resp: unknown): SubstackPostSummary[] {
  if (Array.isArray(resp)) return resp as SubstackPostSummary[];
  if (resp && typeof resp === 'object') {
    const obj = resp as Record<string, unknown>;
    for (const key of ['posts', 'drafts', 'items']) {
      if (Array.isArray(obj[key])) return obj[key] as SubstackPostSummary[];
    }
  }
  return [];
}
