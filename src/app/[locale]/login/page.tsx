import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link, redirect } from '@/i18n/navigation';
import { SiteHeader } from '@/components/SiteHeader';
import { SignInForm } from '@/components/forms';
import { getUserId } from '@/lib/auth';
import { backend } from '@/lib/db';
import type { Locale } from '@/lib/types';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const t = await getTranslations({ locale: (await params).locale, namespace: 'auth' });
  return { title: t('title') };
}

export default async function LoginPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{ next?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  if (await getUserId()) redirect({ href: '/account', locale });
  const { next } = await searchParams;
  const t = await getTranslations();
  // The demo hint only shows in local mode, never in production with Supabase.
  const demo = backend === 'local' && process.env.NODE_ENV !== 'production'
    ? { email: 'demo@dealtura.ca', password: 'cafe-de-altura' }
    : undefined;

  return (
    <>
      <SiteHeader />
      <main id="content" className="inner" style={{ paddingTop: 'clamp(3rem, 7vw, 6rem)' }}>
        <div className="stack" style={{ maxWidth: '28rem' }} data-reveal>
          <h1 className="h-section">{t('auth.title')}</h1>
          <p>{t('auth.lead')}</p>
          <SignInForm next={next} demo={demo} />
          <p>{t('auth.noAccount')} <Link href="/wholesale" className="link" style={{ textDecorationColor: 'currentColor' }}>{t('nav.apply')}</Link></p>
        </div>
      </main>
    </>
  );
}
