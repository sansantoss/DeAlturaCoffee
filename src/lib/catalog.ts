import 'server-only';
import { cache } from 'react';
import productsJson from '@content/products.json';
import originsJson from '@content/origins.json';
import settingsJson from '@content/settings.json';
import farmsJson from '@content/farms.json';
import { repo } from './db';
import type { Farm, Origin, Product, ProductFormat, Settings } from './types';

/**
 * Catálogo. Fuente de verdad: la base de datos (lo que se edita en Admin › Catálogo).
 * content/*.json es el respaldo: lo que no está en la base (mismo id) se toma del JSON,
 * así la web funciona aunque falte la migración o la tabla esté vacía.
 */

const merge = <T extends { id: string }>(json: T[], db: T[]): T[] => {
  const byId = new Map(json.map((x) => [x.id, x]));
  for (const x of db) byId.set(x.id, x);
  return [...byId.values()];
};

/** Una sola lectura de la base por petición. */
const load = cache(async () => {
  const safe = async <T,>(fn: () => Promise<T[]>): Promise<T[]> => {
    try { return await fn(); } catch { return []; }
  };
  const [p, o, f, overrides] = await Promise.all([
    safe(() => repo.catalog.listProducts()),
    safe(() => repo.catalog.listOrigins()),
    safe(() => repo.catalog.listFarms()),
    safe(() => repo.prices.list()),
  ]);
  const products = merge(productsJson as Product[], p)
    .map((prod, i) => ({ ...prod, sort: prod.sort ?? i }))
    .sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0))
    .map((prod) => ({
      // Precios editados en Admin › Precios (tabla product_prices) por encima de los del café
      ...prod,
      formats: prod.formats.map((fm) => {
        const price = { ...fm.price };
        for (const ov of overrides) if (ov.sku === fm.sku) price[ov.tier] = ov.priceCents;
        return { ...fm, price };
      }),
    }));
  const farms = merge(farmsJson as Farm[], f)
    .filter((farm) => !farm.deleted)
    .map((farm, i) => ({ ...farm, sort: farm.sort ?? i }))
    .sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));
  return { products, origins: merge(originsJson as Origin[], o), farms };
});

/** Cafés a la venta (activos). */
export async function listProducts(): Promise<Product[]> {
  return (await load()).products.filter((p) => p.active);
}

/** Admin: todos, también los inactivos. */
export async function listAllProducts(): Promise<Product[]> {
  return (await load()).products;
}

export async function getProductBySlug(slug: string): Promise<Product | null> {
  return (await load()).products.find((x) => x.slug === slug && x.active) ?? null;
}

export async function getProductById(id: string): Promise<Product | null> {
  return (await load()).products.find((x) => x.id === id) ?? null;
}

export async function listOrigins(): Promise<Origin[]> {
  return (await load()).origins;
}

export async function getOrigin(id: string): Promise<Origin | null> {
  return (await load()).origins.find((o) => o.id === id) ?? null;
}

/** Fincas publicadas; con `productId`, solo las de ese café (y las que no tienen café asignado). */
export async function listFarms(productId?: string): Promise<Farm[]> {
  return (await load()).farms.filter((f) => f.published && (!productId || !f.productId || f.productId === productId));
}

/** Admin: todas las fincas. */
export async function listAllFarms(): Promise<Farm[]> {
  return (await load()).farms;
}

export async function getSettings(): Promise<Settings> {
  return settingsJson as Settings;
}

export async function findFormat(
  sku: string,
): Promise<{ product: Product; format: ProductFormat } | null> {
  for (const product of await listProducts()) {
    const format = product.formats.find((f) => f.sku === sku);
    if (format) return { product, format };
  }
  return null;
}

/** El café al que se asignan las compras viejas sin café elegido (el primero del catálogo). */
export async function defaultProductId(): Promise<string | undefined> {
  return (await listAllProducts())[0]?.id;
}
