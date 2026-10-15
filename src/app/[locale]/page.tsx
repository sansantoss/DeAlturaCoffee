import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { SiteHeader } from '@/components/SiteHeader';
import { Bag, MomentArt, Topo } from '@/components/art';
import { ShowcaseTabs } from '@/components/home/Showcase';
import { MomentRow } from '@/components/home/MomentRow';
import { Calculator } from '@/components/home/Calculator';
import { getCurrentCustomer } from '@/lib/auth';
import { getSettings, listOrigins, listProducts } from '@/lib/catalog';
import { Altimeter } from '@/components/home/Altimeter';
import { formatMoney } from '@/lib/format';
import { productImages, siteImage, type SlotName } from '@/lib/images';
import { Photo } from '@/components/Photo';
import Image from 'next/image';
import type { Locale } from '@/lib/types';

export default async function Home({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  const [products, settings, customer, origins] = await Promise.all([listProducts(), getSettings(), getCurrentCustomer(), listOrigins()]);
  const product = products[0];
  const heroImg = siteImage('hero', locale);
  const plateImg = product ? productImages(product.slug, product.name[locale])[0] : undefined;
  const tier = customer?.status === 'approved' ? customer.priceTier : settings.publicPrices ? 'standard' : null;

  const facts = t.raw('intro.facts') as { value: string; explain: string }[];
  const moments = t.raw('how.moments') as { caption: string; text: string }[];
  const faq = t.raw('faq.items') as { q: string; a: string }[];
  const spaces = [120, 80, 140, 96, 132, 88];
  const dayShort = { en: 'TUE', fr: 'MAR', es: 'MAR' }[locale];
  const faqVars = {
    kg: settings.minimumOrderKg,
    free: settings.freeShippingKg,
    flat: formatMoney(settings.shippingFlatCents, locale),
  };

  return (
    <>
      {/* ---------- Hero: the label on the bag ---------- */}
      <section className="hero">
        {heroImg ? (
          <div className="hero__photo">
            <Image src={heroImg.src} alt={heroImg.alt} fill priority sizes="100vw" />
          </div>
        ) : (
          <Topo className="hero__topo" />
        )}
        <SiteHeader variant="hero" />
        <div className="hero__body" id="content">
          <h1 className="hero__title">
            <span>{t('hero.title1')}</span>
            <span>{t('hero.title2')}</span>
          </h1>
          <p className="hero__lead">{t('hero.lead')}</p>
          <div className="hero__actions">
            <Link href="/wholesale" className="btn btn--cream">{t('nav.apply')}</Link>
            <Link href="/coffee" className="hero__link">{t('hero.see')}</Link>
          </div>
        </div>
        <Altimeter
          bands={origins.filter((o) => o.active).map((o) => ({ id: o.id, label: o.country[locale], min: o.altitude.min, max: o.altitude.max }))}
          home={{ label: t('hero.home'), m: 76 }}
          unit="m"
          label={t('hero.meterLabel')}
          locale={locale}
        />
      </section>

      {/* ---------- Intro: altitude is flavour ---------- */}
      <section className="section wrap" aria-labelledby="intro-title">
        <div className="grid12 intro__top" data-reveal>
          <h2 id="intro-title" className="intro__heading">{t('intro.heading')}</h2>
          <p className="intro__note">{t('intro.note')}</p>
        </div>
        <ul className="facts" data-reveal>
          {facts.map((f) => (
            <li key={f.value}>
              <span className="facts__value nums">{f.value}</span>
              <span className="facts__explain">{f.explain}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* ---------- Showcase: the bag, by format ---------- */}
      {product && (
        <ShowcaseTabs
          title={t('showcase.title')}
          seeLabel={t('showcase.see')}
          applyLabel={customer ? t('nav.account') : t('showcase.apply')}
          applyHref={customer ? '/account' : '/wholesale'}
          tabs={product.formats.map((f) => ({
            sku: f.sku,
            label: t(`showcase.tabs.${f.sku}`),
            text: t(`showcase.formats.${f.sku}`),
          }))}
          plate={plateImg ? (
            <Photo image={plateImg} ratio="4/5" sizes="(max-width: 860px) 100vw, 45vw" />
          ) : (
            <Bag
              label={t('showcase.bagAlt')}
              origin="VENEZUELA"
              title="Santa Cruz de Mora, Mérida"
              notes={product.tastingNotes[locale]}
            />
          )
          }
        />
      )}

      {/* ---------- How it gets to you ---------- */}
      <MomentRow heading={t('how.heading')} backLabel={t('how.back')} nextLabel={t('how.next')}>
        {moments.map((m, i) => {
          const img = siteImage(`proceso_${i + 1}` as SlotName, locale);
          return (
          <article className="moment" key={m.caption}>
            <h3>{m.caption}</h3>
            <p>{m.text}</p>
            <div className="moment__space" style={{ height: spaces[i % spaces.length] }} />
            {img ? <Photo image={img} sizes="(max-width: 760px) 72vw, 280px" /> : <MomentArt index={i} alt={m.caption} day={dayShort} />}
          </article>
          );
        })}
      </MomentRow>

      {/* ---------- Formats + the calculator ---------- */}
      {product && (
        <section className="section wrap" aria-labelledby="formats-title">
          <div className="formats">
            <div className="formats__list">
              <h2 id="formats-title" className={`giant ${locale === 'es' ? 'giant--es' : ''}`}>{t('formats.word')}</h2>
              <div className="bars">
                {product.formats.map((f, i) => (
                  <details className="bar" key={f.sku} open={i === 0}>
                    <summary>{f.label[locale]}</summary>
                    <div className="bar__panel">
                      {product.roasts.map((r) => (
                        <div className="bar__item" key={r}>
                          <span>
                            {t(`formats.${r}`)}
                            {tier && (
                              <small className="nums">
                                {t('formats.perKg', { price: formatMoney(Math.round((f.price[tier] / f.grams) * 1000), locale) })}
                              </small>
                            )}
                          </span>
                          <span className="bar__price nums">
                            {tier ? (
                              formatMoney(f.price[tier], locale)
                            ) : (
                              <Link href="/login" className="link">{t('formats.signInForPrice')}</Link>
                            )}
                          </span>
                        </div>
                      ))}
                    </div>
                  </details>
                ))}
                <details className="bar">
                  <summary>{t('formats.termsTitle')}</summary>
                  <div className="bar__panel nums">
                    <div className="bar__item"><span>{t('formats.minimum')}</span><span>{t('formats.minimumValue', { kg: settings.minimumOrderKg })}</span></div>
                    <div className="bar__item"><span>{t('formats.freeFrom')}</span><span>{t('formats.freeFromValue', { kg: settings.freeShippingKg })}</span></div>
                    <div className="bar__item"><span>{t('formats.flat', { kg: settings.freeShippingKg })}</span><span>{formatMoney(settings.shippingFlatCents, locale)}</span></div>
                    <div className="bar__item"><span>{t('formats.tax')}</span><span>{t('formats.taxValue')}</span></div>
                  </div>
                </details>
              </div>
            </div>
            <Calculator />
          </div>
        </section>
      )}

      {/* ---------- FAQ ---------- */}
      <section className="section wrap grid12 faq" aria-labelledby="faq-title">
        <h2 id="faq-title">{t('faq.heading')}</h2>
        <div className="faq__text" data-reveal>
          {faq.map((item) => (
            <p key={item.q}>
              <strong>{item.q}</strong> {interpolate(item.a, faqVars)}
            </p>
          ))}
        </div>
      </section>

    </>
  );
}

function interpolate(text: string, vars: Record<string, string | number>) {
  return text.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? `{${k}}`));
}
