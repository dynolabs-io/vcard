// LinkedIn integration — OAuth 2.0 + OpenID Connect via our
// linkedin-oauth backend service (api.dynolabs.io/oauth/linkedin/*).
//
// Two flows:
//
//   1. Sign in with LinkedIn — creates a Dynolabs account using
//      LinkedIn as the identity provider. Returns name/email/photo.
//      Caller stores the result in lib/auth state (Build 128 doesn't
//      issue a session token yet — Apple Sign-In is the only one with
//      a server-side session; LinkedIn-sign-in stays anonymous for now
//      and just pre-fills the card. Build 132 unifies session issuance).
//
//   2. Import from LinkedIn — same flow, but the result is fed back
//      into the card editor so the user's name/email/photo populate
//      from LinkedIn instead of being typed.
//
// Both flows use ASWebAuthenticationSession (via expo-web-browser).
// User signs into LinkedIn in an in-app Safari sheet; on success
// the sheet auto-closes and we receive a deep-link with `state`.
// We then poll /oauth/linkedin/result?state= for the profile JSON.

import * as WebBrowser from 'expo-web-browser';
import { config } from './config';

export type LinkedInProfile = {
  sub: string;
  email?: string;
  name: string;
  picture?: string;
  given_name?: string;
  family_name?: string;
  // The linkedin.com/in/<slug> handle. Best-effort — present when
  // LinkedIn returns either a `vanityName` claim or a parseable
  // `profile` URL in /v2/userinfo. Powers vcard-api's LinkedIn-via-iogrid
  // enrichment fallback for the user's own email.
  vanity?: string;
};

const DEEPLINK_PREFIX = 'dynolabs-vcard://oauth/linkedin';

async function freshState(): Promise<string> {
  const a = new Uint8Array(16);
  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    globalThis.crypto.getRandomValues(a);
  } else {
    for (let i = 0; i < a.length; i++) a[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(a, b => b.toString(16).padStart(2, '0')).join('');
}

export type LinkedInOutcome =
  | { ok: true; profile: LinkedInProfile }
  | { ok: false; reason: 'cancel' | 'error'; message?: string };

/** Drive the full OAuth flow. Caller decides what to do with the
 *  returned profile (sign in to Dynolabs, prefill card, both). */
export async function connectLinkedIn(): Promise<LinkedInOutcome> {
  const state = await freshState();
  const apiBase = config.apiBase;

  // Ask our backend to mint a LinkedIn authorize URL bound to our
  // chosen state + the deep-link the app will receive on completion.
  let authorizeURL: string;
  try {
    const res = await fetch(
      `${apiBase}/oauth/linkedin/authorize?state=${encodeURIComponent(state)}&redirect=${encodeURIComponent(DEEPLINK_PREFIX)}`,
    );
    if (!res.ok) {
      const body = await res.text();
      return { ok: false, reason: 'error', message: `authorize ${res.status}: ${body}` };
    }
    const json = (await res.json()) as { url?: string };
    if (!json.url) return { ok: false, reason: 'error', message: 'no authorize url' };
    authorizeURL = json.url;
  } catch (e) {
    return { ok: false, reason: 'error', message: String(e) };
  }

  // Open in-app Safari sheet; auto-closes on deep-link match.
  // preferEphemeralSession=FALSE on purpose: we WANT the LinkedIn
  // cookie to persist across sign-ins so the user doesn't have to
  // re-enter their password every time. The iOS "wants to use
  // linkedin.com to sign you in" consent prompt is Apple-mandated
  // and can't be suppressed — but with cookie sharing, the LinkedIn
  // password page itself is skipped after the first sign-in.
  const result = await WebBrowser.openAuthSessionAsync(
    authorizeURL,
    DEEPLINK_PREFIX,
  );
  if (result.type !== 'success') {
    return { ok: false, reason: 'cancel' };
  }
  // Server has now redirected the user's browser to <DEEPLINK_PREFIX>?state=...
  // and the auth session is closed. Poll for the profile.
  try {
    const res = await fetch(
      `${apiBase}/oauth/linkedin/result?state=${encodeURIComponent(state)}`,
    );
    if (!res.ok) {
      const body = await res.text();
      return { ok: false, reason: 'error', message: `result ${res.status}: ${body}` };
    }
    const profile = (await res.json()) as LinkedInProfile;
    if (!profile.sub) return { ok: false, reason: 'error', message: 'empty profile' };
    return { ok: true, profile };
  } catch (e) {
    return { ok: false, reason: 'error', message: String(e) };
  }
}
