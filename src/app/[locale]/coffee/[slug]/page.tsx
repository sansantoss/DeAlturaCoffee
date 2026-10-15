import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { SiteHeader } from '@/components/SiteHeader';
import { Bag } from '@/components/art';
import { ProductSpec } from '@/components/ProductSpec';
import { AddToCart } from '@/components/AddToCart';
import { getCurrentCustomer } from '@/lib/auth';
import { getOrigin, getProductBySlug, getSettings } from '@/lib/catalog';
import { formatMoney } from '@/lib/format';
import type { Locale } from '@/lib/types';

type Params = { params: Promise<{ locale: Locale; slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale, slug } = await params;
  const p = await getProductBySlug(slug);
  return p ? { title: `${p.name[locale]} — ${p.tastingNotes[locale]}` } : {};
}

export default async function ProductPage({ params }: Params) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const product = await getProductBySlug(slug);
  if (!product) notFound();
  const [origin, customer, settings, t] = await Promise.all([
    getOrigin(product.originId),
    getCurrentCustomer(),
    getSettings(),
    getTranslations(),
  ]);
  if (!origin) notFound();

  const approved = customer?.status === 'approved';
  const tier = approved ? customer.priceTier : settings.publicPrices ? 'standard' : null;

  return (
    <>
      <SiteHeader current="/coffee" />
      <main id="content" className="inner" style={{ paddingTop: 'clamp(2rem, 5vw, 4rem)' }}>
        <p style={{ marginBottom: '1.5rem' }}>
          <Link href="/coffee" className="link">← {t('product.back')}</Link>
        </p>
        <div className="catalog">
          <div className="catalog__bag">
            <Bag label={t('showcase.bagAlt')} origin={origin.country[locale].toUpperCase()} title={origin.region} notes={product.tastingNotes[locale]} />
          </div>
          <div className="stack" data-reveal>
            <h1 className="h-section">{product.name[locale]}</h1>
            <p>{origin.story[locale]}</p>
            <ProductSpec product={product} origin={origin} locale={locale} />

            {approved ? (
              <AddToCart
                roasts={product.roasts}
                formats={product.formats.map((f) => ({
                  sku: f.sku,
                  label: f.label[locale],
                  unitPriceCents: f.price[customer.priceTier],
                }))}
              />
            ) : (
              <div className="stack">
                {tier && (
                  <ul className="lines">
                    {product.formats.map((f) => (
                      <li key={f.sku} className="line-item" style={{ gridTemplateColumns: '1fr auto' }}>
                        <span>{f.label[locale]}</span>
                        <span className="nums">{formatMoney(f.price[tier], locale)}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {customer ? (
                  <p className="notice">{t('product.pending')}</p>
                ) : (
                  <div style={{ display: 'flex', gap: '.75rem', flexWrap: 'wrap' }}>
                    <Link href={`/login?next=/coffee/${product.slug}`} className="btn">{t('product.signIn')}</Link>
                    <Link href="/wholesale" className="btn btn--ghost">{t('nav.apply')}</Link>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
