import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { SiteHeader } from '@/components/SiteHeader';
import { Bag } from '@/components/art';
import { ProductSpec } from '@/components/ProductSpec';
import { getOrigin, listProducts } from '@/lib/catalog';
import type { Locale } from '@/lib/types';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const t = await getTranslations({ locale: (await params).locale, namespace: 'coffee' });
  return { title: t('title') };
}

export default async function CoffeePage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  const products = await listProducts();

  return (
    <>
      <SiteHeader current="/coffee" />
      <main id="content">
        <header className="page-head" data-reveal>
          <h1>{t('coffee.title')}</h1>
          <p>{t('coffee.lead')}</p>
        </header>
        <div className="inner stack">
          {await Promise.all(
            products.map(async (p) => {
              const origin = (await getOrigin(p.originId))!;
              return (
                <article className="catalog" key={p.id} data-reveal>
                  <div className="catalog__bag">
                    <Bag label={t('showcase.bagAlt')} origin={origin.country[locale].toUpperCase()} title={origin.region} notes={p.tastingNotes[locale]} />
                  </div>
                  <div className="stack">
                    <h2 className="h-section">{p.name[locale]}</h2>
                    <ProductSpec product={p} origin={origin} locale={locale} />
                    <div>
                      <Link href={`/coffee/${p.slug}`} className="btn">{t('coffee.view')}</Link>
                    </div>
                  </div>
                </article>
              );
            }),
          )}
          <p className="coming">{t('coffee.comingSoon')}</p>
        </div>
      </main>
    </>
  );
}
