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

async function fetchPhotoAsBase64(photoUrl: string): Promise<string | undefined> {
  // Inline the photo into the vCard PHOTO field. iOS Contacts only
  // auto-fetches PHOTO from URL on some flows — embedding base64
  // guarantees the receiver sees the image immediately.
  try {
    // Strip any cache-busting query param before fetching — server
    // accepts both but caching is cleaner without.
    const res = await fetch(photoUrl);
    if (!res.ok) return undefined;
    const blob = await res.blob();
    const reader = new FileReader();
    return await new Promise<string | undefined>((resolve) => {
      reader.onloadend = () => {
        const result = reader.result as string;
        // strip "data:image/jpeg;base64,"
        const i = result.indexOf(',');
        resolve(i >= 0 ? result.slice(i + 1) : result);
      };
      reader.onerror = () => resolve(undefined);
      reader.readAsDataURL(blob);
    });
  } catch {
    return undefined;
  }
}

export async function shareVCard(card: Card, profileUrl?: string): Promise<void> {
  await logStep('share-vcard.1.before-require-fs', {});
  const { File, Paths } = require('expo-file-system');
  await logStep('share-vcard.2.before-require-sharing', { hasFile: !!File, hasPaths: !!Paths });
  const Sharing = require('expo-sharing');
  await logStep('share-vcard.3.after-requires', { hasSharing: !!Sharing, hasShareAsync: !!Sharing?.shareAsync });
  // Try to embed photo so receiver's Contacts gets the image inline.
  let thumbnailBase64: string | undefined;
  if (card.photoUrl) {
    thumbnailBase64 = await fetchPhotoAsBase64(card.photoUrl);
  }
  const text = buildVCard(card, { profileUrl, photoUrl: card.photoUrl, thumbnailBase64 });
  const fileName = `${safe(card.name || 'vcard')}.vcf`;
  // Log the actual vCard text we're emitting. Receiver-side re-encoding
  // (WhatsApp, iOS Contacts re-share, etc.) can strip fields after this
  // point, but the bytes we WRITE are captured here.
  await logStep('share-vcard.4.before-new-file', {
    cachePath: Paths?.cache,
    fileName,
    hasThumb: !!thumbnailBase64,
    cardFields: {
      name: card.name, title: card.title, company: card.company,
      emailCount: card.emails?.length, phoneCount: card.phones?.length,
      hasPhotoUrl: !!card.photoUrl,
    },
    // Photo base64 trimmed; we just want the structural fields visible.
    rawVCard: thumbnailBase64
      ? text.replace(/PHOTO;ENCODING=b;TYPE=JPEG:[^\r\n]+/, 'PHOTO;ENCODING=b;TYPE=JPEG:<' + thumbnailBase64.length + '-bytes>')
      : text,
  });
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
