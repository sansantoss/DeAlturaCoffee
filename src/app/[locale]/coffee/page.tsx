import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { SiteHeader } from '@/components/SiteHeader';
import { ProductDetail } from '@/components/ProductDetail';
import { Photo } from '@/components/Photo';
import { getCurrentCustomer } from '@/lib/auth';
import { getOrigin, getSettings, listProducts } from '@/lib/catalog';
import { productPhotos } from '@/lib/images';
import { formatMoney } from '@/lib/format';
import type { Locale } from '@/lib/types';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const t = await getTranslations({ locale: (await params).locale, namespace: 'coffee' });
  return { title: t('title'), description: t('lead') };
}

/**
 * "Nuestro café". Según cuántos cafés estén activos en Admin › Catálogo:
 *  - 1: directamente su página (grano, historia y pedido).
 *  - 2 o más: una lista para elegir, cada uno con su página.
 *  - 0: aviso de "próximamente" (nunca un error).
 */
export default async function CoffeePage({
  params, searchParams,
}: { params: Promise<{ locale: Locale }>; searchParams: Promise<{ roast?: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { roast } = await searchParams;
  const [products, t, customer, settings] = await Promise.all([listProducts(), getTranslations(), getCurrentCustomer(), getSettings()]);

  if (products.length === 1) {
    return (
      <>
        <SiteHeader current="/coffee" />
        <main id="content">
          <ProductDetail product={products[0]} locale={locale} roast={roast} />
        </main>
      </>
    );
  }

  const tier = customer?.status === 'approved' ? customer.priceTier : settings.publicPrices ? 'standard' : null;

  return (
    <>
      <SiteHeader current="/coffee" />
      <main id="content">
        <header className="page-head" data-reveal>
          <h1>{t('coffee.title')}</h1>
          <p>{products.length ? t('coffee.chooseLead') : t('coffee.emptyLead')}</p>
        </header>
        <div className="inner">
          {products.length === 0 ? (
            <div className="notice stack coffee-empty">
              <p>{t('coffee.emptyText')}</p>
              <p><Link href="/wholesale" className="btn">{t('nav.apply')}</Link></p>
            </div>
          ) : (
            <ul className="coffee-list">
              {await Promise.all(products.map(async (p) => {
                const o = await getOrigin(p.originId);
                const img = productPhotos(p, p.name[locale])[0];
                const perKg = Math.min(...p.formats.map((f) => Math.round((f.price[tier ?? 'standard'] / f.grams) * 1000)));
                return (
                  <li key={p.id} className="coffee-card">
                    <Link href={`/coffee/${p.slug}`} className="coffee-card__link">
                      {img ? <Photo image={img} ratio="4/5" sizes="(max-width: 760px) 100vw, 33vw" /> : <div className="coffee-card__ph" />}
                      <div className="coffee-card__body">
                        {o && <p className="kicker">{o.country[locale]} · {o.region}</p>}
                        <h2>{p.name[locale]}</h2>
                        <p className="hint">{[p.variety, p.process[locale], p.score ? `${p.score} ${t('coffee.pts')}` : null].filter(Boolean).join(' · ')}</p>
                        <p className="coffee-card__notes">{p.tastingNotes[locale]}</p>
                        <p className="coffee-card__foot">
                          {tier ? <span className="nums">{t('coffee.fromPerKg', { price: formatMoney(perKg, locale) })}</span> : <span />}
                          <span className="order-cta__link">{t('coffee.view')} →</span>
                        </p>
                      </div>
                    </Link>
                  </li>
                );
              }))}
            </ul>
          )}
        </div>
      </main>
    </>
  );
}
