import type { Locale } from './types';

const TAG: Record<Locale, string> = { en: 'en-CA', fr: 'fr-CA', es: 'es-US' };

export function formatMoney(cents: number, locale: Locale): string {
  return new Intl.NumberFormat(TAG[locale], { style: 'currency', currency: 'CAD' }).format(cents / 100);
}

export function formatKg(kg: number, locale: Locale): string {
  return `${new Intl.NumberFormat(TAG[locale], { maximumFractionDigits: 2 }).format(kg)} kg`;
}

export function formatDate(iso: string, locale: Locale): string {
  return new Intl.DateTimeFormat(TAG[locale], { dateStyle: 'medium' }).format(new Date(iso));
}

export function formatNumber(n: number, locale: Locale): string {
  return new Intl.NumberFormat(TAG[locale]).format(n);
}
