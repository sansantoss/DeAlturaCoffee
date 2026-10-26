import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { StatTile } from '@/components/admin-charts';
import { AddCostForm, DeleteButton, LotEdit } from '@/components/admin-finance';
import { repo } from '@/lib/db';
import { batchTotals, LB_PER_KG, lotTotals } from '@/lib/finance';
import { formatDate, formatMoney } from '@/lib/format';
import type { Locale } from '@/lib/types';

/** Ficha de una compra: cuánto se compró, a qué precio, y los gastos hasta tenerlo en Canadá. */
export default async function LotPage({ params }: { params: Promise<{ locale: Locale; id: string }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const [t, lot, batches] = await Promise.all([getTranslations(), repo.lots.getById(id), repo.batches.list()]);
  if (!lot) notFound();
  const tot = lotTotals(lot);
  const own = batches.filter((b) => b.lotId === lot.id);
  const usedKg = own.reduce((s, b) => s + b.greenKg, 0);
  const nf = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 });
  const money = (c: number) => formatMoney(Math.round(c), locale);
  const usd = new Intl.NumberFormat(locale === 'en' ? 'en-CA' : locale === 'fr' ? 'fr-CA' : 'es-MX', { style: 'currency', currency: 'USD' });
  const orig = (c: number, cur: string) => (cur === 'USD' ? usd.format(c / 100) : money(c));

  return (
    <div className="admin-page stack-lg">
      <p><Link href="/admin/inventory" className="link">← {t('admin.nav.inventory')}</Link></p>
      <header className="admin-head">
        <div>
          <p className="kicker">{t('admin.fin.lot.sheet')}</p>
          <h1 className="h-section">{lot.code}</h1>
          <p className="hint">{lot.supplier} · {lot.origin} · {formatDate(lot.purchasedAt, locale)}</p>
        </div>
        <LotEdit id={lot.id} status={lot.status} fxToCad={lot.fxToCad} currency={lot.currency} key={`${lot.status}-${lot.fxToCad}`} />
      </header>

      <section className="tiles">
        <StatTile label={t('admin.fin.lot.bought')} value={`${nf.format(tot.greenKg)} kg`} hint={`${nf.format(tot.greenKg * LB_PER_KG)} lb · ${t('admin.fin.lot.usedOf', { kg: nf.format(usedKg) })}`} />
        <StatTile label={t('admin.fin.lot.coffee')} value={money(tot.coffeeCad)} hint={`${nf.format(lot.quantity)} ${lot.inputUnit} × ${orig(lot.pricePerUnitCents, lot.currency)}`} />
        <StatTile label={t('admin.fin.lot.landed')} value={money(tot.landedCad)} hint={t('admin.fin.lot.landedHint', { costs: money(tot.costsCad) })} />
        <StatTile label={t('admin.fin.lot.perKg')} value={money(tot.perKgCad)} hint={t('admin.fin.perLb', { v: money(tot.perLbCad) })} />
      </section>

      <section className="card stack">
        <h2 className="card__title">{t('admin.fin.lot.costsTitle')}</h2>
        <p className="hint">{t('admin.fin.lot.costsLead')}</p>
        <div className="table-wrap">
          <table className="table table--data">
            <thead>
              <tr><th>{t('admin.fin.cost.category')}</th><th>{t('admin.fin.cost.label')}</th><th className="num">{t('admin.fin.cost.amount')}</th><th className="num">CAD</th><th><span className="sr-only">—</span></th></tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>{t('admin.fin.costCat.coffee')}</strong></td>
                <td>{nf.format(lot.quantity)} {lot.inputUnit} × {orig(lot.pricePerUnitCents, lot.currency)}</td>
                <td className="num">{orig(lot.quantity * lot.pricePerUnitCents, lot.currency)}</td>
                <td className="num">{money(tot.coffeeCad)}</td>
                <td />
              </tr>
              {lot.costs.map((c) => (
                <tr key={c.id}>
                  <td>{t(`admin.fin.costCat.${c.category}`)}</td>
                  <td>{c.label || '—'}</td>
                  <td className="num">{orig(c.amountCents, c.currency)}</td>
                  <td className="num">{money(c.currency === 'USD' ? c.amountCents * lot.fxToCad : c.amountCents)}</td>
                  <td><DeleteButton kind="cost" id={c.id} lotId={lot.id} label={t('admin.fin.delete')} /></td>
                </tr>
              ))}
              <tr className="table__total">
                <td colSpan={3}><strong>{t('admin.fin.lot.landed')}</strong></td>
                <td className="num"><strong>{money(tot.landedCad)}</strong></td>
                <td />
              </tr>
            </tbody>
          </table>
        </div>
        <AddCostForm lotId={lot.id} currency={lot.currency} />
      </section>

      <section className="card stack">
        <div className="admin-head">
          <h2 className="card__title">{t('admin.fin.inv.batches')}</h2>
          <Link href={`/admin/inventory/roasts/new?lot=${lot.id}`} className="btn btn--sm">+ {t('admin.fin.batch.new')}</Link>
        </div>
        {own.length ? (
          <div className="table-wrap">
            <table className="table table--data">
              <thead><tr><th>{t('admin.col.date')}</th><th>{t('admin.fin.col.roast')}</th><th className="num">{t('admin.fin.col.greenIn')}</th><th className="num">{t('admin.fin.col.roastedOut')}</th><th className="num">{t('admin.fin.col.costKg')}</th></tr></thead>
              <tbody>
                {own.map((b) => (
                  <tr key={b.id}>
                    <td>{formatDate(b.roastedAt, locale)}</td><td>{t(`formats.${b.roast}`)}</td>
                    <td className="num">{nf.format(b.greenKg)} kg</td><td className="num">{nf.format(b.roastedKg)} kg</td>
                    <td className="num">{money(batchTotals(b, lot).perKgCad)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="hint">{t('admin.fin.inv.noBatches')}</p>}
      </section>
      {lot.notes && <p className="notice">{lot.notes}</p>}
    </div>
  );
}
