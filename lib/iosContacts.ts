// iOS Contacts sync — on-device only.
//
// We scan the user's local Contacts looking for entries whose URL
// field matches `dynolabs.io/c/<slug>`. Those are Dynolabs cards
// the user saved at some point (via iPhone Camera, our app, or
// vCard share). We then check the slug against our current server
// state — if any fields changed, prompt the user to sync.
//
// Privacy: NEVER send the user's contact list to our server. All
// matching + comparison happens locally on the device.

import * as Contacts from 'expo-contacts';
import { config } from './config';

const SLUG_RE = new RegExp(
  `^https?://${config.webBase.replace(/^https?:\/\//, '').replace(/\./g, '\\.')}/c/([a-z2-9-]+)$`,
);

export type MatchedContact = {
  contactId: string;
  name: string;
  slug: string;
  /** Snapshot of the iOS Contact's current data so we can compare. */
  phone?: string;
  email?: string;
  title?: string;
  company?: string;
};

export async function requestContactsPermission(): Promise<boolean> {
  try {
    const { status } = await Contacts.requestPermissionsAsync();
    return status === 'granted';
  } catch {
    return false;
  }
}

export async function getContactsPermissionStatus(): Promise<'granted' | 'denied' | 'undetermined'> {
  try {
    const { status } = await Contacts.getPermissionsAsync();
    return status as 'granted' | 'denied' | 'undetermined';
  } catch {
    return 'undetermined';
  }
}

/** Scan iOS Contacts for Dynolabs cards (matched by URL field).
 *  Returns one match per (contactId × slug) pair so duplicates are
 *  visible to the user during sync review. */
export async function findDynolabsContacts(): Promise<MatchedContact[]> {
  const granted = await getContactsPermissionStatus();
  if (granted !== 'granted') return [];
  const { data } = await Contacts.getContactsAsync({
    fields: [
      Contacts.Fields.Name,
      Contacts.Fields.UrlAddresses,
      Contacts.Fields.PhoneNumbers,
      Contacts.Fields.Emails,
      Contacts.Fields.JobTitle,
      Contacts.Fields.Company,
    ],
    pageSize: 0, // all
  });
  const out: MatchedContact[] = [];
  for (const c of data) {
    if (!c.urlAddresses?.length) continue;
    for (const u of c.urlAddresses) {
      const m = (u.url || '').match(SLUG_RE);
      if (!m) continue;
      out.push({
        contactId: c.id || '',
        name: c.name || (c.firstName || '') + ' ' + (c.lastName || ''),
        slug: m[1],
        phone: c.phoneNumbers?.[0]?.number,
        email: c.emails?.[0]?.email,
        title: (c as { jobTitle?: string }).jobTitle,
        company: (c as { company?: string }).company,
      });
    }
  }
  return out;
}

/** Apply server-current card fields onto an iOS Contact. Returns true
 *  if a write actually occurred (caller can show a small confirmation). */
export async function updateContactFromCard(
  contactId: string,
  card: {
    name: string;
    title?: string;
    company?: string;
    phones?: string[];
    emails?: string[];
    photoUrl?: string;
  },
): Promise<boolean> {
  try {
    const existing = await Contacts.getContactByIdAsync(contactId, [
      Contacts.Fields.Name,
      Contacts.Fields.PhoneNumbers,
      Contacts.Fields.Emails,
      Contacts.Fields.JobTitle,
      Contacts.Fields.Company,
    ]);
    if (!existing) return false;
    const patch = {
      ...existing,
      id: contactId,
      phoneNumbers: (card.phones || []).map(n => ({ number: n, label: 'mobile' })),
      emails: (card.emails || []).map(e => ({ email: e, label: 'work' })),
      jobTitle: card.title,
      company: card.company,
    } as Contacts.Contact & { id: string };
    await Contacts.updateContactAsync(patch);
    return true;
  } catch {
    return false;
  }
}

/** Create a NEW iOS Contact from a card. Returns the new contact id
 *  if successful, null otherwise. Caller decides whether to do this
 *  (e.g. after scanning a new card with "Save to iPhone Contacts" on). */
export async function createContactFromCard(card: {
  name: string;
  title?: string;
  company?: string;
  phones?: string[];
  emails?: string[];
  slug?: string;
  photoUrl?: string;
}): Promise<string | null> {
  try {
    const first = card.name.split(' ').slice(0, -1).join(' ') || card.name;
    const last = card.name.split(' ').slice(-1).join(' ');
    const contact: Contacts.Contact = {
      name: card.name,
      firstName: first,
      lastName: last,
      contactType: Contacts.ContactTypes.Person,
      jobTitle: card.title,
      company: card.company,
      phoneNumbers: (card.phones || []).map(n => ({ number: n, label: 'mobile' })),
      emails: (card.emails || []).map(e => ({ email: e, label: 'work' })),
      urlAddresses: card.slug
        ? [{ url: `${config.webBase}/c/${card.slug}`, label: 'profile' }]
        : [],
    };
    const id = await Contacts.addContactAsync(contact);
    return id;
  } catch {
    return null;
  }
}
