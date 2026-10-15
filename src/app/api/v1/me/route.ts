import { apiCustomer, json, unauthorized } from '@/lib/api';

/** GET /api/v1/me — the signed-in business account. */
export async function GET(req: Request) {
  const customer = await apiCustomer(req);
  return customer ? json(customer) : unauthorized();
}
