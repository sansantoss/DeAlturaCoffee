'use client';

import { useTranslations } from 'next-intl';

/** Si algo del panel truena, se ve un aviso con el detalle en lugar de la pantalla de error de Next. */
export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations('admin.errors');
  return (
    <div className="admin-page stack">
      <div className="action-error" role="alert" style={{ maxWidth: '40rem' }}>
        <p>{/does not exist|schema cache|Could not find the table/i.test(error.message) ? t('missingTable') : t('unknown')}</p>
        <details>
          <summary>{t('detail')}</summary>
          <code>{error.message}{error.digest ? ` (${error.digest})` : ''}</code>
        </details>
      </div>
      <div><button type="button" className="btn btn--sm" onClick={reset}>↻</button></div>
    </div>
  );
}
