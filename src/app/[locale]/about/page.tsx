import type { Metadata } from 'next';
import Image from 'next/image';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { SiteHeader } from '@/components/SiteHeader';
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
  const storyImg = siteImage('nosotros', locale) ?? siteImage('proceso_3', locale);
  const story = t.raw('story') as string[];
  const pillars = t.raw('pillars') as { title: string; text: string }[];
  const values = t.raw('values') as { value: string; explain: string }[];

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
            <h1>{t('title')}</h1>
            <p>{t('lead')}</p>
          </div>
        </section>

        <section className="section wrap grid12 split">
          <div className="split__text stack" data-reveal>
            <h2 className="h-section">{t('storyTitle')}</h2>
            {story.map((p) => <p key={p} style={{ fontSize: '1.125rem' }}>{p}</p>)}
          </div>
          <div className="split__media">
            {storyImg ? <Photo image={storyImg} /> : <MomentArt index={2} alt={t('storyTitle')} day="" />}
          </div>
        </section>

        <section className="wrap">
          <ul className="facts facts--about" data-reveal>
            {values.map((v) => (
              <li key={v.value}>
                <span className="facts__value">{v.value}</span>
                <span className="facts__explain">{v.explain}</span>
              </li>
            ))}
          </ul>
        </section>

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
