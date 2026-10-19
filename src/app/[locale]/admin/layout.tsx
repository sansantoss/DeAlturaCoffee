import { getTranslations, setRequestLocale } from 'next-intl/server';
import { redirect } from '@/i18n/navigation';
import { SiteHeader } from '@/components/SiteHeader';
import { AdminNav } from '@/components/AdminNav';
import { getCurrentCustomer } from '@/lib/auth';
import { isAdmin } from '@/lib/admin';
import { repo } from '@/lib/db';
import type { Locale } from '@/lib/types';

/** Todo /admin pasa por aquí: solo el equipo (ADMIN_EMAILS) ve el panel. */
export default async function AdminLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const locale = (await params).locale as Locale;
  setRequestLocale(locale);
  const me = await getCurrentCustomer();
  if (!me) return redirect({ href: '/login?next=/admin', locale });
  const t = await getTranslations('admin');
  if (!isAdmin(me)) {
    return (
      <>
        <SiteHeader />
        <main id="content" className="inner" style={{ paddingBlock: 'clamp(3rem, 8vw, 6rem)' }}>
          <p className="notice notice--strong">{t('forbidden')}</p>
        </main>
      </>
    );
  }
  const pending = (await repo.customers.list()).filter((c) => c.status === 'pending').length;
  return (
    <>
      <SiteHeader />
      <div className="admin">
        <AdminNav pending={pending} />
        <main id="content" className="admin__main">{children}</main>
      </div>
    </>
  );
}
