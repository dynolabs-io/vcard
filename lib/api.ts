// API client for api.dynolabs.io. Thin wrapper — services return their own
// JSON shapes; we just centralize the base URL and JSON handling.

import { config } from './config';

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
  /** Request a signed Apple .pkpass for a given card. Returns 503 in stub-mode. */
  applePass: (cardId: string) => request<{ url: string }>(`/pass/apple`, { method: 'POST', body: JSON.stringify({ cardId }) }),
  /** Request a Google Wallet save URL. */
  googlePass: (cardId: string) => request<{ url: string }>(`/pass/google`, { method: 'POST', body: JSON.stringify({ cardId }) }),
  /** Begin LinkedIn connect flow — returns the URL the user opens in a browser. */
  linkedinAuthorize: () => request<{ url: string }>(`/oauth/linkedin/authorize`),
};
