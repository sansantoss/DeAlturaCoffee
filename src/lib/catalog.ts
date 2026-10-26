import 'server-only';
import productsJson from '@content/products.json';
import originsJson from '@content/origins.json';
import settingsJson from '@content/settings.json';
import farmsJson from '@content/farms.json';
import { repo } from './db';
import type { Farm, Origin, Product, ProductFormat, Settings } from './types';

/**
 * Catalog repository. Today it reads the JSON files in /content.
 * To move the catalog into Postgres, re-implement these functions with Supabase queries;
 * every caller already awaits them, so nothing else changes.
 */

const products = productsJson as Product[];
const origins = originsJson as Origin[];
const settings = settingsJson as Settings;

/** Aplica los precios editados en el admin (tabla product_prices) sobre los del JSON. */
async function withPrices(list: Product[]): Promise<Product[]> {
  let overrides: Awaited<ReturnType<typeof repo.prices.list>> = [];
  try {
    overrides = await repo.prices.list();
  } catch {
    overrides = []; // si la tabla aún no existe, se usan los precios del JSON
  }
  if (!overrides.length) return list;
  return list.map((p) => ({
    ...p,
    formats: p.formats.map((f) => {
      const price = { ...f.price };
      for (const o of overrides) if (o.sku === f.sku) price[o.tier] = o.priceCents;
      return { ...f, price };
    }),
  }));
}

export async function listProducts(): Promise<Product[]> {
  return withPrices(products.filter((p) => p.active));
}

export async function getProductBySlug(slug: string): Promise<Product | null> {
  const p = products.find((x) => x.slug === slug && x.active);
  return p ? (await withPrices([p]))[0] : null;
}

export async function listOrigins(): Promise<Origin[]> {
  return origins;
}

export async function getOrigin(id: string): Promise<Origin | null> {
  return origins.find((o) => o.id === id) ?? null;
}

export async function getSettings(): Promise<Settings> {
  return settings;
}

export async function findFormat(
  sku: string,
): Promise<{ product: Product; format: ProductFormat } | null> {
  for (const product of await listProducts()) {
    const format = product.formats.find((f) => f.sku === sku);
    if (format && product.active) return { product, format };
  }
  return null;
}

/** Fincas publicadas (content/farms.json, published: true). */
export async function listFarms(): Promise<Farm[]> {
  return (farmsJson as Farm[]).filter((f) => f.published);
}
