import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { SiteHeader } from '@/components/SiteHeader';
import { MomentArt, Topo } from '@/components/art';
import { Link } from '@/i18n/navigation';
import { getOrigin, listOrigins, listProducts } from '@/lib/catalog';
import { formatNumber } from '@/lib/format';
import { siteImage } from '@/lib/images';
import { Photo } from '@/components/Photo';
import Image from 'next/image';
import type { Locale } from '@/lib/types';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const t = await getTranslations({ locale: (await params).locale, namespace: 'nav' });
  return { title: t('origin') };
}

export default async function OriginPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  const origin = (await getOrigin('ven-merida'))!;
  const heroImg = siteImage('origen_hero', locale);
  const altImg = siteImage('origen_altura', locale);
  const caImg = siteImage('origen_canada', locale);
  const [origins, products] = await Promise.all([listOrigins(), listProducts()]);
  const byAltitude = [...origins].filter((o) => o.active).sort((a, b) => b.altitude.max - a.altitude.max);
  const SCALE = 2200; // metres shown on the ruler
  const pct = (m: number) => `${((m / SCALE) * 100).toFixed(2)}%`;

  return (
    <>
      <SiteHeader current="/origin" />
      <main id="content">
        <section style={{ position: 'relative', background: 'var(--turquoise)', color: 'var(--cream)', overflow: 'hidden' }}>
          {heroImg ? (
            <div className="hero__photo"><Image src={heroImg.src} alt={heroImg.alt} fill priority sizes="100vw" /></div>
          ) : (
            <Topo className="hero__topo" />
          )}
          <div className="page-head" style={{ position: 'relative', paddingBlock: 'clamp(5rem, 12vw, 10rem)' }} data-reveal>
            <h1 style={{ fontSize: 'var(--step-hero)' }}>{t('origin.title')}</h1>
            <p style={{ fontSize: 'var(--step-2)', fontFamily: 'var(--font-display)' }}>{t('origin.lead')}</p>
            <p className="nums" style={{ marginTop: '2rem' }}>
              {origin.region} · {formatNumber(origin.altitude.min, locale)}–{formatNumber(origin.altitude.max, locale)} m
            </p>
          </div>
        </section>

        <section className="section wrap grid12" style={{ rowGap: '3rem' }}>
          <div style={{ gridColumn: '1 / span 6' }} className="stack" data-reveal>
            <h2 className="h-section">{t('origin.why')}</h2>
            <p style={{ fontSize: '1.125rem' }}>{t('origin.whyText')}</p>
            <p>{origin.story[locale]}</p>
          </div>
          <div style={{ gridColumn: '8 / span 5' }}>
            {altImg ? <Photo image={altImg} /> : <MomentArt index={0} alt={t('how.moments.0.caption')} day="" />}
          </div>
        </section>

        <section className="section wrap grid12" style={{ background: 'var(--sand)', rowGap: '3rem' }}>
          <div style={{ gridColumn: '1 / span 5' }}>
            {caImg ? <Photo image={caImg} /> : <MomentArt index={3} alt={t('how.moments.3.caption')} day="" />}
          </div>
          <div style={{ gridColumn: '7 / span 6', alignSelf: 'center' }} className="stack" data-reveal>
            <h2 className="h-section">{t('origin.canada')}</h2>
            <p style={{ fontSize: '1.125rem' }}>{t('origin.canadaText')}</p>
          </div>
        </section>
        <section className="section wrap" aria-labelledby="altitude-title">
          <div className="grid12" data-reveal>
            <h2 id="altitude-title" className="h-section" style={{ gridColumn: '1 / span 6' }}>{t('origin.allTitle')}</h2>
            <p style={{ gridColumn: '7 / span 6' }}>{t('origin.allLead')}</p>
          </div>
          <ol className="ruler" data-reveal>
            {byAltitude.map((o) => {
              const product = products.find((p) => p.originId === o.id);
              return (
                <li key={o.id} className="ruler__row">
                  <div className="ruler__name">
                    <strong>{o.country[locale]}</strong>
                    <span>{o.region}</span>
                  </div>
                  <div className="ruler__track" aria-hidden="true">
                    <span className="ruler__band" style={{ left: pct(o.altitude.min), width: pct(o.altitude.max - o.altitude.min) }} />
                  </div>
                  <div className="ruler__value nums">
                    {formatNumber(o.altitude.min, locale)}–{formatNumber(o.altitude.max, locale)} m
                    {product && <Link href={`/coffee/${product.slug}`} className="link">{t('origin.see')}</Link>}
                  </div>
                </li>
              );
            })}
            <li className="ruler__row ruler__row--home">
              <div className="ruler__name"><strong>{t('origin.toronto')}</strong><span>Ontario</span></div>
              <div className="ruler__track" aria-hidden="true"><span className="ruler__band" style={{ left: 0, width: pct(76) }} /></div>
              <div className="ruler__value nums">76 m</div>
            </li>
          </ol>
        </section>
      </main>
      <style>{`@media (max-width: 860px){ main .grid12 > * { grid-column: 1 / -1 !important; } }`}</style>
    </>
  );
}
