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

async function logStep(step: string, ctx: Record<string, unknown>): Promise<void> {
  try {
    const { config } = require('@/lib/config');
    await fetch(`${config.apiBase}/v1/crash`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ where: step, ...ctx, ts: new Date().toISOString() }),
    });
  } catch { /* never throw from logger */ }
}

export async function shareVCard(card: Card, profileUrl?: string): Promise<void> {
  await logStep('share-vcard.1.before-require-fs', {});
  const { File, Paths } = require('expo-file-system');
  await logStep('share-vcard.2.before-require-sharing', { hasFile: !!File, hasPaths: !!Paths });
  const Sharing = require('expo-sharing');
  await logStep('share-vcard.3.after-requires', { hasSharing: !!Sharing, hasShareAsync: !!Sharing?.shareAsync });
  const text = buildVCard(card, { profileUrl, photoUrl: card.photoUrl });
  const fileName = `${safe(card.name || 'vcard')}.vcf`;
  await logStep('share-vcard.4.before-new-file', { cachePath: Paths?.cache, fileName });
  const file = new File(Paths.cache, fileName);
  await logStep('share-vcard.5.after-new-file', { uri: file.uri });
  if (file.exists) file.delete();
  file.create();
  file.write(text);
  await logStep('share-vcard.6.before-shareAsync', { uri: file.uri });
  await Sharing.shareAsync(file.uri, {
    mimeType: 'text/vcard',
    UTI: 'public.vcard',
    dialogTitle: 'Share contact card',
  });
  await logStep('share-vcard.7.after-shareAsync', {});
}

export async function sharePNGFromBase64(base64: string, fileName: string, dialogTitle: string): Promise<void> {
  const { File, Paths } = require('expo-file-system');
  const Sharing = require('expo-sharing');
  const file = new File(Paths.cache, fileName);
  if (file.exists) file.delete();
  file.create();
  // expo-file-system 19 expects file.write(content, { encoding: 'base64' }).
  // file.base64 = ... is not a valid setter; previously this silently
  // failed and shared an empty file.
  file.write(base64, { encoding: 'base64' });
  await Sharing.shareAsync(file.uri, {
    mimeType: 'image/png',
    UTI: 'public.png',
    dialogTitle,
  });
}

export async function shareLink(name: string, url: string): Promise<void> {
  // Share the URL as a real link via React Native's built-in Share API
  // (not a .tmp text file via expo-sharing). The receiver sees a tappable
  // URL preview in Messages/Mail/etc instead of a text attachment.
  const { Share } = require('react-native');
  await Share.share({ message: `${name} — ${url}`, url });
}
