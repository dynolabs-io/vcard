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
  /** Public profile URL added as a URL field, e.g. https://dynolabs.io/c/<slug> */
  profileUrl?: string;
};

export function buildVCard(card: Card, opts: VCardOptions = {}): string {
  const lines: string[] = [];
  lines.push('BEGIN:VCARD');
  lines.push('VERSION:3.0');
  // N: structured name. iOS Camera uses N for the saved contact's
  // display name. Without it iOS falls back to ORG (company) — that
  // bug previously made the saved contact show as "Dynolabs" instead
  // of the person's name.
  const { last, first } = splitName(card.name);
  lines.push(`N:${escape(last)};${escape(first)};;;`);
  lines.push(`FN:${escape(card.name)}`);
  if (card.title) lines.push(`TITLE:${escape(card.title)}`);
  if (card.company) lines.push(`ORG:${escape(card.company)}`);
  for (const email of card.emails) lines.push(`EMAIL;TYPE=INTERNET:${escape(email)}`);
  for (const phone of card.phones) lines.push(`TEL;TYPE=CELL:${escape(phone)}`);
  for (const s of card.socials) lines.push(`URL;TYPE=${socialType(s)}:${escape(s.url)}`);
  // Profile URL: TYPE=WORK so iOS labels it "work" instead of "homepage".
  if (opts.profileUrl) lines.push(`URL;TYPE=WORK:${escape(opts.profileUrl)}`);
  if (opts.thumbnailBase64) {
    // Embedded base64 JPEG: iOS Camera ONLY saves embedded photos from
    // a scanned QR — remote PHOTO;VALUE=uri references are ignored.
    lines.push(`PHOTO;ENCODING=b;TYPE=JPEG:${opts.thumbnailBase64}`);
  }
  // photoUrl is kept as a hint but won't appear in the saved contact.
  // Drop it from the QR payload so we don't waste scannable bandwidth.
  lines.push(`REV:${new Date().toISOString()}`);
  lines.push('END:VCARD');
  return lines.join('\r\n');
}

function splitName(full: string): { last: string; first: string } {
  const s = (full || '').trim();
  if (!s) return { last: '', first: '' };
  const idx = s.lastIndexOf(' ');
  if (idx <= 0) return { last: '', first: s };
  return { last: s.slice(idx + 1), first: s.slice(0, idx).trim() };
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
