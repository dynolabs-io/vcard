// Share helpers — uses expo-file-system v54+ File/Paths API + expo-sharing.
// Earlier we required('expo-file-system/legacy') which crashed at the
// native bridge on iOS 26 — Sharing.shareAsync receives a path that the
// new-arch bridge doesn't accept the same way.

import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import type { Card } from './types';
import { buildVCard } from './vcard';

function safe(name: string): string {
  return (name || 'card').replace(/[^a-zA-Z0-9_-]+/g, '_');
}

export async function shareVCard(card: Card, profileUrl?: string): Promise<void> {
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
  const file = new File(Paths.cache, '.tmp.txt');
  if (file.exists) file.delete();
  file.create();
  file.write(`${name} — ${url}`);
  await Sharing.shareAsync(file.uri, { mimeType: 'text/plain', dialogTitle: 'Share link' });
}
