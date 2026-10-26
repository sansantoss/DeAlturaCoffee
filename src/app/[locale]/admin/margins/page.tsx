import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { StatTile } from '@/components/admin-charts';
import { PrintButton } from '@/components/PrintButton';
import { repo } from '@/lib/db';
import { buildInventory, buildMargins, buildStatement, LB_PER_KG, periodMonths } from '@/lib/finance';
import { formatMoney } from '@/lib/format';
import type { Locale } from '@/lib/types';

const PRESETS = ['month', 'prev', 'quarter', 'year'] as const;

/**
 * Estado de resultados (estructura de La Sirena): ingresos → costo del café → utilidad bruta →
 * gastos de operación por etiqueta → utilidad de operación, cada línea con su % de los ingresos.
 * Abajo, mes a mes del año.
 */
export default async function MarginsPage({ params, searchParams }: { params: Promise<{ locale: Locale }>; searchParams: Promise<{ p?: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const p = PRESETS.includes(sp.p as (typeof PRESETS)[number]) || /^\d{4}-\d{2}$/.test(sp.p ?? '') ? sp.p! : 'month';
  const months = periodMonths(p);
  const year = Number(months[months.length - 1].slice(0, 4));
  const [t, orders, lots, batches, expenses] = await Promise.all([
    getTranslations(), repo.orders.listAll(), repo.lots.list(), repo.batches.list(), repo.expenses.list(),
  ]);
  const st = buildStatement(months, orders, lots, batches, expenses);
  const inv = buildInventory(lots, batches, orders);
  const byMonth = buildMargins(year, orders, inv, expenses);

  const money = (c: number) => formatMoney(Math.round(c), locale);
  const nf = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
  const pct = (a: number) => (st.revenueCad ? `${nf.format((a / st.revenueCad) * 100)}%` : '—');
  const pctOf = (a: number, b: number) => (b ? `${nf.format((a / b) * 100)}%` : '—');
  const fmtMonth = (m: string, style: 'short' | 'long' = 'long') =>
    new Intl.DateTimeFormat(locale, { month: style, year: style === 'long' ? 'numeric' : undefined, timeZone: 'UTC' }).format(new Date(`${m}-15T12:00:00Z`));
  const cap = (x: string) => x.charAt(0).toUpperCase() + x.slice(1);
  const periodLabel = cap(months.length === 1 ? fmtMonth(months[0]) : `${fmtMonth(months[0])} – ${fmtMonth(months[months.length - 1])}`);
  const tone = (v: number) => (v < 0 ? 'is-negative' : '');
  const pricePerKg = st.kg ? st.salesCad / st.kg : 0;
  const costPerKg = st.kg ? st.cogs.total / st.kg : 0;

  return (
    <div className="admin-page stack-lg statement-page">
      <header className="admin-head">
        <div>
          <h1 className="h-section">{t('admin.fin.st.title')}</h1>
          <p className="hint statement-period">{periodLabel}</p>
        </div>
        <div className="admin-head__actions no-print">
          <a className="btn btn--sm btn--ghost" href={`/api/admin/export?type=statement&p=${p}&locale=${locale}`}>{t('admin.fin.st.excel')}</a>
          <PrintButton label={t('admin.fin.st.print')} />
        </div>
      </header>

      <div className="statement-controls no-print">
        <nav className="seg" aria-label={t('admin.fin.st.period')}>
          {PRESETS.map((x) => (
            <Link key={x} href={`/admin/margins?p=${x}`} aria-current={p === x ? 'true' : undefined}>{t(`admin.fin.st.presets.${x}`)}</Link>
          ))}
        </nav>
        <form method="get" className="statement-month">
          <label className="field">
            <span className="sr-only">{t('admin.fin.st.pickMonth')}</span>
            <input className="input input--sm" type="month" name="p" defaultValue={/^\d{4}-\d{2}$/.test(p) ? p : months[months.length - 1]} />
          </label>
          <button className="btn btn--sm btn--ghost">{t('admin.fin.st.see')}</button>
        </form>
      </div>

      {!st.hasCost && <p className="notice no-print">{t('admin.fin.mar.noCost')} <Link className="link" href="/admin/inventory/lots/new">{t('admin.fin.lot.new')}</Link></p>}

      <section className="tiles">
        <StatTile label={t('admin.fin.st.revenue')} value={money(st.revenueCad)} hint={t('admin.fin.st.ordersKg', { orders: st.orders, kg: nf.format(st.kg) })} />
        <StatTile label={t('admin.fin.mar.gross')} value={st.hasCost ? money(st.grossCad) : '—'} hint={st.hasCost ? t('admin.fin.st.margin', { pct: pct(st.grossCad) }) : undefined} />
        <StatTile label={t('admin.fin.st.opex')} value={money(st.expensesCad)} hint={t('admin.fin.st.ofRevenue', { pct: pct(st.expensesCad) })} />
        <StatTile label={`★ ${t('admin.fin.st.operating')}`} value={st.hasCost ? money(st.operatingCad) : '—'} hint={st.hasCost ? t('admin.fin.st.keyMetric', { pct: pct(st.operatingCad) }) : undefined} />
      </section>

      <section className="card statement" aria-label={t('admin.fin.st.title')}>
        <table className="table statement__table">
          <thead>
            <tr><th>{t('admin.fin.st.concept')}</th><th className="num">CAD</th><th className="num">{t('admin.fin.st.pctRevenue')}</th></tr>
          </thead>
          <tbody>
            <tr className="statement__group"><td colSpan={3}>{t('admin.fin.st.income')}</td></tr>
            <tr><td className="indent">{t('admin.fin.mar.sales')}</td><td className="num">{money(st.salesCad)}</td><td className="num">{pct(st.salesCad)}</td></tr>
            <tr><td className="indent">{t('admin.fin.st.shipping')}</td><td className="num">{money(st.shippingCad)}</td><td className="num">{pct(st.shippingCad)}</td></tr>
            <tr className="statement__sum"><td>= {t('admin.fin.st.revenue')}</td><td className="num">{money(st.revenueCad)}</td><td className="num">100%</td></tr>

            <tr className="statement__group"><td colSpan={3}>{t('admin.fin.st.cogs')}</td></tr>
            <tr><td className="indent">{t('admin.fin.st.green')}</td><td className="num">{st.hasCost ? money(st.cogs.green) : '—'}</td><td className="num">{st.hasCost ? pct(st.cogs.green) : '—'}</td></tr>
            <tr><td className="indent">{t('admin.fin.st.roaster')}</td><td className="num">{st.hasCost ? money(st.cogs.roaster) : '—'}</td><td className="num">{st.hasCost ? pct(st.cogs.roaster) : '—'}</td></tr>
            <tr><td className="indent">{t('admin.fin.st.packaging')}</td><td className="num">{st.hasCost ? money(st.cogs.packaging) : '—'}</td><td className="num">{st.hasCost ? pct(st.cogs.packaging) : '—'}</td></tr>
            <tr className={`statement__sum ${tone(st.grossCad)}`}><td>= {t('admin.fin.mar.gross')}</td><td className="num">{st.hasCost ? money(st.grossCad) : '—'}</td><td className="num">{st.hasCost ? pct(st.grossCad) : '—'}</td></tr>

            <tr className="statement__group"><td colSpan={3}>{t('admin.fin.st.opexTitle')}</td></tr>
            {st.expensesByTag.length ? st.expensesByTag.map((e) => (
              <tr key={e.tag}><td className="indent">{e.tag}</td><td className="num">{money(e.cents)}</td><td className="num">{pct(e.cents)}</td></tr>
            )) : <tr><td className="indent hint" colSpan={3}>{t('admin.fin.exp.none')}</td></tr>}
            <tr className="statement__sum"><td>{t('admin.fin.st.opex')}</td><td className="num">{money(st.expensesCad)}</td><td className="num">{pct(st.expensesCad)}</td></tr>

            <tr className={`statement__total ${tone(st.operatingCad)}`}><td>= ★ {t('admin.fin.st.operating')}</td><td className="num">{st.hasCost ? money(st.operatingCad) : '—'}</td><td className="num">{st.hasCost ? pct(st.operatingCad) : '—'}</td></tr>
          </tbody>
        </table>
        <p className="hint" style={{ marginTop: '1rem' }}>{t('admin.fin.st.note')}</p>
      </section>

      {st.hasCost && st.kg > 0 && (
        <section className="card">
          <h2 className="card__title">{t('admin.fin.mar.perKgTitle')}</h2>
          <div className="kg-compare">
            <div><span className="hint">{t('admin.fin.mar.pricePerKg')}</span><strong className="nums">{money(pricePerKg)}</strong><small className="hint">{t('admin.fin.perLb', { v: money(pricePerKg / LB_PER_KG) })}</small></div>
            <div><span className="hint">{t('admin.fin.mar.costPerKg')}</span><strong className="nums">{money(costPerKg)}</strong><small className="hint">{t('admin.fin.perLb', { v: money(costPerKg / LB_PER_KG) })}</small></div>
            <div><span className="hint">{t('admin.fin.mar.marginPerKg')}</span><strong className="nums">{money(pricePerKg - costPerKg)}</strong><small className="hint">{pctOf(pricePerKg - costPerKg, pricePerKg)}</small></div>
          </div>
        </section>
      )}

      <section className="card">
        <h2 className="card__title">{t('admin.fin.mar.byMonth', { year })}</h2>
        <div className="table-wrap">
          <table className="table table--data">
            <thead>
              <tr>
                <th>{t('admin.fin.mar.month')}</th><th className="num">kg</th><th className="num">{t('admin.fin.st.revenue')}</th>
                <th className="num">{t('admin.fin.mar.cogs')}</th><th className="num">{t('admin.fin.mar.gross')}</th><th className="num">%</th>
                <th className="num">{t('admin.fin.mar.expenses')}</th><th className="num">{t('admin.fin.st.operating')}</th>
              </tr>
            </thead>
            <tbody>
              {byMonth.map((m) => {
                const empty = !m.orders && !m.expensesCad;
                return (
                  <tr key={m.month} className={`${empty ? 'is-dim' : ''} ${months.includes(m.month) ? 'is-current' : ''}`}>
                    <td><Link className="link" href={`/admin/margins?p=${m.month}`}>{fmtMonth(m.month, 'short')}</Link></td>
                    <td className="num">{nf.format(m.kg)}</td>
                    <td className="num">{money(m.salesCad + m.shippingCad)}</td>
                    <td className="num">{st.hasCost ? money(m.cogsCad) : '—'}</td>
                    <td className="num">{st.hasCost ? money(m.grossCad) : '—'}</td>
                    <td className="num">{st.hasCost ? pctOf(m.grossCad, m.salesCad + m.shippingCad) : '—'}</td>
                    <td className="num">{money(m.expensesCad)}</td>
                    <td className={`num ${st.hasCost && m.netCad < 0 ? 'is-negative' : ''}`}><strong>{st.hasCost ? money(m.netCad) : '—'}</strong></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
