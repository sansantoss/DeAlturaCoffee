import { getTranslations, setRequestLocale } from 'next-intl/server';
import { NewOrderForm } from '@/components/admin';
import { repo } from '@/lib/db';
import { getSettings, listProducts } from '@/lib/catalog';
import { isAdmin } from '@/lib/admin';
import type { Locale } from '@/lib/types';

export default async function AdminNewOrder({ params, searchParams }: { params: Promise<{ locale: Locale }>; searchParams: Promise<{ customer?: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const [t, customers, products, settings] = await Promise.all([getTranslations(), repo.customers.list(), listProducts(), getSettings()]);
  const approved = customers.filter((c) => c.status === 'approved' && !isAdmin(c));
  const options = products.flatMap((p) =>
    p.formats.map((f) => ({ sku: f.sku, label: `${p.name[locale]} — ${f.label[locale]}`, grams: f.grams, roasts: p.roasts, price: f.price })),
  );
  return (
    <div className="admin-page stack-lg narrow">
      <header className="stack">
        <h1 className="h-section">{t('admin.newOrder.title')}</h1>
        <p>{t('admin.newOrder.lead')}</p>
      </header>
      <NewOrderForm
        minimumKg={settings.minimumOrderKg}
        defaultCustomer={approved.some((c) => c.id === sp.customer) ? sp.customer : undefined}
        options={options}
        customers={approved.map((c) => ({
          id: c.id, tier: c.priceTier, hasCredit: Boolean(c.invoiceTermsDays),
          label: `${c.businessName} — ${c.contactName}${c.hasLogin === false ? ` (${t('admin.access.no').toLowerCase()})` : ''}`,
        }))}
      />
    </div>
  );
}
