// AsyncStorage-backed local card storage. Switched from MMKV-v4-Nitro
// after build 16 silently crashed on the JSI bridge in RN 0.81 new arch.
// AsyncStorage is async (everything returns a Promise) but battle-tested
// and never crashes the native layer.

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Card } from './types';

const KEY_CARDS = 'cards.v1';
const KEY_DEFAULT = 'cards.defaultId';

export async function listCards(): Promise<Card[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY_CARDS);
    if (!raw) return [];
    return JSON.parse(raw) as Card[];
  } catch {
    return [];
  }
}

export async function saveCard(card: Card): Promise<void> {
  const cards = await listCards();
  const idx = cards.findIndex(c => c.id === card.id);
  card.updatedAt = Date.now();
  if (idx >= 0) cards[idx] = card;
  else cards.push(card);
  await AsyncStorage.setItem(KEY_CARDS, JSON.stringify(cards));
  if (cards.length === 1) await setDefaultId(card.id);
}

export async function deleteCard(id: string): Promise<void> {
  const cards = (await listCards()).filter(c => c.id !== id);
  await AsyncStorage.setItem(KEY_CARDS, JSON.stringify(cards));
  if ((await getDefaultId()) === id) await setDefaultId(cards[0]?.id);
}

export async function getCard(id: string): Promise<Card | undefined> {
  return (await listCards()).find(c => c.id === id);
}

export async function getDefaultId(): Promise<string | undefined> {
  return (await AsyncStorage.getItem(KEY_DEFAULT)) || undefined;
}

export async function setDefaultId(id: string | undefined): Promise<void> {
  if (id) await AsyncStorage.setItem(KEY_DEFAULT, id);
  else await AsyncStorage.removeItem(KEY_DEFAULT);
}
