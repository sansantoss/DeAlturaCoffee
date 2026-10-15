import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { SiteHeader } from '@/components/SiteHeader';
import { Bag, MomentArt, Topo } from '@/components/art';
import { WordmarkStatic } from '@/components/Wordmark';
import { ShowcaseTabs } from '@/components/home/Showcase';
import { MomentRow } from '@/components/home/MomentRow';
import { Calculator } from '@/components/home/Calculator';
import { getCurrentCustomer } from '@/lib/auth';
import { getSettings, listProducts } from '@/lib/catalog';
import { formatMoney } from '@/lib/format';
import type { Locale } from '@/lib/types';

export default async function Home({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  const [products, settings, customer] = await Promise.all([listProducts(), getSettings(), getCurrentCustomer()]);
  const product = products[0];
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
        <Topo className="hero__topo" />
        <SiteHeader variant="hero" />
        <div className="label" id="content">
          <span style={{ ['--i' as string]: 0 }}><WordmarkStatic /></span>
          <h1 className="label__title" style={{ ['--i' as string]: 1 }}>
            <span>{t('hero.title1')}</span>
            <span>{t('hero.title2')}</span>
          </h1>
          <div className="label__lines" style={{ ['--i' as string]: 2 }}>
            <span>{t('hero.line1')}</span>
            <i className="diamond" aria-hidden="true" />
            <span>{t('hero.line2')}</span>
            <i className="diamond" aria-hidden="true" />
            <span>{t('hero.line3')}</span>
          </div>
          <p className="label__notes" style={{ ['--i' as string]: 3 }}>{t('hero.notes')}</p>
          <p className="label__roast" style={{ ['--i' as string]: 4 }}>{t('hero.roast')}</p>
          <Link href="/wholesale" className="btn btn--turquoise label__cta" style={{ ['--i' as string]: 5 }}>
            {t('nav.apply')}
          </Link>
        </div>
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
          plate={
            <Bag
              label={t('showcase.bagAlt')}
              origin="VENEZUELA"
              title="Santa Cruz de Mora, Mérida"
              notes={product.tastingNotes[locale]}
            />
          }
        />
      )}

      {/* ---------- How it gets to you ---------- */}
      <MomentRow heading={t('how.heading')} backLabel={t('how.back')} nextLabel={t('how.next')}>
        {moments.map((m, i) => (
          <article className="moment" key={m.caption}>
            <h3>{m.caption}</h3>
            <p>{m.text}</p>
            <div className="moment__space" style={{ height: spaces[i % spaces.length] }} />
            <MomentArt index={i} alt={m.caption} day={dayShort} />
          </article>
        ))}
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

      {/* ---------- CTA: one word ---------- */}
      <Link href="/wholesale" className="cta-band">
        <span className="cta-band__sentence">{t('cta.sentence')}</span>
        <svg className="cta-band__arrow" viewBox="0 0 48 48" aria-hidden="true">
          <path d="M12 36 36 12M16 12h20v20" stroke="currentColor" strokeWidth="3.5" fill="none" />
        </svg>
        <span className="cta-band__word">{t('cta.word')}</span>
      </Link>
    </>
  );
}

function interpolate(text: string, vars: Record<string, string | number>) {
  return text.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? `{${k}}`));
}
