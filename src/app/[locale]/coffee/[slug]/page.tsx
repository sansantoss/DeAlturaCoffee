import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { SiteHeader } from '@/components/SiteHeader';
import { ProductDetail } from '@/components/ProductDetail';
import { getProductBySlug } from '@/lib/catalog';
import type { Locale } from '@/lib/types';

type Params = { params: Promise<{ locale: Locale; slug: string }>; searchParams: Promise<{ roast?: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale, slug } = await params;
  const p = await getProductBySlug(slug);
  return p ? { title: `${p.name[locale]} — ${p.tastingNotes[locale]}` } : {};
}

/** Enlace directo a un café (para cuando haya más de uno). Misma página que /coffee. */
export default async function ProductPage({ params, searchParams }: Params) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const product = await getProductBySlug(slug);
  if (!product) notFound();
  const { roast } = await searchParams;
  return (
    <>
      <SiteHeader current="/coffee" />
      <main id="content">
        <ProductDetail product={product} locale={locale} roast={roast} />
      </main>
    </>
  );
}
