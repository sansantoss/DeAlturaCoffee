import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';

export default async function NotFound() {
  const t = await getTranslations('notFound');
  return (
    <main id="content" className="page-head" style={{ minHeight: '60vh' }}>
      <h1>{t('title')}</h1>
      <p><Link href="/" className="link" style={{ textDecorationColor: 'currentColor' }}>{t('back')}</Link></p>
    </main>
  );
}
