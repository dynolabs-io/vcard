// Combined local-first + remote sync layer. Cards live primarily in
// AsyncStorage so the app works offline; on every successful API call
// we refresh the local cache.

import { api } from './api';
import { getDeviceId } from './device';
import { listCards as listLocal, saveCard as saveLocal, deleteCard as deleteLocal } from './storage';
import type { Card } from './types';

export async function listCardsRemoteOrLocal(): Promise<{ cards: Card[]; source: 'remote' | 'local' }> {
  try {
    const did = await getDeviceId();
    const remote = await api.listCards(did);
    for (const c of remote) await saveLocal(c);
    return { cards: remote, source: 'remote' };
  } catch {
    return { cards: await listLocal(), source: 'local' };
  }
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
