// Share helpers — ALL native module requires deferred inside functions.
// Top-level static imports of expo-sharing / expo-file-system eager-load
// the native binding at module evaluation. On iOS 26 new arch this
// crashes when ANY screen that imports share.ts mounts (incl card detail).
// v57 regression — back to lazy.

import type { Card } from './types';
import { buildVCard } from './vcard';

function safe(name: string): string {
  return (name || 'card').replace(/[^a-zA-Z0-9_-]+/g, '_');
}

export async function shareVCard(card: Card, profileUrl?: string): Promise<void> {
  const { File, Paths } = require('expo-file-system');
  const Sharing = require('expo-sharing');
  const text = buildVCard(card, { profileUrl, photoUrl: card.photoUrl });
  const file = new File(Paths.cache, `${safe(card.name || 'vcard')}.vcf`);
  if (file.exists) file.delete();
  file.create();
  file.write(text);
  await Sharing.shareAsync(file.uri, {
    mimeType: 'text/vcard',
    UTI: 'public.vcard',
    dialogTitle: 'Share contact card',
  });
}

export async function sharePNGFromBase64(base64: string, fileName: string, dialogTitle: string): Promise<void> {
  const { File, Paths } = require('expo-file-system');
  const Sharing = require('expo-sharing');
  const file = new File(Paths.cache, fileName);
  if (file.exists) file.delete();
  file.create();
  file.base64 = base64;
  await Sharing.shareAsync(file.uri, {
    mimeType: 'image/png',
    UTI: 'public.png',
    dialogTitle,
  });
}

export async function shareLink(name: string, url: string): Promise<void> {
  const { File, Paths } = require('expo-file-system');
  const Sharing = require('expo-sharing');
  const file = new File(Paths.cache, '.tmp.txt');
  if (file.exists) file.delete();
  file.create();
  file.write(`${name} — ${url}`);
  await Sharing.shareAsync(file.uri, { mimeType: 'text/plain', dialogTitle: 'Share link' });
}
