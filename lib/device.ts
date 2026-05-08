// Device identity. v1 has no accounts; cards are bound to a stable
// per-install UUID stored in MMKV. Reinstalling the app gets a fresh
// device id (cards on the server become orphaned — that's the v1
// trade-off; v1.1 introduces account-based portability).

import { createMMKV, type MMKV } from 'react-native-mmkv';

const KEY = 'device.id';

let mmkv: MMKV | null = null;
function store(): MMKV {
  if (!mmkv) mmkv = createMMKV({ id: 'dynolabs-vcard-device' });
  return mmkv;
}

export function getDeviceId(): string {
  const existing = store().getString(KEY);
  if (existing) return existing;
  const fresh = uuidv4();
  store().set(KEY, fresh);
  return fresh;
}

function uuidv4(): string {
  const bytes = new Uint8Array(16);
  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 10
  const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
