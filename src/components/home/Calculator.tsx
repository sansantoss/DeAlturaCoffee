'use client';

import { useId, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';

/**
 * The page's one live thing: how much coffee a café needs.
 * 18 g per double shot, open six days a week, plus 8% for dialling in the grinder.
 */
const DOSE_G = 18;
const DAYS = 6;
const WASTE = 1.08;

export function Calculator() {
  const t = useTranslations('calc');
  const locale = useLocale();
  const id = useId();
  const [cups, setCups] = useState(120);

  const kg = (cups * DOSE_G * DAYS * WASTE) / 1000;
  const fmt = new Intl.NumberFormat(locale === 'fr' ? 'fr-CA' : locale === 'es' ? 'es-US' : 'en-CA', {
    maximumFractionDigits: 1,
  });

  return (
    <aside className="calc" aria-labelledby={`${id}-h`}>
      <h3 id={`${id}-h`}>{t('heading')}</h3>
      <div className="calc__row">
        <label htmlFor={`${id}-cups`}>
          <span>{t('cups')}</span>
          <output className="calc__cups nums" htmlFor={`${id}-cups`}>{cups}</output>
        </label>
        <input
          id={`${id}-cups`}
          type="range"
          min={20}
          max={600}
          step={10}
          value={cups}
          onChange={(e) => setCups(Number(e.target.value))}
        />
      </div>
      <p className="calc__out nums" aria-live="polite">{t('perWeek', { kg: fmt.format(kg) })}</p>
      <p className="calc__suggest">
        {t('suggest', { bags: Math.ceil(kg), lbBags: Math.ceil(kg / 2.268) })}
      </p>
      <p className="calc__basis">{t('basis')}</p>
    </aside>
  );
}
