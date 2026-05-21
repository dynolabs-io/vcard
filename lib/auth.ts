// Sign in with Apple — optional. Lives entirely outside the
// device-bound code path so existing anonymous users keep working
// unchanged. When the user signs in we attach their cards via
// /v1/cards/claim, then keep the cards in sync via Authorization
// Bearer on every API call.

import * as SecureStore from 'expo-secure-store';
import * as AppleAuthentication from 'expo-apple-authentication';
import { api, setAuthTokenProvider, type ConflictResolution, type User } from './api';
import { getDeviceId } from './device';
import { connectLinkedIn } from './linkedin';
import { pullServerScans, pushLocalScans } from './scans';
import { listCards as listLocal, saveCard as saveLocal } from './storage';
import type { Card } from './types';

const TOKEN_KEY = 'dynolabs.session.token';
const USER_KEY  = 'dynolabs.session.user';

let cachedToken: string | null = null;
let cachedUser: User | null = null;
const subscribers = new Set<(s: AuthState) => void>();

export type AuthState = {
  token: string | null;
  user: User | null;
  signedIn: boolean;
};

function snapshot(): AuthState {
  return { token: cachedToken, user: cachedUser, signedIn: !!cachedToken };
}

function notify(): void {
  const s = snapshot();
  for (const fn of subscribers) {
    try { fn(s); } catch { /* never crash a subscriber */ }
  }
}

/** React hook-friendly subscription. */
export function subscribe(fn: (s: AuthState) => void): () => void {
  subscribers.add(fn);
  fn(snapshot());
  return () => { subscribers.delete(fn); };
}

export function getAuthSnapshot(): AuthState { return snapshot(); }

/** Wire the token provider so all api.* calls send Authorization. */
export async function bootAuth(): Promise<void> {
  // Pull the persisted token + user (if any) into memory.
  try {
    cachedToken = await SecureStore.getItemAsync(TOKEN_KEY);
    const u = await SecureStore.getItemAsync(USER_KEY);
    cachedUser = u ? JSON.parse(u) : null;
  } catch {
    cachedToken = null;
    cachedUser = null;
  }
  setAuthTokenProvider(async () => cachedToken);
  notify();
}

export async function isAppleSignInAvailable(): Promise<boolean> {
  try { return await AppleAuthentication.isAvailableAsync(); }
  catch { return false; }
}

/** Conflict pair surfaced to the user for resolution. The merge sheet
 *  iterates over these and emits a ConflictResolution per row. */
export type MergeConflict = {
  slug: string;
  local: Card;
  remote: Card;
};

/** Result of signInWithApple — caller routes the user to the merge
 *  sheet if conflicts.length > 0, otherwise just shows a brief toast. */
export type SignInResult = {
  user: User;
  /** Local cards that got attached to the user without conflict. */
  attachedCount: number;
  /** Server cards downloaded into local storage (different ids than
   *  any local card we had). */
  downloadedCount: number;
  /** Slug collisions where local and remote diverge — user must pick. */
  conflicts: MergeConflict[];
};

/** Drive the full SIWA → claim → sync flow. Returns the merge work the
 *  caller still has to do (conflicts), or null if the user cancelled. */
export async function signInWithApple(): Promise<SignInResult | null> {
  let credential;
  try {
    credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });
  } catch (e: unknown) {
    // User cancel or system rejection — silently bail.
    const msg = (e as { message?: string })?.message || '';
    if ((e as { code?: string })?.code === 'ERR_REQUEST_CANCELED' || msg.includes('canceled')) {
      return null;
    }
    throw e;
  }
  const idToken = credential.identityToken;
  if (!idToken) throw new Error('Apple did not return an identityToken');

  // Apple ships fullName ONLY on the very first sign-in for a user; on
  // subsequent SIWA flows fullName comes back null. Pass it through so
  // the server can store it on first login.
  const name = credential.fullName
    ? [credential.fullName.givenName, credential.fullName.familyName].filter(Boolean).join(' ')
    : undefined;
  const auth = await api.appleSignIn(idToken, name, credential.email || undefined);

  await SecureStore.setItemAsync(TOKEN_KEY, auth.token);
  await SecureStore.setItemAsync(USER_KEY, JSON.stringify(auth.user));
  cachedToken = auth.token;
  cachedUser = auth.user;
  notify();

  // Run claim + merge.
  const local = await listLocal();
  const did = await getDeviceId();
  const r = await api.claim(did, []);
  const userCards = r.userCards || [];
  const claimed = r.claimed || [];

  const conflicts: MergeConflict[] = [];
  const downloads: Card[] = [];

  for (const remote of userCards) {
    if (!remote.slug) continue;
    const matchingLocal = local.find(l => l.slug === remote.slug);
    if (!matchingLocal) {
      downloads.push(remote);
      continue;
    }
    if (matchingLocal.id === remote.id) {
      await saveLocal(remote);
      continue;
    }
    if (cardsEqual(matchingLocal, remote)) {
      await saveLocal(remote);
      continue;
    }
    conflicts.push({ slug: remote.slug, local: matchingLocal, remote });
  }

  for (const d of downloads) await saveLocal(d);

  try { await pushLocalScans(); } catch {}
  try { await pullServerScans(); } catch {}

  return {
    user: auth.user,
    attachedCount: claimed.length,
    downloadedCount: downloads.length,
    conflicts,
  };
}

