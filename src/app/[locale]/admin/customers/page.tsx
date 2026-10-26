import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { CustomerRow } from '@/components/admin';
import { repo } from '@/lib/db';
import { isAdmin } from '@/lib/admin';
import { formatDate, formatMoney } from '@/lib/format';
import type { AccountStatus, Locale } from '@/lib/types';

const STATUSES: AccountStatus[] = ['pending', 'approved', 'suspended'];

export default async function AdminCustomers({ params, searchParams }: { params: Promise<{ locale: Locale }>; searchParams: Promise<{ status?: string; q?: string; city?: string; province?: string; tier?: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const filter = STATUSES.includes(sp.status as AccountStatus) ? (sp.status as AccountStatus) : null;
  const [t, customers, orders, applications] = await Promise.all([getTranslations(), repo.customers.list(), repo.orders.listAll(), repo.applications.list()]);
  const all = customers.filter((c) => !isAdmin(c));
  // Pendientes primero; luego el resto por fecha
  const sorted = [...all].sort((a, b) => Number(b.status === 'pending') - Number(a.status === 'pending'));
  // Ciudad y provincia: de la dirección principal o, si no tiene, de su solicitud
  const placeOf = (c: (typeof all)[number]) => {
    const a = c.addresses.find((x) => x.isDefault) ?? c.addresses[0];
    const app = applications.find((x) => x.email.toLowerCase() === c.email.toLowerCase());
    return { city: (a?.city ?? app?.city ?? '').trim(), province: a?.province ?? app?.province ?? '' };
  };
  const cities = [...new Set(all.map((c) => placeOf(c).city).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const provinces = [...new Set(all.map((c) => placeOf(c).province).filter(Boolean))].sort();
  const q = (sp.q ?? '').trim().toLowerCase();
  const shown = sorted.filter((c) => {
    const p = placeOf(c);
    if (filter && c.status !== filter) return false;
    if (sp.city && p.city !== sp.city) return false;
    if (sp.province && p.province !== sp.province) return false;
    if (sp.tier && c.priceTier !== sp.tier) return false;
    if (q && ![c.businessName, c.contactName, c.email, c.phone ?? '', p.city].some((x) => x.toLowerCase().includes(q))) return false;
    return true;
  });
  const keep = (extra: Record<string, string | undefined>) => {
    const u = new URLSearchParams();
    for (const [k, v] of Object.entries({ q: sp.q, city: sp.city, province: sp.province, tier: sp.tier, ...extra })) if (v) u.set(k, v);
    const s = u.toString();
    return `/admin/customers${s ? `?${s}` : ''}`;
  };
  const filtered = Boolean(q || sp.city || sp.province || sp.tier);
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
        <Link href={keep({ status: undefined })} aria-current={!filter ? 'true' : undefined}>{t('admin.all')} ({all.length})</Link>
        {STATUSES.map((s) => (
          <Link key={s} href={keep({ status: s })} aria-current={filter === s ? 'true' : undefined}>
            {t(`admin.statuses.${s}`)} ({all.filter((c) => c.status === s).length})
          </Link>
        ))}
      </nav>
      <form className="filters" method="get" role="search" aria-label={t('admin.filter.title')}>
        {filter && <input type="hidden" name="status" value={filter} />}
        <label className="field">
          <span>{t('admin.filter.search')}</span>
          <input className="input" name="q" defaultValue={sp.q ?? ''} placeholder={t('admin.filter.searchPh')} />
        </label>
        <label className="field">
          <span>{t('admin.filter.city')}</span>
          <select className="input" name="city" defaultValue={sp.city ?? ''}>
            <option value="">{t('admin.all')}</option>
            {cities.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <label className="field">
          <span>{t('apply.province')}</span>
          <select className="input" name="province" defaultValue={sp.province ?? ''}>
            <option value="">{t('admin.all')}</option>
            {provinces.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </label>
        <label className="field">
          <span>{t('admin.tier')}</span>
          <select className="input" name="tier" defaultValue={sp.tier ?? ''}>
            <option value="">{t('admin.all')}</option>
            <option value="standard">{t('admin.tiers.standard')}</option>
            <option value="partner">{t('admin.tiers.partner')}</option>
          </select>
        </label>
        <div className="filters__go">
          <button className="btn btn--sm">{t('admin.filter.apply')}</button>
          {filtered && <Link className="link" href={filter ? `/admin/customers?status=${filter}` : '/admin/customers'}>{t('admin.filter.clear')}</Link>}
        </div>
      </form>
      {filtered && <p className="hint">{t('admin.filter.showing', { n: shown.length, total: all.length })}</p>}
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
                      <Link className="link" href={`/admin/customers/${c.id}`}><strong>{c.businessName}</strong></Link>
                      {(() => { const p = placeOf(c); return p.city ? <><br /><small className="hint">{p.city}{p.province ? `, ${p.province}` : ''}{app ? ` · ${t('admin.kgMonth', { kg: app.estimatedKgPerMonth })}` : ''}</small></> : null; })()}
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
