import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { NewFarmButton, NewProductButton } from '@/components/admin-catalog';
import { getOrigin, listAllFarms, listAllProducts } from '@/lib/catalog';
import { farmPhoto, productPhotos } from '@/lib/images';
import { formatMoney } from '@/lib/format';
import type { Locale } from '@/lib/types';

/** Catálogo: los cafés que se venden (o se van a vender) y las fincas que se muestran en su página. */
export default async function CatalogPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, products, farms] = await Promise.all([getTranslations(), listAllProducts(), listAllFarms()]);
  const names = new Map(products.map((p) => [p.id, p.name[locale]]));

  return (
    <div className="admin-page stack-lg">
      <header className="admin-head">
        <div>
          <h1 className="h-section">{t('admin.nav.catalog')}</h1>
          <p className="hint">{t('admin.cat.lead')}</p>
        </div>
        <NewProductButton />
      </header>

      <ul className="cat-list">
        {await Promise.all(products.map(async (p) => {
          const o = await getOrigin(p.originId);
          const img = productPhotos(p, p.name[locale])[0];
          const from = Math.min(...p.formats.map((f) => Math.round((f.price.standard / f.grams) * 1000)));
          return (
            <li key={p.id} className={`cat-item ${p.active ? '' : 'is-off'}`}>
              <div className="cat-item__img">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {img ? <img src={img.src} alt="" /> : <span aria-hidden="true">☕</span>}
              </div>
              <div className="cat-item__body">
                <p className="kicker">{o?.country[locale]} · {o?.region}</p>
                <h2>{p.name[locale]}</h2>
                <p className="hint">
                  {[p.farm, p.variety, p.process[locale], p.score ? `${p.score} pts` : null].filter(Boolean).join(' · ')}
                </p>
                <p className="hint nums">
                  {t('admin.cat.formatsCount', { n: p.formats.length })} · {t('admin.cat.fromPerKg', { price: formatMoney(from, locale) })} · {p.roasts.map((r) => t(`formats.${r}`)).join(', ')}
                </p>
              </div>
              <div className="cat-item__end">
                <span className={`pill ${p.active ? 'pill--approved' : 'pill--muted'}`}>{p.active ? t('admin.cat.onSite') : t('admin.cat.hidden')}</span>
                <Link className="btn btn--sm" href={`/admin/catalog/${p.id}`}>{t('admin.edit')}</Link>
              </div>
            </li>
          );
        }))}
      </ul>

      <section className="stack">
        <div className="admin-head">
          <div>
            <h2 className="h-small">{t('admin.cat.farms')}</h2>
            <p className="hint">{t('admin.cat.farmsLead')}</p>
          </div>
          <NewFarmButton />
        </div>
        <ul className="cat-list cat-list--farms">
          {farms.map((f) => {
            const img = farmPhoto(f.image, f.name);
            return (
              <li key={f.id} className={`cat-item ${f.published ? '' : 'is-off'}`}>
                <div className="cat-item__img">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {img ? <img src={img.src} alt="" /> : <span aria-hidden="true">⛰</span>}
                </div>
                <div className="cat-item__body">
                  <h3>{f.name}</h3>
                  <p className="hint">{[f.town, f.state, f.altitude ? `${f.altitude} m` : null, f.variety].filter(Boolean).join(' · ')}</p>
                  <p className="hint">{f.productId ? names.get(f.productId) ?? f.productId : t('admin.cat.farmAllProducts')}</p>
                </div>
                <div className="cat-item__end">
                  <span className={`pill ${f.published ? 'pill--approved' : 'pill--muted'}`}>{f.published ? t('admin.cat.onSite') : t('admin.cat.hidden')}</span>
                  <Link className="btn btn--sm btn--ghost" href={`/admin/catalog/farms/${f.id}`}>{t('admin.edit')}</Link>
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
