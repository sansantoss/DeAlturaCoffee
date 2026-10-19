import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { CustomerRow } from '@/components/admin';
import { repo } from '@/lib/db';
import { isAdmin } from '@/lib/admin';
import { formatDate, formatMoney } from '@/lib/format';
import type { AccountStatus, Locale } from '@/lib/types';

const STATUSES: AccountStatus[] = ['pending', 'approved', 'suspended'];

export default async function AdminCustomers({ params, searchParams }: { params: Promise<{ locale: Locale }>; searchParams: Promise<{ status?: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const filter = STATUSES.includes(sp.status as AccountStatus) ? (sp.status as AccountStatus) : null;
  const [t, customers, orders, applications] = await Promise.all([getTranslations(), repo.customers.list(), repo.orders.listAll(), repo.applications.list()]);
  const all = customers.filter((c) => !isAdmin(c));
  // Pendientes primero; luego el resto por fecha
  const sorted = [...all].sort((a, b) => Number(b.status === 'pending') - Number(a.status === 'pending'));
  const shown = filter ? sorted.filter((c) => c.status === filter) : sorted;
  const stats = new Map<string, { orders: number; cents: number }>();
  for (const o of orders) {
    if (o.status === 'cancelled') continue;
    const s = stats.get(o.customerId) ?? { orders: 0, cents: 0 };
    s.orders += 1; s.cents += o.totalCents; stats.set(o.customerId, s);
  }

  return (
    <div className="admin-page stack-lg">
      <header className="admin-head">
        <h1 className="h-section">{t('admin.nav.customers')} ({shown.length})</h1>
        <Link href="/admin/customers/new" className="btn">+ {t('admin.nav.newCustomer')}</Link>
      </header>
      <nav className="chips" aria-label={t('admin.col.status')}>
        <Link href="/admin/customers" aria-current={!filter ? 'true' : undefined}>{t('admin.all')} ({all.length})</Link>
        {STATUSES.map((s) => (
          <Link key={s} href={`/admin/customers?status=${s}`} aria-current={filter === s ? 'true' : undefined}>
            {t(`admin.statuses.${s}`)} ({all.filter((c) => c.status === s).length})
          </Link>
        ))}
      </nav>
      <div className="table-wrap">
        <table className="table table--data">
          <thead>
            <tr>
              <th>{t('admin.col.business')}</th><th>{t('admin.col.contact')}</th><th>{t('admin.col.status')}</th>
              <th>{t('admin.col.tier')}</th><th>{t('admin.col.credit')}</th><th className="num">{t('admin.col.sales')}</th>
              <th>{t('admin.col.access')}</th><th><span className="sr-only">—</span></th>
            </tr>
          </thead>
          <tbody>
            {shown.map((c) => {
              const app = applications.find((a) => a.email.toLowerCase() === c.email.toLowerCase());
              const s = stats.get(c.id);
              return (
                <CustomerRow
                  key={`${c.id}-${c.status}-${c.priceTier}-${c.invoiceTermsDays}-${c.hasLogin}`}
                  id={c.id}
                  status={c.status}
                  priceTier={c.priceTier}
                  invoiceTermsDays={c.invoiceTermsDays}
                  hasLogin={c.hasLogin !== false}
                  who={
                    <>
                      <strong>{c.businessName}</strong>
                      {app && <><br /><small className="hint">{app.city}, {app.province} · {t('admin.kgMonth', { kg: app.estimatedKgPerMonth })}</small></>}
                      {app?.message && <><br /><small className="hint">“{app.message}”</small></>}
                      <br /><small className="hint">{formatDate(c.createdAt, locale)}</small>
                    </>
                  }
                  contact={
                    <>
                      {c.contactName}<br />
                      <a className="link" href={`mailto:${c.email}`}><small>{c.email}</small></a>
                      {c.phone && <><br /><small>{c.phone}</small></>}
                    </>
                  }
                  stats={s ? <>{formatMoney(s.cents, locale)}<br /><small className="hint">{t('admin.ordersCount', { count: s.orders })}</small></> : '—'}
                />
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
