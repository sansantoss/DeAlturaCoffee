import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link, redirect } from '@/i18n/navigation';
import { SiteHeader } from '@/components/SiteHeader';
import { PasswordForm, ProfileForm } from '@/components/forms';
import { getCurrentCustomer } from '@/lib/auth';
import type { Locale } from '@/lib/types';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const t = await getTranslations({ locale: (await params).locale, namespace: 'account' });
  return { title: t('editProfile'), robots: { index: false } };
}

/** Editar todos los datos del negocio, la dirección de entrega y la contraseña. */
export default async function ProfilePage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const customer = await getCurrentCustomer();
  if (!customer) return redirect({ href: '/login?next=/account/profile', locale });
  const t = await getTranslations();

  return (
    <>
      <SiteHeader />
      <main id="content" className="inner" style={{ paddingTop: 'clamp(2rem, 5vw, 4rem)' }}>
        <div className="profile-page stack-lg">
          <p><Link href="/account" className="link">← {t('account.title')}</Link></p>
          <header className="stack">
            <h1 className="h-section">{t('account.editProfile')}</h1>
            <p className="hint">{customer.email}</p>
          </header>
          <section className="panel">
            <ProfileForm customer={customer} />
          </section>
          <section className="panel">
            <PasswordForm />
          </section>
        </div>
      </main>
    </>
  );
}
