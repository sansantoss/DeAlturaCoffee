import type { MetadataRoute } from 'next';
import { listProducts } from '@/lib/catalog';
import { routing } from '@/i18n/routing';
import { siteUrl } from '@/lib/site';

/** /sitemap.xml para Google: cada página pública en los tres idiomas. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const products = await listProducts();
  const paths = ['', '/coffee', '/about', '/wholesale', ...(products.length > 1 ? products.map((p) => `/coffee/${p.slug}`) : [])];
  return paths.flatMap((path) =>
    routing.locales.map((l) => ({
      url: `${base}/${l}${path}`,
      changeFrequency: 'weekly' as const,
      priority: path === '' ? 1 : 0.7,
      alternates: { languages: Object.fromEntries(routing.locales.map((x) => [x, `${base}/${x}${path}`])) },
    })),
  );
}
