// Device prefill — defensive lazy-load. expo-device + expo-localization
// have shown JSI bridge issues on iOS 26 / new arch — never let them
// crash the form on mount. Returns empty Prefill on any failure.

export type Prefill = {
  name: string;
  phonePrefix: string;
  region: string;
};

export function devicePrefill(): Prefill {
  // Defensively wrap EVERY native call. ExpoDevice + ExpoLocalization
  // can throw "Cannot find native module" if autolinking fails — caught
  // independently so locale prefill still works even if device-name doesn't.
  let name = '';
  let region = '';
  try {
    const Localization = require('expo-localization');
    region = (Localization.getLocales?.()?.[0]?.regionCode ?? '').toUpperCase();
  } catch { /* no localization */ }
  try {
    const Device = require('expo-device');
    const raw = Device.deviceName ?? '';
    name = String(raw)
      .replace(/’s iPhone$/i, '')
      .replace(/'s iPhone$/i, '')
      .replace(/’s iPad$/i, '')
      .replace(/'s iPad$/i, '')
      .trim();
  } catch { /* no device-name */ }
  return { name, phonePrefix: REGION_TO_DIAL[region] ?? '', region };
}

const REGION_TO_DIAL: Record<string, string> = {
  US: '+1', CA: '+1', GB: '+44', TR: '+90',
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
