// vCard 3.0 serializer. The recipient's default camera app reads this
// directly from the QR and offers "Add to Contacts".
//
// Design choice: PHOTO field uses `;VALUE=uri:` reference (not embedded
// base64) so the QR stays small and scannable on a phone screen. iOS
// Contacts and Google Contacts fetch the URL once at save time.
//
// Optionally we embed a tiny 32×32 base64 thumbnail too — recipient gets
// an offline placeholder photo even if their device is offline at scan
// time. The hi-res URL still wins when reachable.

import type { Card, Social } from './types';

export type VCardOptions = {
  /** Stable hi-res photo URL, e.g. https://cdn.dynolabs.io/p/<slug>.jpg */
  photoUrl?: string;
  /** Optional 32×32 base64 jpeg for offline thumbnail. */
  thumbnailBase64?: string;
};

export function buildVCard(card: Card, opts: VCardOptions = {}): string {
  const lines: string[] = [];
  lines.push('BEGIN:VCARD');
  lines.push('VERSION:3.0');
  lines.push(`FN:${escape(card.name)}`);
  if (card.title || card.company) {
    if (card.title) lines.push(`TITLE:${escape(card.title)}`);
    if (card.company) lines.push(`ORG:${escape(card.company)}`);
  }
  for (const email of card.emails) lines.push(`EMAIL;TYPE=INTERNET:${escape(email)}`);
  for (const phone of card.phones) lines.push(`TEL;TYPE=CELL:${escape(phone)}`);
  for (const s of card.socials) lines.push(`URL;TYPE=${socialType(s)}:${escape(s.url)}`);
  if (opts.thumbnailBase64) {
    // Base64 images are line-folded per RFC 6350 §3.2 (75-octet folding)
    // but iOS Contacts is lenient — single line works in practice.
    lines.push(`PHOTO;ENCODING=b;TYPE=JPEG:${opts.thumbnailBase64}`);
  }
  if (opts.photoUrl) {
    lines.push(`PHOTO;VALUE=uri:${escape(opts.photoUrl)}`);
  }
  lines.push(`REV:${new Date().toISOString()}`);
  lines.push('END:VCARD');
  return lines.join('\r\n');
}

function escape(v: string): string {
  return v.replace(/\\/g, '\\\\').replace(/,/g, '\\,').replace(/;/g, '\\;').replace(/\r?\n/g, '\\n');
}

function socialType(s: Social): string {
  return ({
    linkedin: 'LinkedIn',
    x: 'X',
    instagram: 'Instagram',
    github: 'GitHub',
    website: 'Website',
  })[s.kind];
}
