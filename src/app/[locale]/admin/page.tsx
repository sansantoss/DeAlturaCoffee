import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link, redirect } from '@/i18n/navigation';
import { SiteHeader } from '@/components/SiteHeader';
import { getCurrentCustomer } from '@/lib/auth';
import { isAdmin } from '@/lib/admin';
import { repo } from '@/lib/db';
import { formatDate, formatMoney } from '@/lib/format';
import type { Customer, Locale, OrderStatus } from '@/lib/types';
import { adminUpdateCustomer, adminUpdateOrder } from './actions';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const t = await getTranslations({ locale: (await params).locale, namespace: 'admin' });
  return { title: t('title'), robots: { index: false } };
}

const ORDER_STATUSES: OrderStatus[] = ['awaiting_payment', 'paid', 'invoiced', 'roasting', 'shipped', 'delivered', 'cancelled'];

export default async function AdminPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const me = await getCurrentCustomer();
  if (!me) return redirect({ href: '/login?next=/admin', locale });
  const t = await getTranslations();

  if (!isAdmin(me)) {
    return (
      <>
        <SiteHeader />
        <main id="content" className="inner" style={{ paddingBlock: 'clamp(3rem, 8vw, 6rem)' }}>
          <p className="notice notice--strong">{t('admin.forbidden')}</p>
        </main>
      </>
    );
  }

  const [customers, orders, applications] = await Promise.all([
    repo.customers.list(),
    repo.orders.listAll(),
    repo.applications.list(),
  ]);
  const byId = new Map(customers.map((c) => [c.id, c]));
  const pending = customers.filter((c) => c.status === 'pending');
  const others = customers.filter((c) => c.status !== 'pending' && !isAdmin(c));
  const appFor = (c: Customer) => applications.find((a) => a.email.toLowerCase() === c.email.toLowerCase());

  const CustomerRow = ({ c }: { c: Customer }) => {
    const app = appFor(c);
    return (
      <form action={adminUpdateCustomer} className="admin-row">
        <input type="hidden" name="id" value={c.id} />
        <div className="admin-row__who">
          <strong>{c.businessName}</strong>
          <span>
            {c.contactName} · <a href={`mailto:${c.email}`} className="link">{c.email}</a>
            {c.phone ? <> · {c.phone}</> : null}
          </span>
          {app && (
            <span className="hint nums">
              {app.city}, {app.province} · {t('admin.kgMonth', { kg: app.estimatedKgPerMonth })} ·{' '}
              {t('admin.applied', { date: formatDate(app.createdAt, locale) })}
              {app.message ? <> · “{app.message}”</> : null}
            </span>
          )}
        </div>
        <label className="field">
          <span>{t('admin.status')}</span>
          <select name="status" defaultValue={c.status} className="input">
            {(['pending', 'approved', 'suspended'] as const).map((s) => (
              <option key={s} value={s}>{t(`admin.statuses.${s}`)}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>{t('admin.tier')}</span>
          <select name="priceTier" defaultValue={c.priceTier} className="input">
            {(['standard', 'partner'] as const).map((s) => (
              <option key={s} value={s}>{t(`admin.tiers.${s}`)}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>{t('admin.terms')}</span>
          <select name="invoiceTermsDays" defaultValue={c.invoiceTermsDays ? String(c.invoiceTermsDays) : 'none'} className="input">
            <option value="none">{t('admin.termsNone')}</option>
            {[15, 30, 45].map((d) => (
              <option key={d} value={String(d)}>{t('admin.days', { days: d })}</option>
            ))}
          </select>
        </label>
        <button className="btn">{t('admin.save')}</button>
      </form>
    );
  };

  return (
    <>
      <SiteHeader />
      <main id="content" className="inner admin" style={{ paddingTop: 'clamp(2.5rem, 6vw, 5rem)' }}>
        <header className="stack" style={{ marginBottom: '3rem' }}>
          <h1 className="h-section">{t('admin.title')}</h1>
          <p>{t('admin.lead')}</p>
        </header>

        <section className="stack" aria-labelledby="pending-h">
          <h2 id="pending-h" className="h-small">{t('admin.pendingTitle')} ({pending.length})</h2>
          {pending.length === 0 ? (
            <p className="notice">{t('admin.pendingNone')}</p>
          ) : (
            pending.map((c) => <CustomerRow key={c.id} c={c} />)
          )}
        </section>

        <section className="stack" aria-labelledby="orders-h" style={{ marginTop: '4rem' }}>
          <h2 id="orders-h" className="h-small">{t('admin.ordersTitle')} ({orders.length})</h2>
          {orders.length === 0 ? (
            <p className="notice">{t('admin.ordersNone')}</p>
          ) : (
            orders.map((o) => {
              const c = byId.get(o.customerId);
              return (
                <form action={adminUpdateOrder} className="admin-row admin-row--order nums" key={o.id}>
                  <input type="hidden" name="id" value={o.id} />
                  <div className="admin-row__who">
                    <strong>{o.number} · {c?.businessName ?? '—'}</strong>
                    <span>
                      {formatDate(o.createdAt, locale)} · {t('admin.lines', { count: o.lines.length })} ·{' '}
                      {o.shippingAddress.city}, {o.shippingAddress.province} · {o.paymentMethod === 'invoice' ? t('admin.payInvoice') : t('admin.payCard')}
                    </span>
                    <span className="hint">
                      {o.lines.map((l) => `${l.quantity} × ${l.productName} (${l.formatLabel}, ${l.roast})`).join(' · ')}
                    </span>
                  </div>
                  <strong>{formatMoney(o.totalCents, locale)}</strong>
                  <label className="field">
                    <span>{t('admin.status')}</span>
                    <select name="status" defaultValue={o.status} className="input">
                      {ORDER_STATUSES.map((s) => (
                        <option key={s} value={s}>{t(`order.status.${s}`)}</option>
                      ))}
                    </select>
                  </label>
                  <button className="btn">{t('admin.save')}</button>
                </form>
              );
            })
          )}
        </section>

        <section className="stack" aria-labelledby="customers-h" style={{ marginTop: '4rem', marginBottom: '6rem' }}>
          <h2 id="customers-h" className="h-small">{t('admin.customersTitle')} ({others.length})</h2>
          {others.map((c) => <CustomerRow key={c.id} c={c} />)}
          <p><Link href="/account" className="link">{t('nav.account')}</Link></p>
        </section>
      </main>
    </>
  );
}
