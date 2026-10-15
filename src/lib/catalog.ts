import 'server-only';
import productsJson from '@content/products.json';
import originsJson from '@content/origins.json';
import settingsJson from '@content/settings.json';
import type { Origin, Product, ProductFormat, Settings } from './types';

/**
 * Catalog repository. Today it reads the JSON files in /content.
 * To move the catalog into Postgres, re-implement these functions with Supabase queries;
 * every caller already awaits them, so nothing else changes.
 */

const products = productsJson as Product[];
const origins = originsJson as Origin[];
const settings = settingsJson as Settings;

export async function listProducts(): Promise<Product[]> {
  return products.filter((p) => p.active);
}

export async function getProductBySlug(slug: string): Promise<Product | null> {
  return products.find((p) => p.slug === slug && p.active) ?? null;
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
  for (const product of products) {
    const format = product.formats.find((f) => f.sku === sku);
    if (format && product.active) return { product, format };
  }
  return null;
}
