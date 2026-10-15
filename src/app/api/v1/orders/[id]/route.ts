import { apiCustomer, json, unauthorized } from '@/lib/api';
import { repo } from '@/lib/db';

/** GET /api/v1/orders/:id — one order, only if it belongs to the caller. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const customer = await apiCustomer(req);
  if (!customer) return unauthorized();
  const order = await repo.orders.getById((await params).id);
  if (!order || order.customerId !== customer.id) return json({ error: 'not_found' }, 404);
  return json(order);
}
