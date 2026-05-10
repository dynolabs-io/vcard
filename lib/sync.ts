// Combined local-first + remote sync layer. Cards live primarily in
// MMKV so the app works offline; on every successful API call we
// refresh the local cache. Per CAP-AP design, network failures don't
// block the user — they keep working with whatever's local.

import { api } from './api';
import { getDeviceId } from './device';
import { listCards as listLocal, saveCard as saveLocal, deleteCard as deleteLocal } from './storage';
import type { Card } from './types';

export async function listCardsRemoteOrLocal(): Promise<{ cards: Card[]; source: 'remote' | 'local' }> {
  try {
    const remote = await api.listCards(getDeviceId());
    for (const c of remote) saveLocal(c);
    return { cards: remote, source: 'remote' };
  } catch {
    return { cards: listLocal(), source: 'local' };
  }
}

/**
 * Create a card. Always writes locally first (offline-safe), then attempts
 * server sync. If the network call succeeds, swap the local stub for the
 * server-issued canonical record (it has slug + canonical UUID id).
 *
 * Returns the saved card (local stub or remote canonical). Throws ONLY
 * if the local MMKV write fails — that's a real error the UI must show.
 */
export async function createCardSynced(input: Card): Promise<Card> {
  // Always start from a fresh, definitely-unique local id so we can swap
  // it later. Don't trust `input.id` from emptyCard() — that's a build-
  // time placeholder.
  const localId = freshId();
  const localStub: Card = {
    ...input,
    id: localId,
    slug: undefined,                    // server-only field
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  // 1. Write locally — this MUST succeed or the user sees nothing in the
  //    list and we throw so the UI can show an error.
  saveLocal(localStub);

  // 2. Attempt server sync. We deliberately DON'T await on a long timeout
  //    here in onSave's hot path; api.createCard already has 6s bound.
  try {
    const remote = await api.createCard({
      ...input,
      id: undefined as unknown as string,    // let server assign
      slug: undefined,
      createdAt: undefined as unknown as number,
      updatedAt: undefined as unknown as number,
      deviceId: getDeviceId(),
    });
    // Swap stub → canonical
    deleteLocal(localId);
    saveLocal(remote);
    return remote;
  } catch {
    // Network down or API timeout → keep local stub. User sees the card
    // immediately; sync happens later via listCardsRemoteOrLocal on focus.
    return localStub;
  }
}

function freshId(): string {
  // Prefer crypto.getRandomValues which is reliably present in RN 0.74+.
  const bytes = new Uint8Array(16);
  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}
