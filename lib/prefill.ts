// Pull whatever we can from the device to seed a new card.
//
// What iOS lets us see (sandboxed third-party apps):
//   - Locale → country code → phone-number prefix (+1, +90, …)
//   - Device owner name (UIDevice.current.name) — usually
//     "<Owner>'s iPhone". Strip the "'s iPhone" suffix to get
//     a usable name suggestion.
//   - System language + region (informational, not used in cards)
//
// What iOS does NOT let us see (no public API):
//   - The user's phone number itself
//   - Their email address
//   - Anything from native Contacts unless we ask for permission
//     and they grant it (might be worth a v1.1 path)

import * as Device from 'expo-device';
import * as Localization from 'expo-localization';

export type Prefill = {
  /** Suggested name from device owner. May be empty. */
  name: string;
  /** "+90", "+1", … from locale region. May be empty. */
  phonePrefix: string;
  /** ISO region code, e.g. "TR", "US". May be empty. */
  region: string;
};

export function devicePrefill(): Prefill {
  return {
    name: deviceOwnerName(),
    phonePrefix: phonePrefix(),
    region: Localization.getLocales()[0]?.regionCode ?? '',
  };
}

function deviceOwnerName(): string {
  const raw = Device.deviceName ?? '';
  // Strip common suffixes Apple adds.
  return raw
    .replace(/’s iPhone$/i, '')   // ’s iPhone
    .replace(/'s iPhone$/i, '')
    .replace(/’s iPad$/i, '')
    .replace(/'s iPad$/i, '')
    .trim();
}

function phonePrefix(): string {
  const region = Localization.getLocales()[0]?.regionCode ?? '';
  return REGION_TO_DIAL[region.toUpperCase()] ?? '';
}

// Common country dial codes — not exhaustive, covers the realistic prefill
// audience for v1. Add more as needed.
const REGION_TO_DIAL: Record<string, string> = {
  US: '+1', CA: '+1',
  GB: '+44',
  TR: '+90',
  DE: '+49', FR: '+33', IT: '+39', ES: '+34', NL: '+31', BE: '+32',
  CH: '+41', AT: '+43', SE: '+46', NO: '+47', DK: '+45', FI: '+358',
  PL: '+48', CZ: '+420', PT: '+351', GR: '+30', IE: '+353',
  RU: '+7', UA: '+380',
  AE: '+971', SA: '+966', OM: '+968', QA: '+974', KW: '+965', BH: '+973', JO: '+962',
  EG: '+20', IL: '+972', LB: '+961', IR: '+98',
  IN: '+91', PK: '+92', BD: '+880', LK: '+94',
  CN: '+86', JP: '+81', KR: '+82', HK: '+852', TW: '+886', SG: '+65', MY: '+60', TH: '+66', VN: '+84', ID: '+62', PH: '+63',
  AU: '+61', NZ: '+64',
  BR: '+55', MX: '+52', AR: '+54', CL: '+56', CO: '+57', PE: '+51',
  ZA: '+27', NG: '+234', KE: '+254',
};
