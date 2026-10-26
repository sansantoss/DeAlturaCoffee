'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { getAdmin } from '@/lib/admin';
import { repo } from '@/lib/db';
import { describeError, type ActionResult } from '@/lib/action-error';
import { getOrigin, getProductById, listAllFarms, listAllProducts } from '@/lib/catalog';
import { uploadImage } from '@/lib/storage';
import type { Farm, Origin, Product } from '@/lib/types';

/* Admin › Catálogo: cafés, su origen, fincas y fotos. Todo se valida aquí antes de guardar. */

async function guard() {
  if (!(await getAdmin())) throw new Error('Forbidden');
}
const refresh = () => revalidatePath('/', 'layout'); // el catálogo se ve en todo el sitio

const text = z.string().trim().max(2000);
const loc = z.object({ es: text, en: text, fr: text });
const locReq = z.object({ es: z.string().trim().min(1).max(200), en: text, fr: text });
const roast = z.enum(['light', 'medium', 'dark']);
const cents = z.number().int().min(0).max(10_000_000);

const productSchema = z.object({
  id: z.string().regex(/^[a-z0-9_-]{3,60}$/),
  slug: z.string().regex(/^[a-z0-9-]{3,80}$/),
  originId: z.string().min(1),
  name: locReq,
  variety: z.string().trim().max(120),
  process: loc,
  tastingNotes: loc,
  score: z.number().min(0).max(100).optional(),
  roasts: z.array(roast).min(1),
  roastInfo: z.record(z.string(), z.object({ notes: loc, use: loc })).optional(),
  farm: z.string().trim().max(120).optional(),
  producer: z.string().trim().max(120).optional(),
  harvest: z.string().trim().max(40).optional(),
  lab: z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    lab: z.string().trim().max(160),
    lot: z.string().trim().max(40),
    harvest: z.string().trim().max(40),
    moisturePct: z.number().min(0).max(100),
    densityGL: z.number().min(0).max(2000),
    screen: z.string().trim().max(20),
    screenAbove16Pct: z.number().min(0).max(100),
    primaryDefects: z.number().int().min(0).max(999),
    cupping: z.array(z.object({ key: z.string().min(1).max(30), score: z.number().min(0).max(10) })).max(15),
    descriptors: loc,
  }).optional(),
  images: z.array(z.string().max(1000)).max(20).optional(),
  roastImages: z.record(z.string(), z.string().max(1000)).optional(),
  sort: z.number().int().min(0).max(999).optional(),
  formats: z.array(z.object({
    sku: z.string().regex(/^[A-Z0-9-]{3,40}$/),
    label: locReq,
    grams: z.number().int().min(1).max(100000),
    unitsPerCase: z.number().int().min(1).max(500),
    price: z.object({ standard: cents, partner: cents }),
  })).min(1),
  taxCategory: z.enum(['zero-rated-grocery', 'standard']),
  active: z.boolean(),
});

const originSchema = z.object({
  id: z.string().min(1),
  country: locReq,
  region: z.string().trim().max(160),
  altitude: z.object({ min: z.number().int().min(0).max(6000), max: z.number().int().min(0).max(6000) }),
  story: loc,
  active: z.boolean(),
});

export type CatalogState = ActionResult & { ok?: boolean; fields?: string[] };

/** Guarda el café y su origen (el editor manda todo como JSON). */
export async function adminSaveProduct(_: CatalogState, form: FormData): Promise<CatalogState> {
  await guard();
  try {
    const raw = JSON.parse(String(form.get('payload') ?? '{}'));
    const parsed = productSchema.safeParse(raw.product);
    const parsedOrigin = originSchema.safeParse(raw.origin);
    if (!parsed.success || !parsedOrigin.success) {
      const issues = [...(parsed.error?.issues ?? []), ...(parsedOrigin.error?.issues ?? [])];
      return { error: 'invalid', fields: issues.map((i) => i.path.join('.')), detail: issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('\n') };
    }
    const product = parsed.data as Product;
    // El slug y los SKU no se pueden repetir entre cafés
    const others = (await listAllProducts()).filter((p) => p.id !== product.id);
    if (others.some((p) => p.slug === product.slug)) return { error: 'invalid', fields: ['slug'], detail: 'slug duplicado' };
    const skus = new Set(others.flatMap((p) => p.formats.map((f) => f.sku)));
    const dup = product.formats.find((f) => skus.has(f.sku));
    if (dup) return { error: 'invalid', fields: ['formats'], detail: `SKU repetido: ${dup.sku}` };
    if (new Set(product.formats.map((f) => f.sku)).size !== product.formats.length) return { error: 'invalid', fields: ['formats'], detail: 'SKU repetido en este café' };

    await repo.catalog.saveOrigin({ ...(parsedOrigin.data as Origin) });
    await repo.catalog.saveProduct(product);
    // Los precios se guardan también donde los lee Admin › Precios, para que no haya dos versiones
    for (const f of product.formats) {
      await repo.prices.set(f.sku, 'standard', f.price.standard);
      await repo.prices.set(f.sku, 'partner', f.price.partner);
    }
    refresh();
    return { ok: true };
  } catch (e) {
    return describeError(e);
  }
}

