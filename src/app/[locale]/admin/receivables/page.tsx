import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { StatTile } from '@/components/admin-charts';
import { MarkPaidButton, UnmarkPaidButton } from '@/components/admin-receivables';
import { repo } from '@/lib/db';
import { BUCKETS, buildReceivables, dayKey, type AgingBucket } from '@/lib/receivables';
import { formatDate, formatMoney } from '@/lib/format';
import type { Locale } from '@/lib/types';

/**
 * Cuentas por cobrar: pedidos con factura (crédito) sin cobrar, de lo más vencido a lo más nuevo.
 * Antigüedad: al corriente · vence en 7 días · vencida 1–30 · 31–60 · más de 60 días.
 */
export default async function ReceivablesPage({ params, searchParams }: { params: Promise<{ locale: Locale }>; searchParams: Promise<{ bucket?: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const [t, orders, customers] = await Promise.all([getTranslations(), repo.orders.listAll(), repo.customers.list()]);
  const ar = buildReceivables(orders, customers);
  const filter = BUCKETS.includes(sp.bucket as AgingBucket) ? (sp.bucket as AgingBucket) : null;
  const items = filter ? ar.items.filter((r) => r.bucket === filter) : ar.items;
  const money = (c: number) => formatMoney(c, locale);
  const today = dayKey(new Date());
  const maxBucket = Math.max(1, ...Object.values(ar.byBucket));
  const recent = orders
    .filter((o) => o.paymentMethod === 'invoice' && o.paidAt)
    .sort((a, b) => (b.paidAt ?? '').localeCompare(a.paidAt ?? ''))
    .slice(0, 8);
  const names = new Map(customers.map((c) => [c.id, c.businessName]));

  return (
    <div className="admin-page stack-lg">
      <header className="admin-head">
        <div>
          <h1 className="h-section">{t('admin.nav.receivables')}</h1>
          <p className="hint">{t('admin.ar.lead')}</p>
        </div>
      </header>

      <section className="tiles">
        <StatTile label={t('admin.ar.total')} value={money(ar.total)} hint={t('admin.ar.invoices', { n: ar.items.length })} />
        <StatTile label={t('admin.ar.overdue')} value={money(ar.overdue)} hint={ar.overdue ? t('admin.ar.overdueHint') : t('admin.ar.noneOverdue')} />
        <StatTile label={t('admin.ar.dueSoon')} value={money(ar.dueSoon)} />
        <StatTile label={t('admin.ar.collected')} value={money(ar.collectedThisMonth)} />
      </section>

      <section className="panel-grid">
        <article className="card">
          <h2 className="card__title">{t('admin.ar.aging')}</h2>
          <ul className="aging">
            {BUCKETS.map((b) => (
              <li key={b}>
                <Link href={filter === b ? '/admin/receivables' : `/admin/receivables?bucket=${b}`} className={`aging__row aging__row--${b}`} aria-current={filter === b ? 'true' : undefined}>
                  <span>{t(`admin.ar.buckets.${b}`)}</span>
                  <span className="aging__bar" aria-hidden="true"><span style={{ width: `${(ar.byBucket[b] / maxBucket) * 100}%` }} /></span>
                  <strong className="nums">{money(ar.byBucket[b])}</strong>
                </Link>
              </li>
            ))}
          </ul>
        </article>
        <article className="card">
          <h2 className="card__title">{t('admin.ar.byCustomer')}</h2>
          {ar.byCustomer.length ? (
            <table className="table">
              <tbody>
                {ar.byCustomer.map((c) => (
                  <tr key={c.customerId}>
                    <td><Link className="link" href={`/admin/customers/${c.customerId}`}>{c.customer?.businessName ?? '—'}</Link><br /><small className="hint">{t('admin.ar.invoices', { n: c.count })}</small></td>
                    <td className="num"><strong>{money(c.total)}</strong>{c.overdue > 0 && <><br /><small className="is-negative">{t('admin.ar.overdueAmount', { v: money(c.overdue) })}</small></>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <p className="hint">{t('admin.ar.allPaid')}</p>}
        </article>
      </section>

      <section className="card">
        <div className="admin-head">
          <h2 className="card__title">{filter ? t(`admin.ar.buckets.${filter}`) : t('admin.ar.open')}</h2>
          {filter && <Link className="link" href="/admin/receivables">{t('admin.fin.exp.showAll')}</Link>}
        </div>
        {items.length ? (
          <div className="table-wrap">
            <table className="table table--data">
              <thead>
                <tr><th>{t('admin.ar.invoice')}</th><th>{t('admin.col.customer')}</th><th>{t('admin.ar.issued')}</th><th>{t('admin.ar.due')}</th><th>{t('admin.col.status')}</th><th className="num">{t('admin.col.total')}</th><th><span className="sr-only">—</span></th></tr>
              </thead>
              <tbody>
                {items.map((r) => (
                  <tr key={r.order.id}>
                    <td><Link className="link" href={`/admin/orders/${r.order.id}`}><strong className="nums">{r.order.number}</strong></Link></td>
                    <td><Link className="link" href={`/admin/customers/${r.order.customerId}`}>{r.customer?.businessName ?? '—'}</Link><br /><small className="hint">{t('admin.days', { days: r.termsDays })}</small></td>
                    <td className="nums">{formatDate(r.issued, locale)}</td>
                    <td className="nums">{formatDate(r.due, locale)}</td>
                    <td>
                      <span className={`ar-pill ar-pill--${r.bucket}`}>
                        {r.daysLeft < 0 ? t('admin.ar.daysLate', { n: -r.daysLeft }) : r.daysLeft === 0 ? t('admin.ar.dueToday') : t('admin.ar.daysLeft', { n: r.daysLeft })}
                      </span>
                    </td>
                    <td className="num"><strong>{money(r.order.totalCents)}</strong></td>
                    <td><MarkPaidButton id={r.order.id} today={today} label={`${r.order.number} · ${r.customer?.businessName ?? ''} · ${money(r.order.totalCents)}`} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="hint">{t('admin.ar.allPaid')}</p>}
      </section>

      {recent.length > 0 && (
        <section className="card">
          <h2 className="card__title">{t('admin.ar.recent')}</h2>
          <div className="table-wrap">
            <table className="table table--data">
              <thead><tr><th>{t('admin.ar.invoice')}</th><th>{t('admin.col.customer')}</th><th>{t('admin.ar.paidOn')}</th><th>{t('admin.ar.method')}</th><th className="num">{t('admin.col.total')}</th><th><span className="sr-only">—</span></th></tr></thead>
              <tbody>
                {recent.map((o) => (
                  <tr key={o.id}>
                    <td><Link className="link nums" href={`/admin/orders/${o.id}`}>{o.number}</Link></td>
                    <td>{names.get(o.customerId) ?? '—'}</td>
                    <td className="nums">{formatDate(o.paidAt!, locale)}</td>
                    <td>{o.paidNote || '—'}</td>
                    <td className="num">{money(o.totalCents)}</td>
                    <td><UnmarkPaidButton id={o.id} label={`${o.number} · ${money(o.totalCents)}`} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
