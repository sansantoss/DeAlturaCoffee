import { getTranslations } from 'next-intl/server';
import { Photo } from './Photo';
import { MomentArt } from './art';
import { fileImage, siteImage } from '@/lib/images';
import { formatNumber } from '@/lib/format';
import type { Farm, Locale } from '@/lib/types';

/** "¿De dónde viene?": una tarjeta por finca publicada (content/farms.json), con foto y 3 líneas. */
export async function Farms({ farms, locale }: { farms: Farm[]; locale: Locale }) {
  if (!farms.length) return null;
  const t = await getTranslations('farms');
  return (
    <section className="section wrap farms" aria-labelledby="farms-title">
      <div className="farms__head">
        <h2 id="farms-title" className="h-section">{t('heading')}</h2>
        <p>{t('lead')}</p>
      </div>
      <ul className={`farms__grid farms__grid--${Math.min(farms.length, 4)}`}>
        {farms.map((f) => {
          // Sin foto de la finca todavía: se usa la de las cerezas como provisional.
          const img = fileImage(f.image, `${f.name}, ${f.town}`, '4/3') ?? siteImage('proceso_1', locale);
          return (
            <li key={f.id} className="farm">
              {img ? <Photo image={img} ratio="4/3" sizes="(max-width: 760px) 100vw, 33vw" /> : <div className="farm__art"><MomentArt index={0} alt={f.name} day="" /></div>}
              <div className="farm__body">
                <h3>{f.name}</h3>
                <p className="farm__where">{f.town}, {f.state} · Venezuela</p>
                <p className="farm__meta nums">{t('altitude', { m: formatNumber(f.altitude, locale) })} · {f.variety}{f.producer ? ` · ${f.producer}` : ''}</p>
                <p>{f.text[locale] || f.text.es}</p>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
