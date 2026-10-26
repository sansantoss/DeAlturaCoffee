import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { getCurrentCustomer } from '@/lib/auth';

/** Llamado a pedir, discreto: una línea con un enlace. Va al final de las secciones informativas. */
export async function OrderCta({ href = '/coffee', tone = 'light' }: { href?: string; tone?: 'light' | 'dark' }) {
  const [t, customer] = await Promise.all([getTranslations('cta'), getCurrentCustomer()]);
  return (
    <div className={`order-cta order-cta--${tone}`}>
      <span>{t('orderLine')}</span>
      <Link href={href} className="order-cta__link">
        {t('orderLink')}
        <svg width="18" height="18" viewBox="0 0 20 20" aria-hidden="true"><path d="M4 10h11m-5-5 5 5-5 5" stroke="currentColor" strokeWidth="1.8" fill="none" /></svg>
      </Link>
      {!customer && <Link href="/wholesale" className="link order-cta__alt">{t('applyLink')}</Link>}
    </div>
  );
}
