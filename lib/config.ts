// Centralized configuration. NEVER hardcode URLs in components — read them
// from here. The values come from app.json's `extra` block which Expo
// surfaces via expo-constants.
//
// Per the OpenOva conventions (feedback_never_hardcode_urls.md): this file
// is the single source of truth for API base, CDN base, web base, and any
// other external endpoint the app talks to.

import Constants from 'expo-constants';

type Extra = {
  apiBase: string;
  cdnBase: string;
  webBase: string;
};

const extra = (Constants.expoConfig?.extra ?? {}) as Partial<Extra>;

export const config = {
  apiBase: extra.apiBase ?? 'https://api.dynolabs.io',
  cdnBase: extra.cdnBase ?? 'https://cdn.dynolabs.io',
  webBase: extra.webBase ?? 'https://dynolabs.io',
} as const;

export type Config = typeof config;
