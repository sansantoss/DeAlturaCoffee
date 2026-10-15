import { defineRouting } from 'next-intl/routing';

export const locales = ['en', 'fr', 'es'] as const;
export type Locale = (typeof locales)[number];

export const routing = defineRouting({
  locales,
  defaultLocale: 'en',
  // Every page lives under /en, /fr or /es so each language has its own URL for Google.
  localePrefix: 'always',
  // First visit: read the browser language (Accept-Language). Anything else falls back to English.
  // Once the visitor picks a language in the switcher it is stored in the NEXT_LOCALE cookie
  // and always wins over detection.
  localeDetection: true,
  localeCookie: { name: 'NEXT_LOCALE', maxAge: 60 * 60 * 24 * 365 },
});
