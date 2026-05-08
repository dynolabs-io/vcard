// Domain types for the vCard app. The shape mirrors the backend's
// `vcard-api` Card resource so we can ship the same JSON over the wire
// once Phase 6 lands DB-backed CRUD.

export type CardTemplate = 'mono' | 'gradient' | 'glass' | 'custom';

export type Social = {
  kind: 'linkedin' | 'x' | 'instagram' | 'github' | 'website';
  url: string;
};

export type Card = {
  id: string;            // local UUID
  slug?: string;         // server-issued public slug for dynolabs.io/c/<slug>
  label: string;         // e.g. "Work", "Personal"
  name: string;
  title?: string;
  company?: string;
  emails: string[];
  phones: string[];
  socials: Social[];
  photoUri?: string;     // local file:// or https://cdn.dynolabs.io/p/...
  template: CardTemplate;
  customColor?: string;  // hex, only when template === 'custom'
  createdAt: number;     // ms epoch
  updatedAt: number;
};

export const emptyCard = (): Card => ({
  id: cryptoRandomId(),
  label: 'Work',
  name: '',
  emails: [],
  phones: [],
  socials: [],
  template: 'mono',
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
