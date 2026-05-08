// Save-to-Contacts handler. Parses a vCard 3.0 string into the structured
// Contact object expo-contacts wants, requests permission, and creates
// the contact in the device's native address book.

import * as Contacts from 'expo-contacts';

export type ParsedVCard = {
  name?: string;
  title?: string;
  company?: string;
  emails: string[];
  phones: string[];
  urls: string[];
  photoUrl?: string;
};

export function parseVCard(text: string): ParsedVCard {
  const out: ParsedVCard = { emails: [], phones: [], urls: [] };
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  for (const line of lines) {
    if (!line) continue;
    const colon = line.indexOf(':');
    if (colon < 0) continue;
    const head = line.slice(0, colon).toUpperCase();
    const rawValue = line.slice(colon + 1);
    const value = rawValue.replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\n/g, '\n');
    if (head.startsWith('FN'))            out.name = value;
    else if (head.startsWith('TITLE'))    out.title = value;
    else if (head.startsWith('ORG'))      out.company = value.split(';')[0];
    else if (head.startsWith('EMAIL'))    out.emails.push(value);
    else if (head.startsWith('TEL'))      out.phones.push(value);
    else if (head.startsWith('URL'))      out.urls.push(value);
    else if (head.startsWith('PHOTO'))    {
      // PHOTO;VALUE=uri:https://...  OR PHOTO;ENCODING=b... (skip embed)
      if (head.includes('VALUE=URI') || /^https?:/.test(value)) out.photoUrl = value;
    }
  }
  return out;
}

/** Returns true on success, false on permission denial. Throws on unexpected error. */
export async function saveToContacts(vcard: ParsedVCard): Promise<boolean> {
  const { status } = await Contacts.requestPermissionsAsync();
  if (status !== 'granted') return false;
  const [firstName, ...rest] = (vcard.name || '').split(' ');
  const lastName = rest.join(' ');
  const contact: Contacts.Contact = {
    contactType: Contacts.ContactTypes.Person,
    name: vcard.name || '',
    firstName: firstName || vcard.name || '',
    lastName: lastName || undefined,
    jobTitle: vcard.title,
    company: vcard.company,
    emails: vcard.emails.map((email, i) => ({
      label: i === 0 ? 'work' : 'other',
      email,
      id: undefined as unknown as string,
    })) as Contacts.Email[],
    phoneNumbers: vcard.phones.map((number, i) => ({
      label: i === 0 ? 'mobile' : 'other',
      number,
      id: undefined as unknown as string,
    })) as Contacts.PhoneNumber[],
    urlAddresses: vcard.urls.map((url, i) => ({
      label: i === 0 ? 'work' : 'other',
      url,
      id: undefined as unknown as string,
    })) as Contacts.UrlAddress[],
  };
  await Contacts.addContactAsync(contact);
  return true;
}
