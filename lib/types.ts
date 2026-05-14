// Domain types for the vCard app. The shape mirrors the backend's
// `vcard-api` Card resource so we can ship the same JSON over the wire
// once Phase 6 lands DB-backed CRUD.

export type CardTemplate = 'mono' | 'gradient' | 'glass' | 'custom';

// Apple Wallet pass layout. Maps to Apple's pass style + assets:
//   compact     → eventTicket, small ~25% center barcode (default, like Starbucks)
//   bigqr       → eventTicket + strip.png-as-QR, ~50% of pass is the QR
//   photoBack   → eventTicket + background.png = user photo, small QR overlay
//   minimal     → generic style, just QR + name, no fields
export type WalletStyle = 'compact' | 'bigqr' | 'photoBack' | 'minimal';

export type Social = {
  kind: 'linkedin' | 'x' | 'instagram' | 'github' | 'website';
  url: string;
};

// Card shape mirrors the server (see services/vcard-api/cards/types.go).
// Fields use server-side names so we can JSON.stringify directly to the
// wire and JSON.parse responses straight back without a mapper.
export type Card = {
  id: string;            // server UUID once persisted; local UUID before first sync
  slug?: string;         // server-issued public slug for dynolabs.io/c/<slug>
  label: string;         // e.g. "Work", "Personal"
  name: string;
  title?: string;
  company?: string;
  emails: string[];
  phones: string[];
  socials: Social[];
  photoUrl?: string;     // hi-res URL on cdn.dynolabs.io (set after upload)
  template: CardTemplate;
  customColor?: string;  // hex, only when template === 'custom'
  walletStyle?: WalletStyle;  // default 'compact' if omitted
  deviceId?: string;     // bound at create time
  createdAt: string | number;  // server returns ISO string; local stores epoch ms
  updatedAt: string | number;
};

export const emptyCard = (): Card => ({
  id: cryptoRandomId(),
  label: 'Work',
  name: '',
  emails: [],
  phones: [],
  socials: [],
  template: 'mono',
  walletStyle: 'bigqr',
  createdAt: Date.now(),
  updatedAt: Date.now(),
});

function cryptoRandomId(): string {
  // RN runtime exposes crypto.getRandomValues. Fall back to Math.random
  // ONLY in unit-test contexts that lack a crypto polyfill.
  const a = new Uint8Array(16);
  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    globalThis.crypto.getRandomValues(a);
  } else {
    for (let i = 0; i < a.length; i++) a[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(a, b => b.toString(16).padStart(2, '0')).join('');
}
