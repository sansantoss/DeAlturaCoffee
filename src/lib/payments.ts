import 'server-only';
import Stripe from 'stripe';
import type { Locale, Order } from './types';
import { siteUrl } from './site';

/**
 * Card payments with Stripe Checkout (hosted page: PCI handled by Stripe, Apple Pay / Google Pay included).
 * Invoice (net terms) orders skip this and are billed later; Stripe Invoicing can automate that next.
 */

let client: Stripe | null = null;
export function stripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  client ??= new Stripe(key);
  return client;
}

export const paymentsEnabled = () => Boolean(process.env.STRIPE_SECRET_KEY);

export async function createCheckoutSession(order: Order, email: string, locale: Locale) {
  const s = stripe();
  if (!s) return null;
  const site = siteUrl();

  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = order.lines.map((l) => ({
    quantity: l.quantity,
    price_data: {
      currency: 'cad',
      unit_amount: l.unitPriceCents,
      product_data: { name: `${l.productName} — ${l.formatLabel} (${l.roast})` },
    },
  }));
  if (order.shippingCents > 0) {
    lineItems.push({
      quantity: 1,
      price_data: { currency: 'cad', unit_amount: order.shippingCents, product_data: { name: 'Shipping' } },
    });
  }
  if (order.taxCents > 0) {
    lineItems.push({
      quantity: 1,
      price_data: { currency: 'cad', unit_amount: order.taxCents, product_data: { name: 'Tax' } },
    });
  }

  return s.checkout.sessions.create({
    mode: 'payment',
    customer_email: email,
    line_items: lineItems,
    locale: locale === 'es' ? 'es' : locale === 'fr' ? 'fr-CA' : 'en',
    client_reference_id: order.id,
    metadata: { orderId: order.id, orderNumber: order.number },
    success_url: `${site}/${locale}/account/orders/${order.id}?paid={CHECKOUT_SESSION_ID}`,
    cancel_url: `${site}/${locale}/cart?cancelled=1`,
  });
}
