// Device identity. v1 has no accounts; cards are bound to a stable
// per-install UUID stored in AsyncStorage.

import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'device.id';

let cachedId: string | null = null;

export async function getDeviceId(): Promise<string> {
  if (cachedId) return cachedId;
  const existing = await AsyncStorage.getItem(KEY);
  if (existing) {
    cachedId = existing;
    return existing;
  }
  const fresh = uuidv4();
  await AsyncStorage.setItem(KEY, fresh);
  cachedId = fresh;
  return fresh;
}

function uuidv4(): string {
  const bytes = new Uint8Array(16);
  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
