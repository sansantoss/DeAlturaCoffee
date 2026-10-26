import { getTranslations } from 'next-intl/server';
import type { Locale, Origin, Product } from '@/lib/types';
import { formatNumber } from '@/lib/format';

export function altitudeText(origin: Origin, locale: Locale) {
  const { min, max } = origin.altitude;
  return min === max ? `${formatNumber(min, locale)} m` : `${formatNumber(min, locale)}–${formatNumber(max, locale)} m`;
}

/** La etiqueta de la bolsa como tarjeta: origen y puntaje, notas, y los datos del grano. */
export async function ProductSpec({ product, origin, locale }: { product: Product; origin: Origin; locale: Locale }) {
  const t = await getTranslations('coffee');
  const rows = [
    { k: t('variety'), v: product.variety },
    { k: t('process'), v: product.process[locale] },
    { k: t('altitude'), v: altitudeText(origin, locale) },
    product.harvest && { k: t('harvest'), v: product.harvest },
    product.farm && { k: t('farm'), v: product.farm },
    product.producer && { k: t('producer'), v: product.producer },
  ].filter(Boolean) as { k: string; v: string }[];

  return (
    <div className="spec">
      <div className="spec__origin">
        <div>
          <h2>{origin.country[locale]}</h2>
          <p>{origin.region}</p>
        </div>
        {product.score && (
          <p className="spec__score nums">
            {product.score}<small>{t('score')}</small>
          </p>
        )}
      </div>
      <div>
        <p className="hint">{t('notes')}</p>
        <p className="spec__notes">{product.tastingNotes[locale]}</p>
      </div>
      <dl className="spec__row">
        {rows.map((r) => (
          <div key={r.k}><dt>{r.k}</dt><dd className="nums">{r.v}</dd></div>
        ))}
      </dl>
    </div>
  );
}
