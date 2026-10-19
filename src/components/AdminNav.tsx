'use client';

import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';

const ITEMS = [
  { href: '/admin', key: 'overview', exact: true },
  { href: '/admin/orders', key: 'orders' },
  { href: '/admin/customers', key: 'customers' },
  { href: '/admin/prices', key: 'prices' },
] as const;

export function AdminNav({ pending }: { pending: number }) {
  const t = useTranslations('admin.nav');
  const path = usePathname();
  const active = (href: string, exact?: boolean) => (exact ? path === href : path === href || path.startsWith(`${href}/`));
  return (
    <nav className="admin-nav" aria-label="Admin">
      <ul>
        {ITEMS.map((it) => (
          <li key={it.href}>
            <Link href={it.href} aria-current={active(it.href, 'exact' in it) ? 'page' : undefined}>
              {t(it.key)}
              {it.key === 'customers' && pending > 0 && <span className="admin-nav__badge">{pending}</span>}
            </Link>
          </li>
        ))}
      </ul>
      <div className="admin-nav__actions">
        <Link href="/admin/orders/new" className="btn btn--sm">+ {t('newOrder')}</Link>
        <Link href="/admin/customers/new" className="btn btn--sm btn--ghost">+ {t('newCustomer')}</Link>
      </div>
    </nav>
  );
}
