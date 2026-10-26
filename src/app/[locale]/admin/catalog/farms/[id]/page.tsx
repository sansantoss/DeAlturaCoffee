import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { FarmEditor } from '@/components/admin-catalog';
import { listAllFarms, listAllProducts } from '@/lib/catalog';
import type { Locale } from '@/lib/types';

export default async function EditFarmPage({ params }: { params: Promise<{ locale: Locale; id: string }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const [t, farms, products] = await Promise.all([getTranslations(), listAllFarms(), listAllProducts()]);
  const farm = farms.find((f) => f.id === id);
  if (!farm) notFound();
  return (
    <div className="admin-page stack-lg">
      <p><Link href="/admin/catalog" className="link">← {t('admin.nav.catalog')}</Link></p>
      <header className="admin-head">
        <div>
          <p className="kicker">{t('admin.cat.farm')}</p>
          <h1 className="h-section">{farm.name}</h1>
        </div>
      </header>
      <FarmEditor farm={farm} products={products.map((p) => ({ id: p.id, name: p.name[locale] }))} />
    </div>
  );
}
