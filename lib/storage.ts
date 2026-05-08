// MMKV-backed local card storage. Offline-first per v1 design — no
// account, no cloud sync. The user's cards live only on their device
// until cloud sync ships in v1.1.
//
// MMKV v4 ships an interface type plus a `createMMKV` factory.

import { createMMKV, type MMKV } from 'react-native-mmkv';
import type { Card } from './types';

const KEY_CARDS = 'cards.v1';
const KEY_DEFAULT = 'cards.defaultId';

// Instantiate lazily so this module is import-safe on web/SSR builds where
// the native binding isn't available until first use.
let mmkv: MMKV | null = null;
function store(): MMKV {
  if (!mmkv) mmkv = createMMKV({ id: 'dynolabs-vcard' });
  return mmkv;
}

export function listCards(): Card[] {
  const raw = store().getString(KEY_CARDS);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as Card[];
  } catch {
    return [];
  }
}

export function saveCard(card: Card): void {
  const cards = listCards();
  const idx = cards.findIndex(c => c.id === card.id);
  card.updatedAt = Date.now();
  if (idx >= 0) cards[idx] = card;
  else cards.push(card);
  store().set(KEY_CARDS, JSON.stringify(cards));
  if (cards.length === 1) setDefaultId(card.id);
}

export function deleteCard(id: string): void {
  const cards = listCards().filter(c => c.id !== id);
  store().set(KEY_CARDS, JSON.stringify(cards));
  if (getDefaultId() === id) setDefaultId(cards[0]?.id);
}

export function getCard(id: string): Card | undefined {
  return listCards().find(c => c.id === id);
}

export function getDefaultId(): string | undefined {
  return store().getString(KEY_DEFAULT) || undefined;
}

export function setDefaultId(id: string | undefined): void {
  if (id) store().set(KEY_DEFAULT, id);
  else store().remove(KEY_DEFAULT);
}
