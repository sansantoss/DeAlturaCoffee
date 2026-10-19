import { getTranslations, setRequestLocale } from 'next-intl/server';
import { NewCustomerForm } from '@/components/admin';
import type { Locale } from '@/lib/types';

export default async function AdminNewCustomer({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('admin.newCustomer');
  return (
    <div className="admin-page stack-lg narrow">
      <header className="stack">
        <h1 className="h-section">{t('title')}</h1>
        <p>{t('lead')}</p>
      </header>
      <NewCustomerForm />
    </div>
  );
}
