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

/**
 * Builds the OFFLINE-mode vCard string emitted into the QR. Byte-identical
 * to the server's pass-signer buildVCardText() — both must produce the
 * SAME bytes for a given card so the in-app QR and the Wallet pass's
 * offline QR are interchangeable.
 *
 * No PHOTO line is emitted: iOS Camera will not fetch remote URIs from a
 * scanned QR (verified), and embedding base64 here would make the QR
 * unreadable. For photo-on-save, use the ONLINE-mode QR which contains
 * just the .vcf URL — the recipient's Safari loads it and iOS Contacts
 * imports the full vCard with the embedded high-res photo.
 */
export function buildVCard(card: Card, opts: VCardOptions = {}): string {
  const lines: string[] = [];
  lines.push('BEGIN:VCARD');
  lines.push('VERSION:3.0');
  const { last, first } = splitName(card.name);
  lines.push(`N:${escape(last)};${escape(first)};;;`);
  lines.push(`FN:${escape(card.name)}`);
  if (card.title) lines.push(`TITLE:${escape(card.title)}`);
  if (card.company) lines.push(`ORG:${escape(card.company)}`);
  for (const email of card.emails) lines.push(`EMAIL;TYPE=INTERNET:${escape(email)}`);
  for (const phone of card.phones) lines.push(`TEL;TYPE=CELL:${escape(phone)}`);
  for (const s of card.socials) lines.push(`URL;TYPE=${socialType(s)}:${escape(s.url)}`);
  if (opts.profileUrl) lines.push(`URL;TYPE=WORK:${escape(opts.profileUrl)}`);
  // Embedded thumbnails only used for SHARE-as-vCard (file transfer
  // path), never for the QR — see shareVCard() in lib/share.ts.
  if (opts.thumbnailBase64) {
    lines.push(`PHOTO;ENCODING=b;TYPE=JPEG:${opts.thumbnailBase64}`);
  }
  lines.push('END:VCARD');
  return lines.join('\r\n');
}

/**
 * Online-mode QR payload — just the .vcf URL. When the recipient scans,
 * iOS Camera offers to open in Safari; Safari fetches the URL and iOS
 * imports the vCard (with the embedded full-resolution photo). This is
 * the only way to deliver a high-res photo to a saved iOS contact via
 * QR — iOS Camera deliberately won't fetch PHOTO;VALUE=URI references
 * from scanned QR text, only via explicit user network actions.
 */
export function onlineVCardURL(slug: string, opts: { apiBase?: string } = {}): string {
  const base = opts.apiBase ?? 'https://api.dynolabs.io';
  return `${base}/v/${encodeURIComponent(slug)}.vcf`;
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
