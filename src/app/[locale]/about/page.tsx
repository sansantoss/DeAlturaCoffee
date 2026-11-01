import type { Metadata } from 'next';
import Image from 'next/image';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { SiteHeader } from '@/components/SiteHeader';
import { Link } from '@/i18n/navigation';
import { MomentArt, Topo } from '@/components/art';
import { Photo } from '@/components/Photo';
import { OrderCta } from '@/components/OrderCta';
import { siteImage } from '@/lib/images';
import type { Locale } from '@/lib/types';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const t = await getTranslations({ locale: (await params).locale, namespace: 'about' });
  return { title: t('title'), description: t('lead') };
}

/** Quiénes somos (antes "Origen"). La parte de origen y altura vive ahora en la página del café. */
export default async function AboutPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('about');
  const heroImg = siteImage('origen_hero', locale);
  const chapters = t.raw('chapters') as { kicker: string; title: string; paras: string[]; link?: string }[];
  const pillars = t.raw('pillars') as { title: string; text: string }[];
  // Foto de cada capítulo: la propia si existe en public/images, si no una provisional
  const photos = [
    siteImage('nosotros', locale) ?? siteImage('proceso_6', locale),
    siteImage('mision', locale) ?? siteImage('proceso_4', locale),
    siteImage('primer_lote', locale) ?? siteImage('proceso_1', locale),
  ];

  return (
    <>
      <SiteHeader current="/about" />
      <main id="content">
        <section className="about-hero">
          {heroImg ? (
            <div className="hero__photo hero__photo--strong"><Image src={heroImg.src} alt={heroImg.alt} fill priority sizes="100vw" /></div>
          ) : (
            <Topo className="hero__topo" />
          )}
          <div className="page-head about-hero__body" data-reveal>
            <p className="kicker">{t('title')}</p>
            <h1>{t('headline')}</h1>
            <p>{t('lead')}</p>
          </div>
        </section>

        {chapters.map((c, i) => (
          <section key={c.title} className={`section wrap grid12 split chapter ${i % 2 ? 'split--rev' : ''}`} aria-labelledby={`ch-${i}`}>
            <div className="split__text stack" data-reveal>
              <p className="chapter__n">{c.kicker}</p>
              <h2 id={`ch-${i}`} className="h-section">{c.title}</h2>
              {c.paras.map((p) => <p key={p.slice(0, 24)} className="chapter__p">{p}</p>)}
              {c.link && <p><Link href="/coffee" className="order-cta__link">{c.link} →</Link></p>}
            </div>
            <div className="split__media">
              {photos[i] ? <Photo image={photos[i]!} /> : <MomentArt index={i} alt={c.title} day="" />}
            </div>
          </section>
        ))}

        <section className="section wrap" aria-labelledby="pillars-title">
          <h2 id="pillars-title" className="h-section">{t('pillarsTitle')}</h2>
          <ol className="pillars" data-reveal>
            {pillars.map((p, i) => (
              <li key={p.title} className="pillar">
                <span className="pillar__n nums">0{i + 1}</span>
                <h3>{p.title}</h3>
                <p>{p.text}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="section wrap about-for" style={{ background: 'var(--sand)' }}>
          <div className="stack" data-reveal>
            <h2 className="h-section">{t('forTitle')}</h2>
            <p style={{ fontSize: '1.125rem' }}>{t('forText')}</p>
            <OrderCta />
          </div>
        </section>
      </main>
    </>
  );
}
