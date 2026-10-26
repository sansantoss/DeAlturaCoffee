import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { Bag, MomentArt } from './art';
import { Photo } from './Photo';
import { ProductSpec } from './ProductSpec';
import { ProductHero, type RoastTab } from './ProductHero';
import { LabSheet } from './LabSheet';
import { Farms } from './Farms';
import { OrderCta } from './OrderCta';
import { getCurrentCustomer } from '@/lib/auth';
import { getOrigin, getSettings, listFarms } from '@/lib/catalog';
import { roastImage, siteImage } from '@/lib/images';
import { formatMoney } from '@/lib/format';
import type { Locale, Product, RoastLevel } from '@/lib/types';

/**
 * La página del café: arriba el grano con su historia y cómo pedirlo (sin pasar por "ver y pedir"),
 * luego la ficha técnica, las fincas y, al final, por qué importa la altura y el tueste en Canadá.
 */
export async function ProductDetail({ product, locale, roast }: { product: Product; locale: Locale; roast?: string }) {
  const [origin, customer, settings, farms, t] = await Promise.all([
    getOrigin(product.originId),
    getCurrentCustomer(),
    getSettings(),
    listFarms(),
    getTranslations(),
  ]);
  if (!origin) return null;

  const approved = customer?.status === 'approved';
  const tier = approved ? customer.priceTier : settings.publicPrices ? 'standard' : null;
  const name = product.name[locale];

  const roasts: RoastTab[] = product.roasts.map((r) => ({
    id: r,
    name: t(`formats.${r}` as 'formats.light'),
    notes: product.roastInfo?.[r]?.notes[locale] ?? product.tastingNotes[locale],
    use: product.roastInfo?.[r]?.use[locale] ?? '',
    image: roastImage(product.slug, r, name),
  }));

  const altImg = siteImage('origen_altura', locale);
  const caImg = siteImage('origen_canada', locale);

  return (
    <>
      <section className="inner product-wrap" id="top">
        <ProductHero
          roasts={roasts}
          initial={(roast as RoastLevel) ?? product.roasts[1] ?? product.roasts[0]}
          roastTitle={t('coffee.roastTitle')}
          fallback={
            <div className="catalog__bag">
              <Bag label={t('showcase.bagAlt')} origin={origin.country[locale].toUpperCase()} title={origin.region} notes={product.tastingNotes[locale]} />
            </div>
          }
          intro={
            <>
              <p className="kicker">{origin.country[locale]} · {origin.region}</p>
              <h1 className="h-section">{name}</h1>
              <p className="product__story">{origin.story[locale]}</p>
            </>
          }
          spec={<ProductSpec product={product} origin={origin} locale={locale} />}
          cart={approved ? {
            formats: product.formats.map((f) => ({ sku: f.sku, label: f.label[locale], unitPriceCents: f.price[customer.priceTier] })),
          } : undefined}
          order={approved ? undefined : (
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
                  <Link href={`/login?next=/coffee`} className="btn">{t('product.signIn')}</Link>
                  <Link href="/wholesale" className="btn btn--ghost">{t('nav.apply')}</Link>
                </div>
              )}
            </div>
          )}
        />
      </section>

      {product.lab && <LabSheet lab={product.lab} score={product.score} locale={locale} image={siteImage('granos', locale)} />}

      <Farms farms={farms} locale={locale} />

      {/* Lo que antes era la página de Origen */}
      <section className="section wrap grid12 split" style={{ rowGap: '3rem' }}>
        <div className="split__text stack" data-reveal>
          <h2 className="h-section">{t('origin.why')}</h2>
          <p style={{ fontSize: '1.125rem' }}>{t('origin.whyText')}</p>
        </div>
        <div className="split__media">
          {altImg ? <Photo image={altImg} /> : <MomentArt index={0} alt={t('how.moments.0.caption')} day="" />}
        </div>
      </section>
      <section className="section wrap grid12 split split--rev" style={{ background: 'var(--sand)', rowGap: '3rem' }}>
        <div className="split__media">
          {caImg ? <Photo image={caImg} /> : <MomentArt index={3} alt={t('how.moments.3.caption')} day="" />}
        </div>
        <div className="split__text stack" data-reveal>
          <h2 className="h-section">{t('origin.canada')}</h2>
          <p style={{ fontSize: '1.125rem' }}>{t('origin.canadaText')}</p>
          <OrderCta href="/coffee#top" />
        </div>
      </section>
    </>
  );
}
