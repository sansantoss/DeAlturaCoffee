import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { OrderRow } from '@/components/admin';
import { repo } from '@/lib/db';
import { formatDate, formatMoney } from '@/lib/format';
import type { Locale, OrderStatus } from '@/lib/types';

const STATUSES: OrderStatus[] = ['awaiting_payment', 'invoiced', 'paid', 'roasting', 'shipped', 'delivered', 'cancelled'];

export default async function AdminOrders({ params, searchParams }: { params: Promise<{ locale: Locale }>; searchParams: Promise<{ status?: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const filter = STATUSES.includes(sp.status as OrderStatus) ? (sp.status as OrderStatus) : null;
  const [t, orders, customers] = await Promise.all([getTranslations(), repo.orders.listAll(), repo.customers.list()]);
  const names = new Map(customers.map((c) => [c.id, c.businessName]));
  const shown = filter ? orders.filter((o) => o.status === filter) : orders;
  const kgOf = (o: (typeof orders)[number]) => o.lines.reduce((s, l) => s + (l.grams * l.quantity) / 1000, 0);
  const nf = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 });

  return (
    <div className="admin-page stack-lg">
      <header className="admin-head">
        <h1 className="h-section">{t('admin.nav.orders')} ({shown.length})</h1>
        <div className="admin-head__actions">
          <a className="btn btn--ghost" href="/api/admin/export?type=orders">{t('admin.fin.st.excel')}</a>
          <Link href="/admin/orders/new" className="btn">+ {t('admin.nav.newOrder')}</Link>
        </div>
      </header>
      <nav className="chips" aria-label={t('admin.col.status')}>
        <Link href="/admin/orders" aria-current={!filter ? 'true' : undefined}>{t('admin.all')} ({orders.length})</Link>
        {STATUSES.map((s) => (
          <Link key={s} href={`/admin/orders?status=${s}`} aria-current={filter === s ? 'true' : undefined}>
            {t(`order.status.${s}`)} ({orders.filter((o) => o.status === s).length})
          </Link>
        ))}
      </nav>
      {shown.length === 0 ? (
        <p className="notice">{t('admin.ordersNone')}</p>
      ) : (
        <div className="table-wrap">
          <table className="table table--data">
            <thead>
              <tr>
                <th>{t('admin.col.order')}</th><th>{t('admin.col.date')}</th><th>{t('admin.col.customer')}</th>
                <th>{t('admin.col.product')}</th><th className="num">{t('admin.col.kg')}</th><th>{t('admin.col.payment')}</th>
                <th className="num">{t('admin.col.total')}</th><th>{t('admin.col.status')}</th><th><span className="sr-only">—</span></th>
              </tr>
            </thead>
            <tbody>
              {shown.map((o) => (
                <OrderRow
                  key={`${o.id}-${o.status}`}
                  id={o.id}
                  status={o.status}
                  cells={
                    <>
                      <td><strong className="nums">{o.number}</strong></td>
                      <td className="nums">{formatDate(o.createdAt, locale)}</td>
                      <td>{names.get(o.customerId) ?? '—'}<br /><small className="hint">{o.shippingAddress.city}, {o.shippingAddress.province}</small></td>
                      <td><small>{o.lines.map((l) => `${l.quantity} × ${l.productName} · ${l.formatLabel}`).join(' / ')}</small>{o.notes ? <><br /><small className="hint">“{o.notes}”</small></> : null}</td>
                      <td className="num">{nf.format(kgOf(o))}</td>
                      <td>{o.paymentMethod === 'invoice' ? t('admin.payInvoice') : t('admin.payCard')}</td>
                      <td className="num"><strong>{formatMoney(o.totalCents, locale)}</strong></td>
                    </>
                  }
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
