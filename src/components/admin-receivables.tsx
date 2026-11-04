'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { adminMarkPaid, adminUnmarkPaid } from '@/app/[locale]/admin/actions';
import { ConfirmButton } from './ConfirmDialog';

const METHODS = ['etransfer', 'wire', 'cheque', 'card', 'cash'] as const;

/** "Marcar cobrada": diálogo con fecha y forma de pago. */
export function MarkPaidButton({ id, label, today, compact }: { id: string; label: string; today: string; compact?: boolean }) {
  const t = useTranslations('admin.ar');
  const [date, setDate] = useState(today);
  const [method, setMethod] = useState<(typeof METHODS)[number]>('etransfer');
  return (
    <ConfirmButton
      className={compact ? 'link' : 'btn btn--sm'}
      tone="success"
      title={t('markTitle')}
      message={label}
      confirmLabel={t('markConfirm')}
      body={
        <div className="two" style={{ marginTop: '.5rem' }}>
          <label className="field"><span>{t('paidOn')}</span><input className="input" type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} /></label>
          <label className="field">
            <span>{t('method')}</span>
            <select className="input" value={method} onChange={(e) => setMethod(e.target.value as (typeof METHODS)[number])}>
              {METHODS.map((m) => <option key={m} value={m}>{t(`methods.${m}`)}</option>)}
            </select>
          </label>
        </div>
      }
      onConfirm={async () => {
        const fd = new FormData();
        fd.set('id', id); fd.set('date', date); fd.set('method', t(`methods.${method}`));
        return adminMarkPaid(fd);
      }}
    >
      {t('mark')}
    </ConfirmButton>
  );
}

/** Deshacer un cobro registrado por error. */
export function UnmarkPaidButton({ id, label }: { id: string; label: string }) {
  const t = useTranslations('admin.ar');
  return (
    <ConfirmButton
      title={t('unmarkTitle')} message={label} confirmLabel={t('unmark')}
      onConfirm={async () => { const fd = new FormData(); fd.set('id', id); return adminUnmarkPaid(fd); }}
    >
      {t('unmark')}
    </ConfirmButton>
  );
}
