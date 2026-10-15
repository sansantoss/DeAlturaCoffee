'use client';

import { useLocale, useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';

/**
 * Manual language switch. Choosing a language writes the NEXT_LOCALE cookie (next-intl does it on
 * navigation), and from then on that choice beats the browser's language.
 */
export function LangSwitch({ label, inline = false }: { label: string; inline?: boolean }) {
  const locale = useLocale();
  const pathname = usePathname();
  const t = useTranslations('lang');
  // usePathname() returns the path without the locale, with real values (e.g. /account/orders/abc).
  const href = pathname;

  if (inline) {
    return (
      <span style={{ display: 'flex', gap: '.25rem', padding: '.1rem .6rem' }}>
        {routing.locales.map((l) => (
          <Link key={l} href={href} locale={l} aria-current={l === locale ? 'true' : undefined} style={{ padding: '.75rem .5rem', minWidth: 44, textAlign: 'center', fontWeight: l === locale ? 600 : 400 }}>
            {l.toUpperCase()}
          </Link>
        ))}
      </span>
    );
  }

  return (
    <details className="lang">
      <summary aria-label={label}>
        <span>{locale.toUpperCase()}</span>
        <svg width="10" height="6" viewBox="0 0 10 6" aria-hidden="true"><path d="M0 0h10L5 6z" fill="currentColor" /></svg>
      </summary>
      <ul>
        {routing.locales.map((l) => (
          <li key={l}>
            <Link href={href} locale={l} aria-current={l === locale ? 'true' : undefined} hrefLang={l}>
              {t(l)}
            </Link>
          </li>
        ))}
      </ul>
    </details>
  );
}
