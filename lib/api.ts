// API client for api.dynolabs.io. Thin wrapper — services return their own
// JSON shapes; we just centralize the base URL and JSON handling.
//
// Every request uses an AbortController-backed timeout so a stalled
// network never hangs the UI (the v1 incident was Save-card spinning
// forever because fetch had no timeout).
//
// The session token (issued by /v1/auth/apple after Sign in with Apple)
// is plumbed through getAuthToken() — callers can swap the function (set
// from app/_layout via setAuthTokenProvider) so we don't have to thread
// auth state through every request manually.

import { config } from './config';
import type { Card } from './types';

const DEFAULT_TIMEOUT_MS = 6000;

export class ApiError extends Error {
  constructor(public status: number, public body: unknown, message: string) {
    super(message);
  }
}

export class TimeoutError extends Error {
  constructor() { super('request timed out'); }
}

// Auth token provider — set once at app boot. Anonymous callers leave
// this as the no-op default and the Authorization header is omitted.
let authTokenProvider: () => Promise<string | null> = async () => null;
export function setAuthTokenProvider(fn: () => Promise<string | null>): void {
  authTokenProvider = fn;
}

async function request<T>(path: string, init: RequestInit = {}, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<T> {
  const url = `${config.apiBase}${path.startsWith('/') ? path : `/${path}`}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const token = await authTokenProvider();
    const res = await fetch(url, {
      ...init,
      signal: ctrl.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(init.headers ?? {}),
      },
    });
    const text = await res.text();
    let body: unknown;
    try { body = text ? JSON.parse(text) : null; } catch { body = text; }
    if (!res.ok) throw new ApiError(res.status, body, `${res.status} ${url}`);
    return body as T;
  } catch (err: unknown) {
    if ((err as { name?: string })?.name === 'AbortError') throw new TimeoutError();
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export type Social = { kind: string; url: string };
export type User = { id: string; name?: string; email?: string };
export type AuthResponse = { token: string; user: User };

export type ConflictResolution = {
  slug: string;
  winner: 'local' | 'remote' | 'both';
  local?: Card;
};

export type ClaimResponse = {
  claimed: string[];
  resolved: Card[];
  userCards: Card[];
};

export type ServerScan = {
  id: string;
  targetSlug: string;
  notes?: string;
  tags: string[];
  lat?: number;
  lon?: number;
  placeName?: string;
  eventName?: string;
  reveal?: boolean;
  scannedAt: string;
  createdAt: string;
  updatedAt: string;
};

export type InboxSummary = {
  totalScans: number;
  last7Days: number;
  last30Days: number;
  uniqueUsers: number;
};

export type Lead = {
  id: string;
  targetSlug: string;
  fromName?: string;
  fromEmail?: string;
  fromPhone?: string;
  message?: string;
  createdAt: string;
};

export type RevealedScanner = {
  userId: string;
  name?: string;
  email?: string;
  targetSlug: string;
  placeName?: string;
  eventName?: string;
  scannedAt: string;
};

export const api = {
  healthz: () => request<{ status: string; service: string; version: string; time: string }>('/healthz'),
  createCard: (card: Partial<Card> & { name: string; deviceId: string }) =>
    request<Card>('/v1/cards', { method: 'POST', body: JSON.stringify(card) }),
  listCards: (deviceId: string) =>
    request<Card[]>(`/v1/cards?device_id=${encodeURIComponent(deviceId)}`),
  getCard: (id: string) =>
    request<Card>(`/v1/cards/${encodeURIComponent(id)}`),
  /** Public lookup by slug — no auth, used by the Scanned tab to
   *  refresh saved snapshots with the card owner's latest data. */
  publicCard: (slug: string) =>
    request<Card>(`/v1/c/${encodeURIComponent(slug)}`),
  updateCard: (id: string, patch: Partial<Card>) =>
    request<Card>(`/v1/cards/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  deleteCard: (id: string) =>
    request<null>(`/v1/cards/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  // Auth.
  appleSignIn: (identityToken: string, name?: string, email?: string) =>
    request<AuthResponse>('/v1/auth/apple', {
      method: 'POST',
      body: JSON.stringify({ identityToken, name, email }),
    }, 10_000),
  linkedInSignIn: (sub: string, name?: string, email?: string, picture?: string, vanity?: string) =>
    request<AuthResponse>('/v1/auth/linkedin', {
      method: 'POST',
      body: JSON.stringify({ sub, name, email, picture, vanity }),
    }, 10_000),
  me: () => request<User>('/v1/users/me'),

  // Email → person+company enrichment via Apollo (server-side).
  // Returns empty fields when the backend can't enrich (no key set,
  // Apollo 4xx, etc) — caller must handle empty values gracefully.
  enrichEmail: (email: string) =>
    request<{
      title?: string;
      company?: string;
      companyDomain?: string;
      linkedinUrl?: string;
      photoUrl?: string;
    }>('/v1/enrich/email', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }, 10_000),

  // Claim / merge — attach the given device_id's anonymous cards to
  // the signed-in user, apply per-conflict resolutions, return final
  // user-owned list. Caller must already be signed in (Authorization
  // header is set by setAuthTokenProvider).
  claim: (deviceId: string, conflicts?: ConflictResolution[]) =>
    request<ClaimResponse>('/v1/cards/claim', {
      method: 'POST',
      body: JSON.stringify({ deviceId, conflicts: conflicts ?? [] }),
    }, 15_000),

  // Rolodex (scans) — all require signed-in auth, used by lib/scans.ts.
  scansCreate: (s: Partial<ServerScan> & { targetSlug: string }) =>
    request<ServerScan>('/v1/scans', { method: 'POST', body: JSON.stringify(s) }),
  scansList: () => request<ServerScan[]>('/v1/scans'),
  scansUpdate: (id: string, patch: Partial<ServerScan>) =>
    request<ServerScan>(`/v1/scans/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  scansDelete: (id: string) =>
    request<null>(`/v1/scans/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  scansInbox: () => request<InboxSummary>('/v1/scans/inbox'),

  // Leads — visitors who used the "request callback" form on a card
  // owner's public web profile (dynolabs.io/c/<slug>).
  leadsList: () => request<Lead[]>('/v1/leads'),

  // Connections — scanners who scanned my cards AND opted in to reveal.
  connectionsList: () => request<RevealedScanner[]>('/v1/scans/connections'),

  // Block list — owner-side privacy control.
  blocksList: () => request<{ blocked: string[] }>('/v1/blocks'),
  blockUser: (userId: string) =>
    request<null>('/v1/blocks', { method: 'POST', body: JSON.stringify({ userId }) }),
  unblockUser: (userId: string) =>
    request<null>(`/v1/blocks/${encodeURIComponent(userId)}`, { method: 'DELETE' }),

  /** URL the app opens to download a signed .pkpass for a slug.
   *  iOS sees the application/vnd.apple.pkpass content-type and shows
   *  the native "Add to Apple Wallet" sheet. */
  applePassUrl: (slug: string, mode: 'offline' | 'online' = 'online') =>
    `${config.apiBase}/pass/apple?slug=${encodeURIComponent(slug)}&mode=${mode}`,
};

/** Shareable web-profile URL for a card. */
export function profileUrl(slug: string): string {
  return `${config.webBase}/c/${slug}`;
}
