import 'server-only';
import { cookies } from 'next/headers';
import type { CartLine, RoastProfile } from './types';

/**
 * The cart lives in a small cookie (SKU, roast, quantity only; never prices), so the server can
 * render and price it on every page without a database round trip. Prices are always recomputed
 * on the server from the catalog.
 */
const COOKIE = 'da_cart';
const ROASTS: RoastProfile[] = ['espresso', 'filter', 'omni'];

export async function readCart(): Promise<CartLine[]> {
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (l): l is CartLine =>
          typeof l?.sku === 'string' && ROASTS.includes(l?.roast) && Number.isInteger(l?.quantity) && l.quantity > 0,
      )
      .slice(0, 50);
  } catch {
    return [];
  }
}

export async function writeCart(lines: CartLine[]) {
  const store = await cookies();
  const clean = lines.filter((l) => l.quantity > 0).map((l) => ({ ...l, quantity: Math.min(l.quantity, 999) }));
  if (!clean.length) {
    store.delete(COOKIE);
    return;
  }
  store.set(COOKIE, JSON.stringify(clean), {
    httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production',
    path: '/', maxAge: 60 * 60 * 24 * 30,
  });
}

export async function cartCount(): Promise<number> {
  return (await readCart()).reduce((s, l) => s + l.quantity, 0);
}
