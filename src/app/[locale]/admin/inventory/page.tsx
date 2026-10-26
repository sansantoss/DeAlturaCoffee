import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { StatTile } from '@/components/admin-charts';
import { DeleteButton } from '@/components/admin-finance';
import { repo } from '@/lib/db';
import { batchTotals, buildInventory, LB_PER_KG } from '@/lib/finance';
import { formatDate, formatMoney } from '@/lib/format';
import type { Locale } from '@/lib/types';

/** Inventario: café verde por compra, café tostado por nivel de tueste, y los últimos tuestes. */
export default async function AdminInventory({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, lots, batches, orders] = await Promise.all([getTranslations(), repo.lots.list(), repo.batches.list(), repo.orders.listAll()]);
  const inv = buildInventory(lots, batches, orders);
  const nf = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
  const kgLb = (kg: number) => `${nf.format(kg)} kg · ${nf.format(kg * LB_PER_KG)} lb`;
  const money = (c: number) => formatMoney(Math.round(c), locale);
  const roastedOnHand = inv.roasts.reduce((s, r) => s + r.onHandKg, 0);
  const committed = inv.roasts.reduce((s, r) => s + r.committedKg, 0);
  const lotById = new Map(lots.map((l) => [l.id, l]));

  return (
    <div className="admin-page stack-lg">
      <header className="admin-head">
        <h1 className="h-section">{t('admin.nav.inventory')}</h1>
        <div className="admin-head__actions">
          <Link href="/admin/inventory/lots/new" className="btn btn--ghost">+ {t('admin.fin.lot.new')}</Link>
          <Link href="/admin/inventory/roasts/new" className="btn">+ {t('admin.fin.batch.new')}</Link>
        </div>
      </header>

      {!lots.length && <p className="notice">{t('admin.fin.inv.empty')}</p>}

      <section className="tiles">
        <StatTile label={t('admin.fin.inv.green')} value={`${nf.format(inv.greenOnHandKg)} kg`} hint={inv.greenIncomingKg > 0 ? t('admin.fin.inv.incoming', { kg: nf.format(inv.greenIncomingKg) }) : `${nf.format(inv.greenOnHandKg * LB_PER_KG)} lb`} />
        <StatTile label={t('admin.fin.inv.roasted')} value={`${nf.format(roastedOnHand)} kg`} hint={`${nf.format(roastedOnHand * LB_PER_KG)} lb`} />
        <StatTile label={t('admin.fin.inv.committed')} value={`${nf.format(committed)} kg`} hint={t('admin.fin.inv.committedHint')} />
        <StatTile label={t('admin.fin.inv.avgCost')} value={inv.avgCostKgCad ? money(inv.avgCostKgCad) : '—'} hint={inv.avgCostKgCad ? t('admin.fin.perLb', { v: money(inv.avgCostKgCad / LB_PER_KG) }) : t('admin.fin.inv.noBatches')} />
      </section>

      <section className="card">
        <h2 className="card__title">{t('admin.fin.inv.byRoast')}</h2>
        <div className="table-wrap">
          <table className="table table--data">
            <thead>
              <tr>
                <th>{t('admin.fin.col.roast')}</th><th className="num">{t('admin.fin.col.produced')}</th><th className="num">{t('admin.fin.col.shipped')}</th>
                <th className="num">{t('admin.fin.col.onHand')}</th><th className="num">{t('admin.fin.col.committed')}</th><th className="num">{t('admin.fin.col.free')}</th>
                <th className="num">{t('admin.fin.col.costKg')}</th>
              </tr>
            </thead>
            <tbody>
              {inv.roasts.map((r) => (
                <tr key={r.roast}>
                  <td><strong>{t(`formats.${r.roast}`)}</strong></td>
                  <td className="num">{nf.format(r.producedKg)} kg</td>
                  <td className="num">{nf.format(r.shippedKg)} kg</td>
                  <td className="num"><strong>{nf.format(r.onHandKg)} kg</strong><br /><small className="hint">{nf.format(r.onHandKg * LB_PER_KG)} lb</small></td>
                  <td className="num">{nf.format(r.committedKg)} kg</td>
                  <td className={`num ${r.freeKg < 0 ? 'is-negative' : ''}`}>{nf.format(r.freeKg)} kg{r.freeKg < 0 && <><br /><small>{t('admin.fin.inv.toRoast')}</small></>}</td>
                  <td className="num">{r.avgCostKgCad ? money(r.avgCostKgCad) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {inv.since && <p className="hint" style={{ marginTop: '.75rem' }}>{t('admin.fin.inv.since', { date: formatDate(inv.since, locale) })}</p>}
      </section>

      <section className="card">
        <h2 className="card__title">{t('admin.fin.inv.lots')}</h2>
        {lots.length ? (
          <div className="table-wrap">
            <table className="table table--data">
              <thead>
                <tr>
                  <th>{t('admin.fin.col.lot')}</th><th>{t('admin.fin.col.status')}</th><th className="num">{t('admin.fin.col.bought')}</th>
                  <th className="num">{t('admin.fin.col.used')}</th><th className="num">{t('admin.fin.col.remaining')}</th>
                  <th className="num">{t('admin.fin.col.landed')}</th><th className="num">{t('admin.fin.col.costKgGreen')}</th>
                </tr>
              </thead>
              <tbody>
                {inv.lots.map(({ lot, totals, usedKg, remainingKg }) => (
                  <tr key={lot.id}>
                    <td><Link className="link" href={`/admin/inventory/lots/${lot.id}`}><strong>{lot.code}</strong></Link><br /><small className="hint">{lot.supplier} · {formatDate(lot.purchasedAt, locale)}</small></td>
                    <td><span className={`pill pill--lot-${lot.status}`}>{t(`admin.fin.lotStatus.${lot.status}`)}</span></td>
                    <td className="num">{kgLb(totals.greenKg)}</td>
                    <td className="num">{nf.format(usedKg)} kg</td>
                    <td className="num"><strong>{nf.format(remainingKg)} kg</strong></td>
                    <td className="num">{money(totals.landedCad)}</td>
                    <td className="num">{money(totals.perKgCad)}<br /><small className="hint">{t('admin.fin.perLb', { v: money(totals.perLbCad) })}</small></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="hint">{t('admin.fin.inv.noLots')}</p>}
      </section>

      <section className="card">
        <h2 className="card__title">{t('admin.fin.inv.batches')}</h2>
        {batches.length ? (
          <div className="table-wrap">
            <table className="table table--data">
              <thead>
                <tr>
                  <th>{t('admin.col.date')}</th><th>{t('admin.fin.col.roast')}</th><th>{t('admin.fin.col.lot')}</th>
                  <th className="num">{t('admin.fin.col.greenIn')}</th><th className="num">{t('admin.fin.col.roastedOut')}</th><th className="num">{t('admin.fin.col.shrink')}</th>
                  <th className="num">{t('admin.fin.col.batchCost')}</th><th className="num">{t('admin.fin.col.costKg')}</th><th><span className="sr-only">—</span></th>
                </tr>
              </thead>
              <tbody>
                {batches.slice(0, 20).map((b) => {
                  const lot = lotById.get(b.lotId);
                  const bt = batchTotals(b, lot);
                  return (
                    <tr key={b.id}>
                      <td>{formatDate(b.roastedAt, locale)}</td>
                      <td>{t(`formats.${b.roast}`)}</td>
                      <td>{lot?.code ?? '—'}</td>
                      <td className="num">{nf.format(b.greenKg)} kg</td>
                      <td className="num">{nf.format(b.roastedKg)} kg</td>
                      <td className="num">{nf.format(bt.shrinkPct)}%</td>
                      <td className="num">{money(bt.totalCad)}</td>
                      <td className="num"><strong>{money(bt.perKgCad)}</strong></td>
                      <td><DeleteButton kind="batch" id={b.id} label={t('admin.fin.delete')} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : <p className="hint">{t('admin.fin.inv.noBatches')}</p>}
      </section>
    </div>
  );
}
