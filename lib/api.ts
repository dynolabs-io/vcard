// API client for api.dynolabs.io. Thin wrapper — services return their own
// JSON shapes; we just centralize the base URL and JSON handling.

import { config } from './config';
import type { Card } from './types';

export class ApiError extends Error {
  constructor(public status: number, public body: unknown, message: string) {
    super(message);
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const url = `${config.apiBase}${path.startsWith('/') ? path : `/${path}`}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
  const text = await res.text();
  let body: unknown;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!res.ok) {
    throw new ApiError(res.status, body, `${res.status} ${url}`);
  }
  return body as T;
}

export const api = {
  /** Health probe of vcard-api. Useful for splash screen / settings page. */
  healthz: () => request<{ status: string; service: string; version: string; time: string }>('/healthz'),

  /** Cards CRUD against vcard-api. */
  createCard: (card: Partial<Card> & { name: string; deviceId: string }) =>
    request<Card>('/v1/cards', { method: 'POST', body: JSON.stringify(card) }),
  listCards: (deviceId: string) =>
    request<Card[]>(`/v1/cards?device_id=${encodeURIComponent(deviceId)}`),
  getCard: (id: string) =>
    request<Card>(`/v1/cards/${encodeURIComponent(id)}`),
  updateCard: (id: string, patch: Partial<Card>) =>
    request<Card>(`/v1/cards/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  deleteCard: (id: string) =>
    request<void>(`/v1/cards/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  /** Wallet + OAuth — return 503 in stub-mode until operator credentials land. */
  applePass: (cardId: string) => request<{ url: string }>(`/pass/apple`, { method: 'POST', body: JSON.stringify({ cardId }) }),
  googlePass: (cardId: string) => request<{ url: string }>(`/pass/google`, { method: 'POST', body: JSON.stringify({ cardId }) }),
  linkedinAuthorize: () => request<{ url: string }>(`/oauth/linkedin/authorize`),
};

/** Shareable web-profile URL for a card. */
export function profileUrl(slug: string): string {
  return `${config.webBase}/c/${slug}`;
}
