import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { BarList, StatTile } from '@/components/admin-charts';
import { DeleteButton, ExpenseForm } from '@/components/admin-finance';
import { repo } from '@/lib/db';
import { formatMoney } from '@/lib/format';
import type { Locale } from '@/lib/types';

/** Gastos operativos por mes, con etiqueta (renta, transporte, insumos...). */
export default async function ExpensesPage({ params, searchParams }: { params: Promise<{ locale: Locale }>; searchParams: Promise<{ month?: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const now = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Toronto' }).format(new Date()).slice(0, 7);
  const month = /^\d{4}-\d{2}$/.test(sp.month ?? '') ? sp.month! : now;
  const [t, expenses] = await Promise.all([getTranslations(), repo.expenses.list()]);
  const money = (c: number) => formatMoney(Math.round(c), locale);
  const fmtMonth = (m: string) => { const x = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${m}-15T12:00:00Z`)); return x.charAt(0).toUpperCase() + x.slice(1); };
  const shift = (m: string, d: number) => { const x = new Date(`${m}-15T12:00:00Z`); x.setUTCMonth(x.getUTCMonth() + d); return x.toISOString().slice(0, 7); };

  const list = expenses.filter((e) => e.month === month);
  const total = list.reduce((s, e) => s + e.amountCents, 0);
  const prevTotal = expenses.filter((e) => e.month === shift(month, -1)).reduce((s, e) => s + e.amountCents, 0);
  const byTag = new Map<string, number>();
  for (const e of list) byTag.set(e.tag, (byTag.get(e.tag) ?? 0) + e.amountCents);
  const year = month.slice(0, 4);
  const yearTotal = expenses.filter((e) => e.month.startsWith(year)).reduce((s, e) => s + e.amountCents, 0);
  const suggestions = Array.from(new Set([...(t.raw('admin.fin.exp.tags') as string[]), ...expenses.map((e) => e.tag)]));
  const pct = prevTotal ? Math.round(((total - prevTotal) / prevTotal) * 100) : null;

  return (
    <div className="admin-page stack-lg">
      <header className="admin-head">
        <h1 className="h-section">{t('admin.nav.expenses')}</h1>
        <a className="btn btn--sm btn--ghost" href={`/api/admin/export?type=expenses&locale=${locale}`}>{t('admin.fin.st.excel')}</a>
        <nav className="seg" aria-label={t('admin.fin.exp.month')}>
          <Link href={`/admin/expenses?month=${shift(month, -1)}`}>←</Link>
          <span className="seg__label">{fmtMonth(month)}</span>
          <Link href={`/admin/expenses?month=${shift(month, 1)}`}>→</Link>
        </nav>
      </header>

      <section className="tiles">
        <StatTile
          label={t('admin.fin.exp.total')}
          value={money(total)}
          delta={pct === null ? undefined : { text: `${pct > 0 ? '+' : ''}${pct}% ${t('admin.fin.exp.vsPrev')}`, dir: pct > 0 ? 'up' : pct < 0 ? 'down' : 'flat', good: pct <= 0 }}
        />
        <StatTile label={t('admin.fin.exp.count')} value={String(list.length)} />
        <StatTile label={t('admin.fin.exp.year', { year })} value={money(yearTotal)} />
      </section>

      <section className="card stack">
        <h2 className="card__title">{t('admin.fin.exp.add')}</h2>
        <ExpenseForm month={month} tags={suggestions} />
      </section>

      <section className="panel-grid">
        <article className="card card--wide">
          <h2 className="card__title">{t('admin.fin.exp.listTitle', { month: fmtMonth(month) })}</h2>
          {list.length ? (
            <div className="table-wrap">
              <table className="table table--data">
                <thead><tr><th>{t('admin.fin.exp.tag')}</th><th>{t('admin.fin.exp.description')}</th><th className="num">{t('admin.fin.exp.amount')}</th><th><span className="sr-only">—</span></th></tr></thead>
                <tbody>
                  {list.map((e) => (
                    <tr key={e.id}>
                      <td><span className="pill pill--muted">{e.tag}</span></td>
                      <td>{e.description || '—'}</td>
                      <td className="num">{money(e.amountCents)}</td>
                      <td><DeleteButton kind="expense" id={e.id} label={`${e.tag}${e.description ? ` · ${e.description}` : ''} · ${money(e.amountCents)}`} /></td>
                    </tr>
                  ))}
                  <tr className="table__total"><td colSpan={2}><strong>{t('admin.fin.exp.total')}</strong></td><td className="num"><strong>{money(total)}</strong></td><td /></tr>
                </tbody>
              </table>
            </div>
          ) : <p className="hint">{t('admin.fin.exp.none')}</p>}
        </article>
        <article className="card">
          <h2 className="card__title">{t('admin.fin.exp.byTag')}</h2>
          <BarList
            label={t('admin.fin.exp.byTag')}
            empty={t('admin.fin.exp.none')}
            items={[...byTag.entries()].sort((a, b) => b[1] - a[1]).map(([tag, c]) => ({ key: tag, label: tag, value: c, display: money(c), sub: total ? `${Math.round((c / total) * 100)}%` : undefined }))}
          />
        </article>
      </section>
    </div>
  );
}
