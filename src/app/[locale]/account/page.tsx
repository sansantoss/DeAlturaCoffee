import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link, redirect } from '@/i18n/navigation';
import { SiteHeader } from '@/components/SiteHeader';
import { ProfileForm } from '@/components/forms';
import { getCurrentCustomer } from '@/lib/auth';
import { isAdmin } from '@/lib/admin';
import { repo } from '@/lib/db';
import { formatDate, formatMoney } from '@/lib/format';
import type { Locale } from '@/lib/types';
import { signOutAction } from '../actions';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const t = await getTranslations({ locale: (await params).locale, namespace: 'account' });
  return { title: t('title'), robots: { index: false } };
}

export default async function AccountPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const customer = await getCurrentCustomer();
  if (!customer) return redirect({ href: '/login?next=/account', locale });
  const [orders, t] = await Promise.all([repo.orders.listByCustomer(customer.id), getTranslations()]);

  return (
    <>
      <SiteHeader />
      <main id="content" className="inner" style={{ paddingTop: 'clamp(2.5rem, 6vw, 5rem)' }}>
        <div className="stack" style={{ marginBottom: '2.5rem' }} data-reveal>
          <h1 className="h-section">{t('account.hello', { name: customer.contactName.split(' ')[0] })}</h1>
          <p className={`notice ${customer.status === 'approved' ? '' : 'notice--strong'}`}>
            <strong>{customer.businessName}.</strong> {t(`account.status.${customer.status}`)}
            {customer.invoiceTermsDays ? <> {t('account.terms', { days: customer.invoiceTermsDays })}</> : null}
          </p>
          {isAdmin(customer) && (
            <p><Link href="/admin" className="btn btn--turquoise">{t('admin.link')}</Link></p>
          )}
        </div>

        <div className="portal">
          <section className="stack" aria-labelledby="orders-h">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
              <h2 id="orders-h" className="h-small">{t('account.orders')}</h2>
              {customer.status === 'approved' && <Link href="/coffee" className="btn">{t('account.orderAgain')}</Link>}
            </div>
            {orders.length === 0 ? (
              <p className="notice">{t('account.noOrders')}</p>
            ) : (
              <div className="orders">
                {orders.map((o) => (
                  <Link key={o.id} href={`/account/orders/${o.id}`} className="order-row nums">
                    <strong>{o.number}</strong>
                    <span>{formatDate(o.createdAt, locale)}</span>
                    <span className={`status status--${o.status}`}>{t(`order.status.${o.status}`)}</span>
                    <span>{formatMoney(o.totalCents, locale)}</span>
                  </Link>
                ))}
              </div>
            )}
          </section>

          <section className="panel stack" aria-labelledby="profile-h">
            <h2 id="profile-h">{t('account.profile')}</h2>
            <p className="hint">{customer.email}</p>
            <ProfileForm customer={customer} />
            <form action={signOutAction}>
              <button className="link" style={{ textDecorationColor: 'currentColor' }}>{t('auth.signOut')}</button>
            </form>
          </section>
        </div>
      </main>
    </>
  );
}
