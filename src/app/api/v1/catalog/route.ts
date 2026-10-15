import { apiCustomer, json } from '@/lib/api';
import { getSettings, listOrigins, listProducts } from '@/lib/catalog';

/** GET /api/v1/catalog — origins and products. Prices only for approved accounts (or if public). */
export async function GET(req: Request) {
  const [customer, products, origins, settings] = await Promise.all([
    apiCustomer(req), listProducts(), listOrigins(), getSettings(),
  ]);
  const tier = customer?.status === 'approved' ? customer.priceTier : settings.publicPrices ? 'standard' : null;
  return json({
    currency: settings.currency,
    minimumOrderKg: settings.minimumOrderKg,
    origins: origins.filter((o) => o.active),
    products: products.map((p) => ({
      ...p,
      formats: p.formats.map(({ price, ...f }) => ({ ...f, priceCents: tier ? price[tier] : null })),
    })),
  });
}
