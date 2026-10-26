import type { Locale } from './types';

const TAG: Record<Locale, string> = { en: 'en-CA', fr: 'fr-CA', es: 'es-US' };

export function formatMoney(cents: number, locale: Locale): string {
  return new Intl.NumberFormat(TAG[locale], { style: 'currency', currency: 'CAD' }).format(cents / 100);
}

export function formatKg(kg: number, locale: Locale): string {
  return `${new Intl.NumberFormat(TAG[locale], { maximumFractionDigits: 2 }).format(kg)} kg`;
}

export function formatDate(iso: string, locale: Locale): string {
  // Una fecha sola (YYYY-MM-DD) se toma a mediodía UTC para que no cambie de día por la zona horaria
  const d = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(`${iso}T12:00:00Z`) : new Date(iso);
  return new Intl.DateTimeFormat(TAG[locale], { dateStyle: 'medium', timeZone: /^\d{4}-\d{2}-\d{2}$/.test(iso) ? 'UTC' : 'America/Toronto' }).format(d);
}

export function formatNumber(n: number, locale: Locale): string {
  return new Intl.NumberFormat(TAG[locale]).format(n);
}
