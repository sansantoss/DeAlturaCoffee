import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { BarList, ColumnChart, StatTile } from '@/components/admin-charts';
import { repo } from '@/lib/db';
import { buildDashboard, PERIODS, type Period } from '@/lib/metrics';
import { formatMoney } from '@/lib/format';
import type { Locale, OrderStatus } from '@/lib/types';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const t = await getTranslations({ locale: (await params).locale, namespace: 'admin' });
  return { title: t('title'), robots: { index: false } };
}

const STATUS_ORDER: OrderStatus[] = ['awaiting_payment', 'invoiced', 'paid', 'roasting', 'shipped', 'delivered', 'cancelled'];

export default async function AdminOverview({
  params, searchParams,
}: { params: Promise<{ locale: Locale }>; searchParams: Promise<{ period?: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const period: Period = PERIODS.includes(sp.period as Period) ? (sp.period as Period) : 'month';
  const [t, orders, customers] = await Promise.all([getTranslations(), repo.orders.listAll(), repo.customers.list()]);
  const d = buildDashboard(orders, customers, period, locale);
  const pendingAccounts = customers.filter((c) => c.status === 'pending');

  const nf = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
  const compactMoney = (cents: number) =>
    new Intl.NumberFormat(locale === 'en' ? 'en-CA' : locale === 'fr' ? 'fr-CA' : 'es-MX', {
      style: 'currency', currency: 'CAD', notation: 'compact', maximumFractionDigits: 1,
    }).format(cents / 100);

  const delta = (cur: number, prev: number) => {
    if (!prev) return cur ? { text: t('admin.kpi.new'), dir: 'up' as const } : undefined;
    const pct = Math.round(((cur - prev) / prev) * 100);
    return { text: `${pct > 0 ? '+' : ''}${pct}% ${t('admin.kpi.vs')}`, dir: pct > 0 ? 'up' as const : pct < 0 ? 'down' as const : 'flat' as const };
  };

  return (
    <div className="admin-page stack-lg">
      <header className="admin-head">
        <h1 className="h-section">{t('admin.nav.overview')}</h1>
        <nav className="seg" aria-label={t('admin.col.period')}>
          {PERIODS.map((p) => (
            <Link key={p} href={`/admin?period=${p}`} aria-current={p === period ? 'true' : undefined}>{t(`admin.periods.${p}`)}</Link>
          ))}
        </nav>
      </header>

      <section className="tiles" aria-label={t('admin.periods.' + period)}>
        <StatTile label={t('admin.kpi.sales')} value={formatMoney(d.totals.cents, locale)} delta={delta(d.totals.cents, d.previous.cents)} />
        <StatTile label={t('admin.kpi.orders')} value={nf.format(d.totals.orders)} delta={delta(d.totals.orders, d.previous.orders)} />
        <StatTile label={t('admin.kpi.kg')} value={`${nf.format(d.totals.kg)} kg`} delta={delta(d.totals.kg, d.previous.kg)} />
        <StatTile label={t('admin.kpi.avg')} value={formatMoney(d.totals.avgCents, locale)} delta={delta(d.totals.avgCents, d.previous.avgCents)} />
      </section>

      <section className="panel-grid">
        <article className="card card--wide">
          <h2 className="card__title">{period === 'year' ? t('admin.charts.salesMonth') : t('admin.charts.salesDay')}</h2>
          <ColumnChart
            label={period === 'year' ? t('admin.charts.salesMonth') : t('admin.charts.salesDay')}
            empty={t('admin.charts.empty')}
            formatTick={(v) => compactMoney(v)}
            columns={d.series.map((b) => ({
              key: b.key, label: b.label, value: b.cents, current: b.current,
              display: formatMoney(b.cents, locale), detail: t('admin.ordersCount', { count: b.orders }),
            }))}
          />
          <details className="table-toggle">
            <summary>{t('admin.charts.table')}</summary>
            <table className="table">
              <thead><tr><th>{t('admin.col.date')}</th><th className="num">{t('admin.col.orders')}</th><th className="num">{t('admin.col.sales')}</th></tr></thead>
              <tbody>
                {d.series.filter((b) => b.orders > 0).map((b) => (
                  <tr key={b.key}><td>{b.label}</td><td className="num">{b.orders}</td><td className="num">{formatMoney(b.cents, locale)}</td></tr>
                ))}
              </tbody>
            </table>
          </details>
        </article>

        <article className="card">
          <h2 className="card__title">{t('admin.charts.products')}</h2>
          <BarList
            label={t('admin.charts.products')}
            empty={t('admin.charts.empty')}
            items={d.products.map((p) => ({ key: p.productId, label: p.name, value: p.kg, display: `${nf.format(p.kg)} kg`, sub: formatMoney(p.cents, locale) }))}
          />
        </article>

        <article className="card">
          <h2 className="card__title">{t('admin.charts.customers')}</h2>
          <BarList
            label={t('admin.charts.customers')}
            empty={t('admin.charts.empty')}
            items={d.customers.map((c) => ({ key: c.id, label: c.name, value: c.cents, display: formatMoney(c.cents, locale), sub: `${t('admin.ordersCount', { count: c.orders })} · ${nf.format(c.kg)} kg` }))}
          />
        </article>

        <article className="card">
          <h2 className="card__title">{t('admin.charts.status')}</h2>
          <table className="table">
            <tbody>
              {STATUS_ORDER.map((s) => (
                <tr key={s}>
                  <td><Link className="link" href={`/admin/orders?status=${s}`}><span className={`status status--${s}`}>{t(`order.status.${s}`)}</span></Link></td>
                  <td className="num"><strong>{d.byStatus[s]}</strong></td>
                </tr>
              ))}
            </tbody>
          </table>
        </article>

        <article className="card">
          <h2 className="card__title">{t('admin.kpi.pendingAccounts')} ({pendingAccounts.length})</h2>
          {pendingAccounts.length === 0 ? (
            <p className="hint">{t('admin.pendingNone')}</p>
          ) : (
            <ul className="mini-list">
              {pendingAccounts.slice(0, 6).map((c) => (
                <li key={c.id}><Link className="link" href="/admin/customers?status=pending">{c.businessName}</Link><span className="hint">{c.email}</span></li>
              ))}
            </ul>
          )}
          <p className="hint" style={{ marginTop: '1rem' }}>{t('admin.kpi.toFulfil')}: <strong>{d.toFulfil}</strong></p>
        </article>
      </section>
    </div>
  );
}
