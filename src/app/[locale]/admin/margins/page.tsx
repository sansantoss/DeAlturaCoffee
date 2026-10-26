import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { StatTile } from '@/components/admin-charts';
import { repo } from '@/lib/db';
import { buildInventory, buildMargins, LB_PER_KG } from '@/lib/finance';
import { formatMoney } from '@/lib/format';
import type { Locale } from '@/lib/types';

/**
 * Márgenes por mes: ventas de café, costo del café vendido (costo promedio por kg tostado:
 * café verde aterrizado + tostador + insumos), margen bruto, gastos operativos y utilidad.
 */
export default async function MarginsPage({ params, searchParams }: { params: Promise<{ locale: Locale }>; searchParams: Promise<{ year?: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const thisYear = Number(new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Toronto', year: 'numeric' }).format(new Date()));
  const year = /^\d{4}$/.test(sp.year ?? '') ? Number(sp.year) : thisYear;
  const [t, orders, lots, batches, expenses] = await Promise.all([
    getTranslations(), repo.orders.listAll(), repo.lots.list(), repo.batches.list(), repo.expenses.list(),
  ]);
  const inv = buildInventory(lots, batches, orders);
  const months = buildMargins(year, orders, inv, expenses);
  const money = (c: number) => formatMoney(Math.round(c), locale);
  const nf = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
  const pct = (a: number, b: number) => (b ? `${nf.format((a / b) * 100)}%` : '—');
  const fmtMonth = (m: string) => new Intl.DateTimeFormat(locale, { month: 'short', timeZone: 'UTC' }).format(new Date(`${m}-15T12:00:00Z`));

  const sum = months.reduce(
    (s, m) => ({ sales: s.sales + m.salesCad, ship: s.ship + m.shippingCad, cogs: s.cogs + m.cogsCad, gross: s.gross + m.grossCad, exp: s.exp + m.expensesCad, net: s.net + m.netCad, kg: s.kg + m.kg }),
    { sales: 0, ship: 0, cogs: 0, gross: 0, exp: 0, net: 0, kg: 0 },
  );
  const hasCost = inv.avgCostKgCad > 0;
  const pricePerKg = sum.kg ? sum.sales / sum.kg : 0;
  const costPerKg = sum.kg ? sum.cogs / sum.kg : 0;

  return (
    <div className="admin-page stack-lg">
      <header className="admin-head">
        <h1 className="h-section">{t('admin.nav.margins')}</h1>
        <nav className="seg" aria-label="Año">
          {[thisYear - 1, thisYear].map((y) => (
            <Link key={y} href={`/admin/margins?year=${y}`} aria-current={y === year ? 'true' : undefined}>{y}</Link>
          ))}
        </nav>
      </header>

      {!hasCost && <p className="notice">{t('admin.fin.mar.noCost')} <Link className="link" href="/admin/inventory/lots/new">{t('admin.fin.lot.new')}</Link></p>}

      <section className="tiles">
        <StatTile label={t('admin.fin.mar.sales')} value={money(sum.sales)} hint={t('admin.fin.mar.shipping', { v: money(sum.ship) })} />
        <StatTile label={t('admin.fin.mar.cogs')} value={hasCost ? money(sum.cogs) : '—'} hint={hasCost ? `${nf.format(sum.kg)} kg` : undefined} />
        <StatTile label={t('admin.fin.mar.gross')} value={hasCost ? money(sum.gross) : '—'} hint={hasCost ? t('admin.fin.mar.ofSales', { pct: pct(sum.gross, sum.sales) }) : undefined} />
        <StatTile label={t('admin.fin.mar.net')} value={hasCost ? money(sum.net) : '—'} hint={t('admin.fin.mar.afterExpenses', { v: money(sum.exp) })} />
      </section>

      {hasCost && sum.kg > 0 && (
        <section className="card">
          <h2 className="card__title">{t('admin.fin.mar.perKgTitle')}</h2>
          <div className="kg-compare">
            <div><span className="hint">{t('admin.fin.mar.pricePerKg')}</span><strong className="nums">{money(pricePerKg)}</strong><small className="hint">{t('admin.fin.perLb', { v: money(pricePerKg / LB_PER_KG) })}</small></div>
            <div><span className="hint">{t('admin.fin.mar.costPerKg')}</span><strong className="nums">{money(costPerKg)}</strong><small className="hint">{t('admin.fin.perLb', { v: money(costPerKg / LB_PER_KG) })}</small></div>
            <div><span className="hint">{t('admin.fin.mar.marginPerKg')}</span><strong className="nums">{money(pricePerKg - costPerKg)}</strong><small className="hint">{pct(pricePerKg - costPerKg, pricePerKg)}</small></div>
          </div>
        </section>
      )}

      <section className="card">
        <h2 className="card__title">{t('admin.fin.mar.byMonth', { year })}</h2>
        <div className="table-wrap">
          <table className="table table--data">
            <thead>
              <tr>
                <th>{t('admin.fin.mar.month')}</th><th className="num">kg</th><th className="num">{t('admin.fin.mar.sales')}</th>
                <th className="num">{t('admin.fin.mar.cogs')}</th><th className="num">{t('admin.fin.mar.gross')}</th><th className="num">%</th>
                <th className="num">{t('admin.fin.mar.expenses')}</th><th className="num">{t('admin.fin.mar.net')}</th>
              </tr>
            </thead>
            <tbody>
              {months.map((m) => {
                const empty = !m.orders && !m.expensesCad;
                return (
                  <tr key={m.month} className={empty ? 'is-dim' : undefined}>
                    <td>{fmtMonth(m.month)}</td>
                    <td className="num">{nf.format(m.kg)}</td>
                    <td className="num">{money(m.salesCad)}</td>
                    <td className="num">{hasCost ? money(m.cogsCad) : '—'}</td>
                    <td className="num">{hasCost ? money(m.grossCad) : '—'}</td>
                    <td className="num">{hasCost ? pct(m.grossCad, m.salesCad) : '—'}</td>
                    <td className="num">{money(m.expensesCad)}</td>
                    <td className={`num ${hasCost && m.netCad < 0 ? 'is-negative' : ''}`}><strong>{hasCost ? money(m.netCad) : '—'}</strong></td>
                  </tr>
                );
              })}
              <tr className="table__total">
                <td><strong>{t('admin.fin.mar.total')}</strong></td>
                <td className="num">{nf.format(sum.kg)}</td>
                <td className="num"><strong>{money(sum.sales)}</strong></td>
                <td className="num">{hasCost ? money(sum.cogs) : '—'}</td>
                <td className="num"><strong>{hasCost ? money(sum.gross) : '—'}</strong></td>
                <td className="num">{hasCost ? pct(sum.gross, sum.sales) : '—'}</td>
                <td className="num">{money(sum.exp)}</td>
                <td className="num"><strong>{hasCost ? money(sum.net) : '—'}</strong></td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="hint" style={{ marginTop: '1rem' }}>{t('admin.fin.mar.how')}</p>
      </section>
    </div>
  );
}
