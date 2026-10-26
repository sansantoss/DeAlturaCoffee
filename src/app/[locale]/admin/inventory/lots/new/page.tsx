import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { NewLotForm } from '@/components/admin-finance';
import { repo } from '@/lib/db';
import { getOrigin, listAllProducts } from '@/lib/catalog';
import type { Locale } from '@/lib/types';

/** Nueva compra de café verde (ficha del pedido al productor/exportador). */
export default async function NewLotPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, lots, all] = await Promise.all([getTranslations(), repo.lots.list(), listAllProducts()]);
  const products = await Promise.all(all.map(async (p) => ({ id: p.id, name: `${p.name[locale]}${p.active ? '' : ` (${t('admin.cat.hidden')})`}`, origin: (await getOrigin(p.originId))?.region ?? '' })));
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Toronto' }).format(new Date());
  const code = `VEN-${today.slice(0, 4)}-${String(lots.filter((l) => l.code.includes(today.slice(0, 4))).length + 1).padStart(2, '0')}`;
  return (
    <div className="admin-page narrow stack-lg">
      <p><Link href="/admin/inventory" className="link">← {t('admin.nav.inventory')}</Link></p>
      <header className="stack">
        <h1 className="h-section">{t('admin.fin.lot.new')}</h1>
        <p className="hint">{t('admin.fin.lot.lead')}</p>
      </header>
      <NewLotForm today={today} defaultCode={code} products={products} />
    </div>
  );
}
