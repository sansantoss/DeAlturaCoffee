'use client';

import { useActionState, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { addToCart, type FormState } from '@/app/[locale]/actions';
import { formatMoney } from '@/lib/format';
import type { Locale, RoastProfile } from '@/lib/types';

export interface FormatOption {
  sku: string;
  label: string;
  unitPriceCents: number;
}

export function AddToCart({ formats, roasts }: { formats: FormatOption[]; roasts: RoastProfile[] }) {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const [state, action, pending] = useActionState<FormState, FormData>(addToCart, {});
  const [sku, setSku] = useState(formats[0].sku);
  const [qty, setQty] = useState(1);
  const unit = formats.find((f) => f.sku === sku)!;

  return (
    <form action={action} className="stack">
      <fieldset className="stack" style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="field"><span>{t('product.format')}</span></legend>
        <div className="choice">
          {formats.map((f) => (
            <label key={f.sku}>
              <input type="radio" name="sku" value={f.sku} checked={sku === f.sku} onChange={() => setSku(f.sku)} />
              <span>
                {f.label}
                <small className="nums">{formatMoney(f.unitPriceCents, locale)}</small>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset className="stack" style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="field"><span>{t('product.roast')}</span></legend>
        <div className="choice">
          {roasts.map((r, i) => (
            <label key={r}>
              <input type="radio" name="roast" value={r} defaultChecked={i === 0} />
              <span>{t(`formats.${r}`)}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="field">
        <span id="qty-label">{t('product.quantity')}</span>
        <div className="qty">
          <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="−1">−</button>
          <input
            name="quantity"
            type="number"
            min={1}
            max={999}
            value={qty}
            onChange={(e) => setQty(Math.max(1, Math.min(999, Number(e.target.value) || 1)))}
            aria-labelledby="qty-label"
            className="nums"
          />
          <button type="button" onClick={() => setQty((q) => Math.min(999, q + 1))} aria-label="+1">+</button>
        </div>
      </div>
      <p className="price-line nums">
        {formatMoney(unit.unitPriceCents * qty, locale)}
        <small>{qty} × {formatMoney(unit.unitPriceCents, locale)}</small>
      </p>
      <div style={{ display: 'flex', gap: '.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <button className="btn" disabled={pending}>{t('product.add')}</button>
        {state.ok && (
          <>
            <span role="status">{t('product.added')}</span>
            <Link href="/cart" className="btn btn--ghost">{t('product.goCart')}</Link>
          </>
        )}
      </div>
    </form>
  );
}