/** Apply user's per-conflict choices: ship to server, persist locally. */
export async function applyMergeResolutions(resolutions: ConflictResolution[]): Promise<void> {
  const did = await getDeviceId();
  const r = await api.claim(did, resolutions);
  for (const c of (r.userCards || [])) await saveLocal(c);
  // For "both" winners the server has a NEW slug; the old local card
  // (still in storage) is left alone — it stays as an anonymous backup.
  // The new slugged card from r.resolved is already in r.userCards.
  notify();
}

/** Sign in via LinkedIn — mirrors signInWithApple. Runs the OAuth flow,
 *  posts the profile to /v1/auth/linkedin to obtain a session token,
 *  persists token + user, runs claim/merge like Apple flow. */
export async function signInWithLinkedIn(): Promise<SignInResult | null> {
  const li = await connectLinkedIn();
  if (!li.ok) {
    if (li.reason === 'cancel') return null;
    throw new Error(li.message || 'LinkedIn sign in failed');
  }
  const p = li.profile;
  const auth = await api.linkedInSignIn(p.sub, p.name, p.email, p.picture, p.vanity);

  await SecureStore.setItemAsync(TOKEN_KEY, auth.token);
  await SecureStore.setItemAsync(USER_KEY, JSON.stringify(auth.user));
  cachedToken = auth.token;
  cachedUser = auth.user;
  notify();

  // Claim + merge — same flow as Apple. Note: server may return nil
  // slices as JSON null when claimed/resolved/userCards are empty —
  // coalesce defensively or `.length` blows up.
  const local = await listLocal();
  const did = await getDeviceId();
  const r = await api.claim(did, []);
  const userCards = r.userCards || [];
  const claimed = r.claimed || [];
  const conflicts: MergeConflict[] = [];
  const downloads: Card[] = [];
  for (const remote of userCards) {
    if (!remote.slug) continue;
    const matchingLocal = local.find(l => l.slug === remote.slug);
    if (!matchingLocal) { downloads.push(remote); continue; }
    if (matchingLocal.id === remote.id) { await saveLocal(remote); continue; }
    if (cardsEqual(matchingLocal, remote)) { await saveLocal(remote); continue; }
    conflicts.push({ slug: remote.slug, local: matchingLocal, remote });
  }
  for (const d of downloads) await saveLocal(d);
  try { await pushLocalScans(); } catch {}
  try { await pullServerScans(); } catch {}

  return {
    user: auth.user,
    attachedCount: claimed.length,
    downloadedCount: downloads.length,
    conflicts,
  };
}

export async function signOut(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    await SecureStore.deleteItemAsync(USER_KEY);
  } catch { /* ignore */ }
  cachedToken = null;
  cachedUser = null;
  notify();
}

function cardsEqual(a: Card, b: Card): boolean {
  return (
    a.name === b.name &&
    a.label === b.label &&
    (a.title || '') === (b.title || '') &&
    (a.company || '') === (b.company || '') &&
    JSON.stringify(a.emails || []) === JSON.stringify(b.emails || []) &&
    JSON.stringify(a.phones || []) === JSON.stringify(b.phones || []) &&
    JSON.stringify(a.socials || []) === JSON.stringify(b.socials || []) &&
    (a.photoUrl || '') === (b.photoUrl || '') &&
    (a.brandLogoUrl || '') === (b.brandLogoUrl || '') &&
    a.template === b.template &&
    (a.customColor || '') === (b.customColor || '')
  );
}
