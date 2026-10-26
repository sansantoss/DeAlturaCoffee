import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { StatTile } from '@/components/admin-charts';
import { DeleteButton, ExpenseForm } from '@/components/admin-finance';
import { repo } from '@/lib/db';
import { formatDate, formatMoney } from '@/lib/format';
import type { Expense, Locale } from '@/lib/types';

/**
 * Gastos operativos. Cada gasto lleva su fecha; el resumen es por mes y por etiqueta,
 * y cada etiqueta se abre para ver el desglose (p. ej. todos los "Transporte" del mes).
 */
export default async function ExpensesPage({ params, searchParams }: { params: Promise<{ locale: Locale }>; searchParams: Promise<{ month?: string; tag?: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Toronto' }).format(new Date());
  const now = today.slice(0, 7);
  const month = /^\d{4}-\d{2}$/.test(sp.month ?? '') ? sp.month! : now;
  const tagFilter = sp.tag?.trim() || '';
  const [t, expenses] = await Promise.all([getTranslations(), repo.expenses.list()]);
  const money = (c: number) => formatMoney(Math.round(c), locale);
  const cap = (x: string) => x.charAt(0).toUpperCase() + x.slice(1);
  const fmtMonth = (m: string, style: 'long' | 'short' = 'long') =>
    cap(new Intl.DateTimeFormat(locale, { month: style, year: style === 'long' ? 'numeric' : undefined, timeZone: 'UTC' }).format(new Date(`${m}-15T12:00:00Z`)));
  const shift = (m: string, d: number) => { const x = new Date(`${m}-15T12:00:00Z`); x.setUTCMonth(x.getUTCMonth() + d); return x.toISOString().slice(0, 7); };
  const dateOf = (e: Expense) => e.date ?? `${e.month}-01`;
  const href = (m: string, tag?: string) => `/admin/expenses?month=${m}${tag ? `&tag=${encodeURIComponent(tag)}` : ''}`;

  const inMonth = expenses.filter((e) => e.month === month).sort((a, b) => dateOf(b).localeCompare(dateOf(a)) || b.createdAt.localeCompare(a.createdAt));
  const list = tagFilter ? inMonth.filter((e) => e.tag === tagFilter) : inMonth;
  const total = inMonth.reduce((s, e) => s + e.amountCents, 0);
  const prevTotal = expenses.filter((e) => e.month === shift(month, -1)).reduce((s, e) => s + e.amountCents, 0);
  const groups = new Map<string, Expense[]>();
  for (const e of inMonth) groups.set(e.tag, [...(groups.get(e.tag) ?? []), e]);
  const byTag = [...groups.entries()].map(([tag, items]) => ({ tag, items, cents: items.reduce((s, e) => s + e.amountCents, 0) })).sort((a, b) => b.cents - a.cents);
  const maxTag = Math.max(1, ...byTag.map((g) => g.cents));
  const year = month.slice(0, 4);
  const yearMonths = Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`);
  const yearTotal = expenses.filter((e) => e.month.startsWith(year)).reduce((s, e) => s + e.amountCents, 0);
  const suggestions = Array.from(new Set([...(t.raw('admin.fin.exp.tags') as string[]), ...expenses.map((e) => e.tag)]));
  const pct = prevTotal ? Math.round(((total - prevTotal) / prevTotal) * 100) : null;

  return (
    <div className="admin-page stack-lg">
      <header className="admin-head">
        <h1 className="h-section">{t('admin.nav.expenses')}</h1>
        <div className="admin-head__actions">
          <a className="btn btn--sm btn--ghost" href={`/api/admin/export?type=expenses&locale=${locale}`}>{t('admin.fin.st.excel')}</a>
          <nav className="seg" aria-label={t('admin.fin.exp.month')}>
            <Link href={href(shift(month, -1))} aria-label={fmtMonth(shift(month, -1))}>←</Link>
            <span className="seg__label">{fmtMonth(month)}</span>
            <Link href={href(shift(month, 1))} aria-label={fmtMonth(shift(month, 1))}>→</Link>
          </nav>
        </div>
      </header>

      <section className="tiles">
        <StatTile
          label={t('admin.fin.exp.total')}
          value={money(total)}
          delta={pct === null ? undefined : { text: `${pct > 0 ? '+' : ''}${pct}% ${t('admin.fin.exp.vsPrev')}`, dir: pct > 0 ? 'up' : pct < 0 ? 'down' : 'flat', good: pct <= 0 }}
        />
        <StatTile label={t('admin.fin.exp.count')} value={String(inMonth.length)} hint={byTag[0] ? t('admin.fin.exp.biggest', { tag: byTag[0].tag }) : undefined} />
        <StatTile label={t('admin.fin.exp.year', { year })} value={money(yearTotal)} />
      </section>

      <section className="card stack">
        <h2 className="card__title">{t('admin.fin.exp.add')}</h2>
        <ExpenseForm defaultDate={month === now ? today : `${month}-01`} tags={suggestions} />
      </section>

      <section className="panel-grid">
        <article className="card">
          <h2 className="card__title">{t('admin.fin.exp.byTag')}</h2>
          {byTag.length ? (
            <ul className="tag-groups">
              {byTag.map((g) => (
                <li key={g.tag}>
                  <details>
                    <summary>
                      <span className="tag-groups__name"><strong>{g.tag}</strong><small className="hint">{t('admin.fin.exp.entries', { n: g.items.length })}</small></span>
                      <span className="tag-groups__bar" aria-hidden="true"><span style={{ width: `${Math.max(3, (g.cents / maxTag) * 100)}%` }} /></span>
                      <span className="tag-groups__value nums">{money(g.cents)}<small className="hint">{total ? `${Math.round((g.cents / total) * 100)}%` : ''}</small></span>
                    </summary>
                    <table className="table">
                      <tbody>
                        {g.items.map((e) => (
                          <tr key={e.id}><td className="nums">{formatDate(dateOf(e), locale)}</td><td>{e.description || '—'}</td><td className="num">{money(e.amountCents)}</td></tr>
                        ))}
                      </tbody>
                    </table>
                    <p><Link className="link" href={href(month, g.tag)}>{t('admin.fin.exp.onlyTag', { tag: g.tag })}</Link></p>
                  </details>
                </li>
              ))}
            </ul>
          ) : <p className="hint">{t('admin.fin.exp.none')}</p>}
        </article>

        <article className="card">
          <h2 className="card__title">{t('admin.fin.exp.yearTitle', { year })}</h2>
          <table className="table">
            <tbody>
              {yearMonths.map((m) => {
                const v = expenses.filter((e) => e.month === m).reduce((s, e) => s + e.amountCents, 0);
                return (
                  <tr key={m} className={m === month ? 'is-current' : v ? '' : 'is-dim'}>
                    <td><Link className="link" href={href(m)}>{fmtMonth(m, 'short')}</Link></td>
                    <td className="num">{v ? money(v) : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </article>

        <article className="card card--wide">
          <div className="admin-head">
            <h2 className="card__title">{tagFilter ? t('admin.fin.exp.listTag', { tag: tagFilter, month: fmtMonth(month) }) : t('admin.fin.exp.listTitle', { month: fmtMonth(month).toLocaleLowerCase(locale) })}</h2>
            {tagFilter && <Link className="link" href={href(month)}>{t('admin.fin.exp.showAll')}</Link>}
          </div>
          {list.length ? (
            <div className="table-wrap">
              <table className="table table--data">
                <thead><tr><th>{t('admin.fin.exp.date')}</th><th>{t('admin.fin.exp.tag')}</th><th>{t('admin.fin.exp.description')}</th><th className="num">{t('admin.fin.exp.amount')}</th><th><span className="sr-only">—</span></th></tr></thead>
                <tbody>
                  {list.map((e) => (
                    <tr key={e.id}>
                      <td className="nums">{formatDate(dateOf(e), locale)}</td>
                      <td><Link href={href(month, e.tag)} className="pill pill--muted">{e.tag}</Link></td>
                      <td>{e.description || '—'}</td>
                      <td className="num">{money(e.amountCents)}</td>
                      <td><DeleteButton kind="expense" id={e.id} label={`${e.tag}${e.description ? ` · ${e.description}` : ''} · ${money(e.amountCents)}`} /></td>
                    </tr>
                  ))}
                  <tr className="table__total">
                    <td colSpan={3}><strong>{t('admin.fin.exp.total')}</strong></td>
                    <td className="num"><strong>{money(list.reduce((s, e) => s + e.amountCents, 0))}</strong></td><td />
                  </tr>
                </tbody>
              </table>
            </div>
          ) : <p className="hint">{t('admin.fin.exp.none')}</p>}
        </article>
      </section>
    </div>
  );
}
