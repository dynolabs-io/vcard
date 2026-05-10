// Share helpers — lazy-loaded native modules. Each function returns
// a Promise that rejects with a readable error so callers can Alert.

import type { Card } from './types';
import { buildVCard } from './vcard';

export async function shareVCard(card: Card, profileUrl?: string): Promise<void> {
  const FileSystem = require('expo-file-system/legacy');
  const Sharing = require('expo-sharing');
  const text = buildVCard(card, { profileUrl, photoUrl: card.photoUrl });
  const safeName = (card.name || 'vcard').replace(/[^a-zA-Z0-9_-]+/g, '_');
  const path = `${FileSystem.cacheDirectory}${safeName}.vcf`;
  await FileSystem.writeAsStringAsync(path, text, { encoding: FileSystem.EncodingType.UTF8 });
  await Sharing.shareAsync(path, {
    mimeType: 'text/vcard',
    UTI: 'public.vcard',
    dialogTitle: 'Share contact card',
  });
}

export async function sharePNGFromBase64(base64: string, fileName: string, dialogTitle: string): Promise<void> {
  const FileSystem = require('expo-file-system/legacy');
  const Sharing = require('expo-sharing');
  const path = `${FileSystem.cacheDirectory}${fileName}`;
  await FileSystem.writeAsStringAsync(path, base64, { encoding: FileSystem.EncodingType.Base64 });
  await Sharing.shareAsync(path, {
    mimeType: 'image/png',
    UTI: 'public.png',
    dialogTitle,
  });
}

export async function shareLink(name: string, url: string): Promise<void> {
  const FileSystem = require('expo-file-system/legacy');
  const Sharing = require('expo-sharing');
  const path = `${FileSystem.cacheDirectory}.tmp.txt`;
  await FileSystem.writeAsStringAsync(path, `${name} — ${url}`, { encoding: FileSystem.EncodingType.UTF8 });
  await Sharing.shareAsync(path, { mimeType: 'text/plain', dialogTitle: 'Share link' });
}
