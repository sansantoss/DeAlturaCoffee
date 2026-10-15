import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { SiteHeader } from '@/components/SiteHeader';
import { ApplyForm } from '@/components/forms';
import { getSettings } from '@/lib/catalog';
import { formatMoney } from '@/lib/format';
import type { Locale } from '@/lib/types';
import { siteImage } from '@/lib/images';
import { Photo } from '@/components/Photo';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const t = await getTranslations({ locale: (await params).locale, namespace: 'apply' });
  return { title: t('title') };
}

export default async function WholesalePage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  const s = await getSettings();
  const img = siteImage('mayoreo', locale);

  return (
    <>
      <SiteHeader current="/wholesale" />
      <main id="content" className="inner" style={{ paddingTop: 'clamp(3rem, 7vw, 6rem)' }}>
        <div className="portal">
          <div className="stack narrow" data-reveal>
            <h1 className="h-section">{t('apply.title')}</h1>
            <p style={{ fontSize: '1.125rem' }}>{t('apply.lead')}</p>
            <ApplyForm />
            <p>{t('apply.haveAccount')} <Link href="/login" className="link" style={{ textDecorationColor: 'currentColor' }}>{t('nav.signIn')}</Link></p>
          </div>
          <div className="stack">
          {img && <Photo image={img} sizes="(max-width: 960px) 100vw, 33vw" />}
          <aside className="panel panel--dark stack nums">
            <h2>{t('formats.termsTitle')}</h2>
            <div className="totals">
              <div><span>{t('formats.minimum')}</span><span>{t('formats.minimumValue', { kg: s.minimumOrderKg })}</span></div>
              <div><span>{t('formats.freeFrom')}</span><span>{t('formats.freeFromValue', { kg: s.freeShippingKg })}</span></div>
              <div><span>{t('formats.flat', { kg: s.freeShippingKg })}</span><span>{formatMoney(s.shippingFlatCents, locale)}</span></div>
              <div><span>{t('formats.tax')}</span><span>{t('formats.taxValue')}</span></div>
            </div>
            <p>{t('faq.items.2.a')}</p>
          </aside>
          </div>
        </div>
      </main>
    </>
  );
}
