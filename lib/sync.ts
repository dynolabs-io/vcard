// Combined local-first + remote sync layer. Cards live primarily in
// AsyncStorage so the app works offline; on every successful API call
// we refresh the local cache.

import { api } from './api';
import { getDeviceId } from './device';
import { listCards as listLocal, saveCard as saveLocal, deleteCard as deleteLocal } from './storage';
import type { Card } from './types';

export async function listCardsRemoteOrLocal(): Promise<{ cards: Card[]; source: 'remote' | 'local' }> {
  // Local-first: NEVER let stale remote clobber an unsynced local edit.
  // We merge remote-only cards in (e.g. ones created on another device)
  // but keep local versions of any card the device already knows about.
  const local = await listLocal();
  const localIds = new Set(local.map(c => c.id));
  try {
    const did = await getDeviceId();
    const remote = await api.listCards(did);
    const merged = [...local];
    for (const c of remote) {
      if (!localIds.has(c.id)) {
        await saveLocal(c);
        merged.push(c);
      }
    }
    return { cards: merged, source: 'remote' };
  } catch {
    return { cards: local, source: 'local' };
  }
}

/** When the local copy of a card is missing its server slug (e.g. an
 *  earlier create raced the network timeout and we kept the local stub),
 *  fetch from the server by deviceId and find the matching row. Falls
 *  back to the local card unchanged if the server has nothing. */
export async function refetchCardIfMissingSlug(local: Card): Promise<Card> {
  if (local.slug) return local;
  try {
    const did = await getDeviceId();
    const remote = await api.listCards(did);
    // Heuristic: same name + same creation order → same card. Newest first.
    const match = remote
      .filter(r => r.name === local.name && r.label === local.label)
      .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))[0];
    if (match?.slug) {
      // Persist so future opens already have the slug.
      const { saveCard, deleteCard } = await import('./storage');
      await saveCard(match);
      // Remove the local-only stub since its id no longer matches.
      if (local.id !== match.id) await deleteCard(local.id);
      return match;
    }
  } catch {/* offline — fall through */}
  return local;
}

export async function createCardSynced(input: Card): Promise<Card> {
  const localId = freshId();
  const localStub: Card = {
    ...input,
    id: localId,
    slug: undefined,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  await saveLocal(localStub);

  try {
    const did = await getDeviceId();
    const remote = await api.createCard({
      ...input,
      id: undefined as unknown as string,
      slug: undefined,
      createdAt: undefined as unknown as number,
      updatedAt: undefined as unknown as number,
      deviceId: did,
    });
    await deleteLocal(localId);
    await saveLocal(remote);
    return remote;
  } catch {
    return localStub;
  }
}

function freshId(): string {
  const bytes = new Uint8Array(16);
  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}
