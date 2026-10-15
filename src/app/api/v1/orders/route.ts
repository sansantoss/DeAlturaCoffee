import { z } from 'zod';
import { apiCustomer, json, unauthorized } from '@/lib/api';
import { repo } from '@/lib/db';
import { createOrder } from '@/lib/orders';

/** GET /api/v1/orders — this account's orders, newest first. */
export async function GET(req: Request) {
  const customer = await apiCustomer(req);
  if (!customer) return unauthorized();
  return json(await repo.orders.listByCustomer(customer.id));
}

const body = z.object({
  lines: z.array(z.object({
    sku: z.string(),
    roast: z.enum(['espresso', 'filter', 'omni']),
    quantity: z.number().int().min(1).max(500),
  })).min(1),
  payment: z.enum(['card', 'invoice']).default('card'),
  notes: z.string().max(1000).optional(),
  locale: z.enum(['en', 'fr', 'es']).default('en'),
});

/**
 * POST /api/v1/orders — place an order from the app. Same rules as the website
 * (server-side prices, minimum kg, default address). Card orders come back
 * `awaiting_payment`; the app then opens Stripe (PaymentSheet) for that order.
 */
export async function POST(req: Request) {
  const customer = await apiCustomer(req);
  if (!customer) return unauthorized();
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: 'invalid', issues: parsed.error.issues }, 400);
  const { lines, ...opts } = parsed.data;
  const result = await createOrder(customer, lines, opts);
  return result.ok ? json(result.order, 201) : json({ error: result.error }, 422);
}
