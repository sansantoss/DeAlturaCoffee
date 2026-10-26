import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { SiteHeader } from '@/components/SiteHeader';
import { MomentArt, Topo } from '@/components/art';
import { RoastCarousel } from '@/components/home/RoastCarousel';
import { MomentRow } from '@/components/home/MomentRow';
import { OrderCta } from '@/components/OrderCta';
import { Calculator } from '@/components/home/Calculator';
import { getCurrentCustomer } from '@/lib/auth';
import { getSettings, listProducts } from '@/lib/catalog';
import { formatMoney } from '@/lib/format';
import { heroMedia, roastImage, siteImage, type SlotName } from '@/lib/images';
import { HeroVideo } from '@/components/home/HeroVideo';
import { Photo } from '@/components/Photo';
import Image from 'next/image';
import type { Locale } from '@/lib/types';

export default async function Home({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  const [products, settings, customer] = await Promise.all([listProducts(), getSettings(), getCurrentCustomer()]);
  const product = products[0];
  const hero = heroMedia(locale); // se configura en content/images.json → slots.hero
  const faqImg = siteImage('preguntas', locale);
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
        {hero.image || hero.video ? (
          <div className="hero__photo" style={{ ['--veil' as string]: hero.overlay }}>
            {hero.image && <Image src={hero.image.src} alt={hero.image.alt} fill priority sizes="100vw" style={{ objectPosition: hero.position }} />}
            {hero.video && <HeroVideo mp4={hero.video.mp4} webm={hero.video.webm} poster={hero.image?.src} position={hero.position} />}
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

      {/* ---------- Carrusel de tostados (antes: la bolsa por formato) ---------- */}
      {product && (
        <RoastCarousel
          heading={t('roasts.heading')}
          kicker={t('roasts.kicker')}
          product={product.name[locale]}
          cta={t('roasts.cta')}
          prev={t('roasts.prev')}
          next={t('roasts.next')}
          counter={t.raw('roasts.slide') as string}
          slides={product.roasts.map((r) => ({
            id: r,
            name: t(`roasts.${r}`),
            notes: product.roastInfo?.[r]?.notes[locale] ?? product.tastingNotes[locale],
            use: product.roastInfo?.[r]?.use[locale] ?? '',
            image: roastImage(product.slug, r, product.name[locale]),
          }))}
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
      <div className="wrap"><OrderCta /></div>

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
                      <div className="bar__item">
                        <span>
                          {t('formats.available')}
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

      {/* ---------- FAQ: preguntas como acordeón ---------- */}
      <section className="section wrap grid12 faq" aria-labelledby="faq-title">
        <div className="faq__side">
          <h2 id="faq-title">{t('faq.heading')}</h2>
          {faqImg && <Photo image={faqImg} sizes="(max-width: 860px) 100vw, 25vw" className="faq__photo" />}
        </div>
        <div className="bars faq__list" data-reveal>
          {faq.map((item, i) => (
            <details className="bar" key={item.q} open={i === 0}>
              <summary>{item.q}</summary>
              <div className="bar__panel"><p>{interpolate(item.a, faqVars)}</p></div>
            </details>
          ))}
        </div>
      </section>
    </>
  );
}

function interpolate(text: string, vars: Record<string, string | number>) {
  return text.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? `{${k}}`));
}
