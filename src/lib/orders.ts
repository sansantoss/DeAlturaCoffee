import 'server-only';
import { repo } from './db';
import { priceCart } from './pricing';
import type { CartLine, Customer, Locale, Order } from './types';

export type CreateOrderResult =
  | { ok: true; order: Order }
  | { ok: false; error: 'auth' | 'address' | 'empty' | 'minimum' };

/**
 * The one place an order is created. Used by the website checkout (server action)
 * and by the mobile app (POST /api/v1/orders), so prices, minimums and taxes
 * are always computed the same way, on the server.
 */
export async function createOrder(
  customer: Customer | null,
  cart: CartLine[],
  opts: { payment: 'card' | 'invoice'; notes?: string; locale: Locale },
): Promise<CreateOrderResult> {
  if (!customer || customer.status !== 'approved') return { ok: false, error: 'auth' };
  const address = customer.addresses.find((a) => a.isDefault) ?? customer.addresses[0];
  if (!address) return { ok: false, error: 'address' };

  const method = opts.payment === 'invoice' && customer.invoiceTermsDays ? 'invoice' : 'card';
  const priced = await priceCart(cart, customer.priceTier, opts.locale, address.province);
  if (!priced.lines.length) return { ok: false, error: 'empty' };
  if (!priced.meetsMinimum) return { ok: false, error: 'minimum' };

  const now = new Date().toISOString();
  const { id: _addrId, isDefault: _d, ...shippingAddress } = address;
  const notes = (opts.notes ?? '').slice(0, 1000).trim();
  const order = await repo.orders.create({
    id: crypto.randomUUID(),
    customerId: customer.id,
    status: method === 'invoice' ? 'invoiced' : 'awaiting_payment',
    paymentMethod: method,
    lines: priced.lines,
    subtotalCents: priced.subtotalCents,
    shippingCents: priced.shippingCents,
    taxCents: priced.taxCents,
    totalCents: priced.totalCents,
    shippingAddress,
    notes: notes || undefined,
    createdAt: now,
    updatedAt: now,
  });
  return { ok: true, order };
}
