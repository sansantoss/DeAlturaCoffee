import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { ProductEditor } from '@/components/admin-catalog';
import { getOrigin, getProductById } from '@/lib/catalog';
import type { Locale, Origin } from '@/lib/types';

export default async function EditProductPage({ params }: { params: Promise<{ locale: Locale; id: string }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const [t, product] = await Promise.all([getTranslations(), getProductById(id)]);
  if (!product) notFound();
  const origin: Origin = (await getOrigin(product.originId)) ?? {
    id: product.originId, country: { es: '', en: '', fr: '' }, region: '', altitude: { min: 0, max: 0 }, story: { es: '', en: '', fr: '' }, active: true,
  };
  return (
    <div className="admin-page stack-lg">
      <p><Link href="/admin/catalog" className="link">← {t('admin.nav.catalog')}</Link></p>
      <header className="admin-head">
        <div>
          <p className="kicker">{t('admin.cat.editing')}</p>
          <h1 className="h-section">{product.name[locale]}</h1>
        </div>
      </header>
      <ProductEditor product={product} origin={origin} />
    </div>
  );
}
