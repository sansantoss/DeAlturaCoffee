import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { getUserId } from '@/lib/auth';
import { cartCount } from '@/lib/cart';
import { LangSwitch } from './LangSwitch';
import { Wordmark } from './Wordmark';

export async function SiteHeader({ variant = 'light', current }: { variant?: 'light' | 'hero'; current?: string }) {
  const t = await getTranslations('nav');
  const [userId, count] = await Promise.all([getUserId(), cartCount()]);
  const links = [
    { href: '/coffee', label: t('coffee') },
    { href: '/origin', label: t('origin') },
    { href: '/wholesale', label: t('wholesale') },
  ];

  return (
    <header className={`site-header site-header--${variant}`}>
      <Wordmark />
      <nav className="site-header__links" aria-label="Main">
        {links.map((l) => (
          <Link key={l.href} href={l.href} className="link" aria-current={current === l.href ? 'page' : undefined}>
            {l.label}
          </Link>
        ))}
      </nav>
      <div className="site-header__end">
        <span className="hide-sm"><LangSwitch label={t('language')} /></span>
        {userId ? (
          <>
            <Link href="/cart" className="link hide-sm">
              {t('cart')}
              {count > 0 && <span className="cart-count nums">{count}</span>}
            </Link>
            <Link href="/account" className={`btn ${variant === 'hero' ? 'btn--cream' : ''}`}>{t('account')}</Link>
          </>
        ) : (
          <>
            <Link href="/login" className="link hide-sm">{t('signIn')}</Link>
            <Link href="/wholesale" className={`btn ${variant === 'hero' ? 'btn--cream' : ''}`}>{t('apply')}</Link>
          </>
        )}
        <details className="mobile-menu">
          <summary aria-label={t('menu')}>
            <svg width="28" height="20" viewBox="0 0 28 20" aria-hidden="true"><rect width="28" height="3" fill="currentColor" /><rect y="8.5" width="28" height="3" fill="currentColor" /><rect y="17" width="28" height="3" fill="currentColor" /></svg>
          </summary>
          <ul>
            {links.map((l) => (
              <li key={l.href}><Link href={l.href}>{l.label}</Link></li>
            ))}
            {userId ? (
              <li><Link href="/cart">{t('cart')}{count > 0 ? ` (${count})` : ''}</Link></li>
            ) : (
              <li><Link href="/login">{t('signIn')}</Link></li>
            )}
            <li><LangSwitch label={t('language')} inline /></li>
          </ul>
        </details>
      </div>
    </header>
  );
}
