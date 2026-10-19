import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { hasLocale, NextIntlClientProvider } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { siteUrl } from '@/lib/site';
import { routing } from '@/i18n/routing';
import { SiteFooter } from '@/components/SiteFooter';
import { Reveal } from '@/components/Reveal';
import '@fontsource-variable/jost';
import '@fontsource-variable/cormorant-garamond';
import '@fontsource-variable/cormorant-garamond/wght-italic.css';
import '../globals.css';

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'meta' });
  const site = siteUrl();
  return {
    metadataBase: new URL(site),
    title: { default: t('title'), template: `%s — DeAltura Coffee` },
    description: t('description'),
    alternates: {
      canonical: `/${locale}`,
      languages: Object.fromEntries(routing.locales.map((l) => [l === 'fr' ? 'fr-CA' : l === 'es' ? 'es' : 'en-CA', `/${l}`])),
    },
    openGraph: {
      title: t('title'), description: t('description'), siteName: 'DeAltura Coffee', locale, type: 'website',
      images: [{ url: '/og.jpg', width: 1200, height: 630, alt: 'DeAltura Coffee' }],
    },
    twitter: { card: 'summary_large_image', title: t('title'), description: t('description'), images: ['/og.jpg'] },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations('nav');

  return (
    <html lang={locale === 'fr' ? 'fr-CA' : locale === 'es' ? 'es' : 'en-CA'} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: "document.documentElement.classList.add('js')" }} />
      </head>
      <body>
        <NextIntlClientProvider>
          <a className="skip" href="#content">{t('skip')}</a>
          <div className="page">{children}</div>
          <SiteFooter />
          <Reveal />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