/** Crea un café nuevo (inactivo) a partir de una plantilla y regresa su id para abrir el editor. */
export async function adminCreateProduct(): Promise<{ id?: string } & ActionResult> {
  await guard();
  try {
    const all = await listAllProducts();
    let n = all.length + 1;
    while (all.some((p) => p.id === `prd_nuevo_${n}`)) n += 1;
    const id = `prd_nuevo_${n}`;
    const origin: Origin = {
      id: `org_nuevo_${n}`, country: { es: 'País', en: 'Country', fr: 'Pays' }, region: '', altitude: { min: 0, max: 0 },
      story: { es: '', en: '', fr: '' }, active: true,
    };
    const sku = `NEW${n}-1KG`;
    const product: Product = {
      id, slug: `cafe-nuevo-${n}`, originId: origin.id, active: false, sort: all.length,
      name: { es: `Café nuevo ${n}`, en: `New coffee ${n}`, fr: `Nouveau café ${n}` },
      variety: '', process: { es: 'Lavado', en: 'Washed', fr: 'Lavé' }, tastingNotes: { es: '', en: '', fr: '' },
      roasts: ['light', 'medium', 'dark'], roastInfo: {},
      formats: [{ sku, label: { es: 'Bolsa de 1 kg', en: '1 kg bag', fr: 'Sac de 1 kg' }, grams: 1000, unitsPerCase: 1, price: { standard: 3400, partner: 3100 } }],
      taxCategory: 'zero-rated-grocery', images: [], roastImages: {},
    };
    await repo.catalog.saveOrigin(origin);
    await repo.catalog.saveProduct(product);
    refresh();
    return { id };
  } catch (e) {
    return describeError(e);
  }
}

/** Sube una foto (ya achicada en el navegador) y regresa su URL. */
export async function adminUploadPhoto(form: FormData): Promise<{ url?: string } & ActionResult> {
  await guard();
  try {
    const file = form.get('file');
    if (!(file instanceof File) || !file.size) return { error: 'invalid', detail: 'Sin archivo' };
    const folder = String(form.get('folder') ?? 'misc');
    return { url: await uploadImage(file, folder) };
  } catch (e) {
    return describeError(e);
  }
}

/* ---------- Fincas ---------- */

const farmSchema = z.object({
  id: z.string().regex(/^[a-z0-9_-]{2,60}$/),
  published: z.boolean(),
  name: z.string().trim().min(1).max(120),
  producer: z.string().trim().max(120),
  town: z.string().trim().max(120),
  state: z.string().trim().max(120),
  altitude: z.number().int().min(0).max(6000),
  variety: z.string().trim().max(120),
  image: z.string().max(1000),
  text: loc,
  productId: z.string().max(60).optional(),
  sort: z.number().int().min(0).max(999).optional(),
});

export async function adminSaveFarm(_: CatalogState, form: FormData): Promise<CatalogState> {
  await guard();
  try {
    const parsed = farmSchema.safeParse(JSON.parse(String(form.get('payload') ?? '{}')));
    if (!parsed.success) {
      return { error: 'invalid', fields: parsed.error.issues.map((i) => i.path.join('.')), detail: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('\n') };
    }
    const farm = { ...parsed.data, productId: parsed.data.productId || undefined } as Farm;
    await repo.catalog.saveFarm(farm);
    refresh();
    return { ok: true };
  } catch (e) {
    return describeError(e);
  }
}

export async function adminCreateFarm(productId?: string): Promise<{ id?: string } & ActionResult> {
  await guard();
  try {
    const all = await listAllFarms();
    let n = all.length + 1;
    while (all.some((f) => f.id === `finca-nueva-${n}`)) n += 1;
    const id = `finca-nueva-${n}`;
    const product = productId ? await getProductById(productId) : null;
    const origin = product ? await getOrigin(product.originId) : null;
    await repo.catalog.saveFarm({
      id, published: false, name: `Finca nueva ${n}`, producer: '', town: '', state: origin?.region.split(',').pop()?.trim() ?? '',
      altitude: origin?.altitude.min ?? 0, variety: product?.variety ?? '', image: '', text: { es: '', en: '', fr: '' },
      productId: productId || undefined, sort: all.length,
    });
    refresh();
    return { id };
  } catch (e) {
    return describeError(e);
  }
}

export async function adminRemoveFarm(form: FormData): Promise<ActionResult> {
  await guard();
  try {
    // Se marca como borrada (no se elimina): así no "revive" si también está en content/farms.json
    const farm = (await listAllFarms()).find((f) => f.id === String(form.get('id') ?? ''));
    if (farm) await repo.catalog.saveFarm({ ...farm, published: false, deleted: true });
    refresh();
    return {};
  } catch (e) {
    return describeError(e);
  }
}
