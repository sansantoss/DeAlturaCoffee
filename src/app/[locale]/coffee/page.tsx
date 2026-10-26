import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { SiteHeader } from '@/components/SiteHeader';
import { ProductDetail } from '@/components/ProductDetail';
import { listProducts } from '@/lib/catalog';
import type { Locale } from '@/lib/types';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const t = await getTranslations({ locale: (await params).locale, namespace: 'coffee' });
  return { title: t('title'), description: t('lead') };
}

/** Hoy hay un solo café (Venezuela, tres tostados): la pestaña "Nuestro café" es directamente su página. */
export default async function CoffeePage({
  params, searchParams,
}: { params: Promise<{ locale: Locale }>; searchParams: Promise<{ roast?: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { roast } = await searchParams;
  const [product] = await listProducts();
  if (!product) notFound();

  return (
    <>
      <SiteHeader current="/coffee" />
      <main id="content">
        <ProductDetail product={product} locale={locale} roast={roast} />
      </main>
    </>
  );
}
