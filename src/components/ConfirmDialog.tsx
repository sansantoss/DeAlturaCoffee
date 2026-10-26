'use client';

import { useEffect, useId, useRef, useState, useTransition, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import type { ActionResult } from '@/lib/action-error';

/**
 * Botón que pide confirmación en un diálogo propio (no el `confirm()` del navegador).
 * Se usa para borrar y para acciones que no se pueden deshacer.
 */
export function ConfirmButton({
  children, title, message, confirmLabel, tone = 'danger', className = 'link link--danger', onConfirm, disabled, ariaLabel,
}: {
  children: ReactNode;
  title: string;
  message?: string;
  confirmLabel: string;
  tone?: 'danger' | 'neutral';
  className?: string;
  /** Si regresa { error }, el diálogo lo muestra y no se cierra. */
  onConfirm: () => Promise<ActionResult | void> | void;
  disabled?: boolean;
  ariaLabel?: string;
}) {
  const t = useTranslations('admin.confirm');
  const ref = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      d.showModal();
      cancelRef.current?.focus(); // el foco inicial va en "Cancelar": lo seguro
    }
    if (!open && d.open) d.close();
  }, [open]);

  const close = () => { if (!pending) { setOpen(false); setResult(null); } };

  return (
    <>
      <button type="button" className={className} disabled={disabled} aria-label={ariaLabel} onClick={(e) => { e.preventDefault(); setOpen(true); }}>
        {children}
      </button>
      <dialog
        ref={ref}
        className={`confirm confirm--${tone}`}
        aria-labelledby={titleId}
        aria-describedby={message ? descId : undefined}
        onCancel={(e) => { e.preventDefault(); close(); }}
        onClick={(e) => { if (e.target === ref.current) close(); }}
      >
        <div className="confirm__body">
          <span className="confirm__icon" aria-hidden="true">
            {tone === 'danger' ? (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 7h16M9 7V4h6v3m-8 0 1 13h8l1-13" /></svg>
            ) : (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="9" /><path d="M12 8v5m0 3v.01" /></svg>
            )}
          </span>
          <h2 id={titleId} className="confirm__title">{title}</h2>
          {message && <p id={descId} className="confirm__msg">{message}</p>}
          {result?.error && <ActionErrorNote result={result} />}
        </div>
        <div className="confirm__actions">
          <button ref={cancelRef} type="button" className="btn btn--ghost" onClick={close} disabled={pending}>{t('cancel')}</button>
          <button
            type="button"
            className={`btn ${tone === 'danger' ? 'btn--danger' : ''}`}
            disabled={pending}
            onClick={() => start(async () => {
              const r = await onConfirm();
              if (r && r.error) setResult(r);
              else { setOpen(false); setResult(null); }
            })}
          >
            {pending ? t('working') : confirmLabel}
          </button>
        </div>
      </dialog>
    </>
  );
}

/** Mensaje de error de una acción del admin, con el detalle técnico plegado. */
export function ActionErrorNote({ result }: { result: ActionResult }) {
  const t = useTranslations('admin.errors');
  if (!result.error) return null;
  const key = ['missingTable', 'permission', 'missingMigration', 'invalid'].includes(result.error) ? result.error : 'unknown';
  return (
    <div className="action-error" role="alert">
      <p>{t(key as 'unknown')}</p>
      {result.detail && (
        <details>
          <summary>{t('detail')}</summary>
          <code>{result.detail}</code>
        </details>
      )}
    </div>
  );
}
