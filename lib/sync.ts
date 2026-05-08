// Combined local-first + remote sync layer. Cards live primarily in
// MMKV so the app works offline; on every successful API call we
// refresh the local cache. Per CAP-AP design, network failures don't
// block the user — they keep working with whatever's local.

import { api } from './api';
import { getDeviceId } from './device';
import { listCards as listLocal, saveCard as saveLocal, deleteCard as deleteLocal } from './storage';
import type { Card } from './types';

/**
 * Fetch from the server when online, fall back to local on any failure.
 * Always returns immediately with the local copy if we have one — the
 * caller can re-render once the network result arrives.
 */
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
 * server sync. On network success, swap the local copy for the server's
 * version (the server assigned slug + canonical id). Bounded by the api
 * layer's 6s timeout so the UI never hangs on a stalled network.
 */
export async function createCardSynced(input: Omit<Card, 'createdAt' | 'updatedAt' | 'id'>): Promise<Card> {
  const localStub: Card = {
    ...input,
    id: input.slug || (globalThis.crypto?.randomUUID?.() ?? `local-${Date.now()}`),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  saveLocal(localStub);

  try {
    const remote = await api.createCard({ ...input, deviceId: getDeviceId(), name: input.name });
    deleteLocal(localStub.id);
    saveLocal(remote);
    return remote;
  } catch {
    return localStub;
  }
}
