import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { StatTile } from '@/components/admin-charts';
import { repo } from '@/lib/db';
import { formatDate, formatMoney } from '@/lib/format';
import type { Locale } from '@/lib/types';

/** Ficha del cliente: datos, dirección, condiciones y su historial de pedidos. */
export default async function AdminCustomerPage({ params }: { params: Promise<{ locale: Locale; id: string }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const [t, customer, orders] = await Promise.all([getTranslations(), repo.customers.getById(id), repo.orders.listByCustomer(id)]);
  if (!customer) notFound();
  const live = orders.filter((o) => o.status !== 'cancelled');
  const money = (c: number) => formatMoney(c, locale);
  const nf = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
  const spent = live.reduce((s, o) => s + o.totalCents, 0);
  const kg = live.reduce((s, o) => s + o.lines.reduce((x, l) => x + (l.grams * l.quantity) / 1000, 0), 0);
  const roastKg = new Map<string, number>();
  for (const o of live) for (const l of o.lines) roastKg.set(l.roast, (roastKg.get(l.roast) ?? 0) + (l.grams * l.quantity) / 1000);
  const fav = [...roastKg.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  const last = live[0]?.createdAt;
  const a = customer.addresses.find((x) => x.isDefault) ?? customer.addresses[0];

  return (
    <div className="admin-page stack-lg">
      <p><Link href="/admin/customers" className="link">← {t('admin.nav.customers')}</Link></p>
      <header className="admin-head">
        <div>
          <p className="kicker">{t(`apply.types.${customer.businessType}`)}</p>
          <h1 className="h-section">{customer.businessName}</h1>
          <p className="hint">{t('admin.cd.since', { date: formatDate(customer.createdAt, locale) })}</p>
        </div>
        <Link className="btn" href={`/admin/orders/new?customer=${customer.id}`}>+ {t('admin.nav.newOrder')}</Link>
      </header>

      <section className="tiles">
        <StatTile label={t('admin.cd.spent')} value={money(spent)} hint={t('admin.ordersCount', { count: live.length })} />
        <StatTile label={t('admin.kpi.kg')} value={`${nf.format(kg)} kg`} hint={fav ? t('admin.cd.fav', { roast: t(`formats.${fav}` as 'formats.medium') }) : undefined} />
        <StatTile label={t('admin.kpi.avg')} value={live.length ? money(Math.round(spent / live.length)) : '—'} />
        <StatTile label={t('admin.cd.last')} value={last ? formatDate(last, locale) : '—'} />
      </section>

      <section className="panel-grid">
        <article className="card">
          <h2 className="card__title">{t('account.profile')}</h2>
          <dl className="summary">
            <div><dt>{t('apply.contact')}</dt><dd>{customer.contactName}</dd></div>
            <div><dt>{t('apply.email')}</dt><dd><a className="link" href={`mailto:${customer.email}`}>{customer.email}</a></dd></div>
            {customer.phone && <div><dt>{t('apply.phone')}</dt><dd><a className="link" href={`tel:${customer.phone}`}>{customer.phone}</a></dd></div>}
            {customer.gstNumber && <div><dt>GST / HST #</dt><dd>{customer.gstNumber}</dd></div>}
            <div><dt>{t('account.language')}</dt><dd>{t(`lang.${customer.preferredLocale}`)}</dd></div>
          </dl>
        </article>
        <article className="card">
          <h2 className="card__title">{t('admin.cd.terms')}</h2>
          <dl className="summary">
            <div><dt>{t('admin.col.status')}</dt><dd><span className={`pill pill--${customer.status}`}>{t(`admin.statuses.${customer.status}`)}</span></dd></div>
            <div><dt>{t('admin.tier')}</dt><dd>{t(`admin.tiers.${customer.priceTier}`)}</dd></div>
            <div><dt>{t('admin.terms')}</dt><dd>{customer.invoiceTermsDays ? t('admin.days', { days: customer.invoiceTermsDays }) : t('admin.termsNone')}</dd></div>
            <div><dt>{t('account.addresses')}</dt><dd>{a ? `${a.line1}${a.line2 ? `, ${a.line2}` : ''}, ${a.city}, ${a.province} ${a.postalCode}` : '—'}</dd></div>
          </dl>
          <p className="hint" style={{ marginTop: '1rem' }}>{t('admin.cd.editHint')}</p>
        </article>
      </section>

      <section className="card">
        <h2 className="card__title">{t('admin.nav.orders')}</h2>
        {orders.length ? (
          <div className="table-wrap">
            <table className="table table--data">
              <thead><tr><th>{t('admin.col.order')}</th><th>{t('admin.col.date')}</th><th>{t('admin.col.product')}</th><th className="num">kg</th><th className="num">{t('admin.col.total')}</th><th>{t('admin.col.status')}</th></tr></thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id}>
                    <td><Link className="link" href={`/admin/orders/${o.id}`}><strong className="nums">{o.number}</strong></Link></td>
                    <td className="nums">{formatDate(o.createdAt, locale)}</td>
                    <td><small>{o.lines.map((l) => `${l.quantity} × ${l.formatLabel} · ${t(`formats.${l.roast}` as 'formats.medium')}`).join(' / ')}</small></td>
                    <td className="num">{nf.format(o.lines.reduce((x, l) => x + (l.grams * l.quantity) / 1000, 0))}</td>
                    <td className="num">{money(o.totalCents)}</td>
                    <td><span className={`status status--${o.status}`}>{t(`order.status.${o.status}`)}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="hint">{t('admin.ordersNone')}</p>}
      </section>
    </div>
  );
}
