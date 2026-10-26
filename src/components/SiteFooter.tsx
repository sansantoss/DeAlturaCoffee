import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { getSettings } from '@/lib/catalog';
import { Emblem } from './Wordmark';

export async function SiteFooter() {
  const t = await getTranslations('footer');
  const nav = await getTranslations('nav');
  const settings = await getSettings();

  return (
    <footer className="site-footer on-dark">
      <div className="site-footer__top">
        <div className="site-footer__invite">
          <p>
            {t('invite1')}
            <br />
            {t('invite2')}
          </p>
          <Link href="/wholesale" className="btn btn--cream">{t('button')}</Link>
        </div>
        <nav className="site-footer__links" aria-label="Footer">
          <Emblem onDark size={112} className="site-footer__emblem" />
          <Link href="/coffee">{nav('coffee')}</Link>
          <Link href="/about">{nav('about')}</Link>
          <Link href="/login">{nav('signIn')}</Link>
          <a href={`mailto:${settings.contactEmail}`}>{t('email')}: {settings.contactEmail}</a>
        </nav>
      </div>
      <div className="site-footer__name" aria-hidden="true"><span className="wordmark__svg" /></div>
      <div className="site-footer__legal">
        <span>{t('rights', { year: new Date().getFullYear() })}</span>
        <span>{t('made')}</span>
      </div>
    </footer>
  );
}
