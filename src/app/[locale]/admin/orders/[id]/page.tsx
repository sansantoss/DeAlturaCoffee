import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { OrderStatusForm } from '@/components/admin';
import { PrintButton } from '@/components/PrintButton';
import { repo } from '@/lib/db';
import { formatDate, formatMoney } from '@/lib/format';
import type { Locale } from '@/lib/types';

/** Detalle del pedido: qué tostar, a dónde va, cuánto se cobró. Se imprime como hoja de empaque. */
export default async function AdminOrderPage({ params }: { params: Promise<{ locale: Locale; id: string }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const [t, order] = await Promise.all([getTranslations(), repo.orders.getById(id)]);
  if (!order) notFound();
  const customer = await repo.customers.getById(order.customerId);
  const money = (c: number) => formatMoney(c, locale);
  const nf = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 });
  const kg = (l: (typeof order.lines)[number]) => (l.grams * l.quantity) / 1000;
  const totalKg = order.lines.reduce((s, l) => s + kg(l), 0);
  const byRoast = new Map<string, number>();
  for (const l of order.lines) byRoast.set(l.roast, (byRoast.get(l.roast) ?? 0) + kg(l));
  const a = order.shippingAddress;

  return (
    <div className="admin-page stack-lg order-detail">
      <p className="no-print"><Link href="/admin/orders" className="link">← {t('admin.nav.orders')}</Link></p>
      <header className="admin-head">
        <div>
          <p className="kicker">{t('admin.od.title')}</p>
          <h1 className="h-section nums">{order.number}</h1>
          <p className="hint">{formatDate(order.createdAt, locale)} · {order.paymentMethod === 'invoice' ? t('admin.payInvoice') : t('admin.payCard')}</p>
        </div>
        <div className="admin-head__actions">
          <span className="no-print"><OrderStatusForm id={order.id} status={order.status} key={order.status} /></span>
          <span className="no-print"><PrintButton label={t('admin.od.print')} /></span>
        </div>
      </header>

      <section className="panel-grid">
        <article className="card">
          <h2 className="card__title">{t('admin.od.customer')}</h2>
          {customer ? (
            <dl className="summary">
              <div><dt>{t('apply.business')}</dt><dd><Link className="link" href={`/admin/customers/${customer.id}`}>{customer.businessName}</Link></dd></div>
              <div><dt>{t('apply.contact')}</dt><dd>{customer.contactName}</dd></div>
              <div><dt>{t('apply.email')}</dt><dd><a className="link" href={`mailto:${customer.email}`}>{customer.email}</a></dd></div>
              {customer.phone && <div><dt>{t('apply.phone')}</dt><dd><a className="link" href={`tel:${customer.phone}`}>{customer.phone}</a></dd></div>}
            </dl>
          ) : <p className="hint">—</p>}
        </article>
        <article className="card">
          <h2 className="card__title">{t('order.deliverTo')}</h2>
          <address className="od-address">
            <strong>{a.label}</strong><br />
            {a.line1}{a.line2 ? <><br />{a.line2}</> : null}<br />
            {a.city}, {a.province} {a.postalCode}
          </address>
          {order.notes && <p className="notice" style={{ marginTop: '1rem' }}>“{order.notes}”</p>}
        </article>
      </section>

      <section className="card">
        <h2 className="card__title">{t('admin.od.lines')}</h2>
        <div className="table-wrap">
          <table className="table table--data">
            <thead>
              <tr><th>{t('admin.od.coffee')}</th><th>{t('product.format')}</th><th>{t('product.roast')}</th><th className="num">{t('product.quantity')}</th><th className="num">kg</th><th className="num">{t('admin.od.unit')}</th><th className="num">{t('order.subtotal')}</th></tr>
            </thead>
            <tbody>
              {order.lines.map((l, i) => (
                <tr key={i}>
                  <td><strong>{l.productName}</strong><br /><small className="hint nums">{l.sku}</small></td>
                  <td>{l.formatLabel}</td>
                  <td>{t(`formats.${l.roast}` as 'formats.medium')}</td>
                  <td className="num"><strong>{l.quantity}</strong></td>
                  <td className="num">{nf.format(kg(l))}</td>
                  <td className="num">{money(l.unitPriceCents)}</td>
                  <td className="num">{money(l.unitPriceCents * l.quantity)}</td>
                </tr>
              ))}
              <tr className="table__total">
                <td colSpan={4}><strong>{t('admin.od.toRoast')}:</strong> {[...byRoast.entries()].map(([r, k]) => `${t(`formats.${r}` as 'formats.medium')} ${nf.format(k)} kg`).join(' · ')}</td>
                <td className="num"><strong>{nf.format(totalKg)}</strong></td><td /><td className="num">{money(order.subtotalCents)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="totals od-totals">
          <div><span>{t('order.subtotal')}</span><span className="nums">{money(order.subtotalCents)}</span></div>
          <div><span>{t('order.shipping')}</span><span className="nums">{order.shippingCents ? money(order.shippingCents) : t('order.free')}</span></div>
          <div><span>{t('order.tax')}</span><span className="nums">{money(order.taxCents)}</span></div>
          <div className="grand"><span>{t('order.total')}</span><span className="nums">{money(order.totalCents)}</span></div>
        </div>
      </section>
    </div>
  );
}
