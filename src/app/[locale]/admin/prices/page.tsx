import { getTranslations, setRequestLocale } from 'next-intl/server';
import { PriceRow } from '@/components/admin';
import { listProducts } from '@/lib/catalog';
import type { Locale } from '@/lib/types';

export default async function AdminPrices({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, products] = await Promise.all([getTranslations('admin'), listProducts()]);
  return (
    <div className="admin-page stack-lg">
      <header className="stack">
        <h1 className="h-section">{t('pricesPage.title')}</h1>
        <p>{t('pricesPage.lead')}</p>
      </header>
      <div className="table-wrap">
        <table className="table table--data">
          <thead>
            <tr>
              <th>{t('col.product')}</th><th>{t('col.format')}</th><th className="num">{t('col.standard')}</th>
              <th className="num">{t('col.partner')}</th><th className="num">{t('col.discount')}</th><th><span className="sr-only">—</span></th>
            </tr>
          </thead>
          <tbody>
            {products.flatMap((p) =>
              p.formats.map((f) => (
                <PriceRow
                  key={`${f.sku}-${f.price.standard}-${f.price.partner}`}
                  sku={f.sku}
                  product={p.name[locale]}
                  format={f.label[locale]}
                  standardCents={f.price.standard}
                  partnerCents={f.price.partner}
                />
              )),
            )}
          </tbody>
        </table>
      </div>
      <p className="hint">{t('pricesPage.note')}</p>
    </div>
  );
}
