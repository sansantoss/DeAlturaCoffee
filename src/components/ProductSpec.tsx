import { getTranslations } from 'next-intl/server';
import type { Locale, Origin, Product } from '@/lib/types';
import { formatNumber } from '@/lib/format';

/** The bag label as a card: origin and score, tasting notes, variety / process / altitude. */
export async function ProductSpec({ product, origin, locale }: { product: Product; origin: Origin; locale: Locale }) {
  const t = await getTranslations('coffee');
  return (
    <div className="spec">
      <div className="spec__origin">
        <div>
          <h2>{origin.country[locale]}</h2>
          <p>{origin.region}</p>
        </div>
        {product.score && (
          <p className="spec__score nums">
            {product.score}+<small>{t('score')}</small>
          </p>
        )}
      </div>
      <div>
        <p className="hint">{t('notes')}</p>
        <p className="spec__notes">{product.tastingNotes[locale]}</p>
      </div>
      <dl className="spec__row">
        <div><dt>{t('variety')}</dt><dd>{product.variety}</dd></div>
        <div><dt>{t('process')}</dt><dd>{product.process[locale]}</dd></div>
        <div>
          <dt>{t('altitude')}</dt>
          <dd className="nums">{formatNumber(origin.altitude.min, locale)}–{formatNumber(origin.altitude.max, locale)} m</dd>
        </div>
      </dl>
    </div>
  );
}
