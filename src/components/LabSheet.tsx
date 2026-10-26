import { getTranslations } from 'next-intl/server';
import { Photo } from './Photo';
import type { SiteImage } from '@/lib/images';
import type { LabSheet as Lab, Locale } from '@/lib/types';

const fmtDate = (iso: string, locale: Locale) =>
  new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${iso}T12:00:00Z`));

/**
 * Ficha técnica del lote (del análisis de laboratorio): catación por atributo sobre 10,
 * datos físicos del café verde y descriptores. Una sola serie, un solo color, escala fija 0–10.
 */
export async function LabSheet({ lab, score, locale, image }: { lab: Lab; score?: number; locale: Locale; image: SiteImage | null }) {
  const t = await getTranslations('lab');
  const nf = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 });
  const total = score ?? lab.cupping.reduce((s, c) => s + c.score, 0);

  return (
    <section className="section wrap lab" aria-labelledby="lab-title">
      <header className="lab__head">
        <h2 id="lab-title" className="h-section">{t('title')}</h2>
        <p className="hint">{t('lead', { lot: lab.lot, date: fmtDate(lab.date, locale), lab: lab.lab })}</p>
      </header>

      <div className="lab__grid">
        <div className="card lab__cup">
          <h3 className="card__title">{t('cupTitle')}</h3>
          <ul className="cupping" aria-label={t('cupTitle')}>
            {lab.cupping.map((c) => (
              <li key={c.key}>
                <span className="cupping__label">{t(`keys.${c.key}` as 'keys.body')}</span>
                <span className="cupping__track" aria-hidden="true"><span style={{ width: `${(c.score / 10) * 100}%` }} /></span>
                <span className="cupping__value nums">{nf.format(c.score)}</span>
              </li>
            ))}
          </ul>
          <p className="hint">{t('cupNote', { score: nf.format(total) })}</p>
        </div>

        <div className="stack">
          <div className="card">
            <h3 className="card__title">{t('inCup')}</h3>
            <p className="lab__descriptors">{lab.descriptors[locale]}</p>
          </div>
          <div className="card">
            <h3 className="card__title">{t('physical')}</h3>
            <dl className="lab__facts">
              <div><dt>{t('grade')}</dt><dd>{t('gradeValue')}</dd></div>
              <div><dt>{t('moisture')}</dt><dd className="nums">{nf.format(lab.moisturePct)}%</dd></div>
              <div><dt>{t('density')}</dt><dd className="nums">{nf.format(lab.densityGL)} g/L</dd></div>
              <div><dt>{t('screen')}</dt><dd className="nums">{lab.screen}<small>{t('screenNote', { pct: nf.format(lab.screenAbove16Pct) })}</small></dd></div>
              <div><dt>{t('defects')}</dt><dd className="nums">{lab.primaryDefects}</dd></div>
            </dl>
          </div>
        </div>

        {image && <Photo image={image} ratio="4/5" sizes="(max-width: 960px) 100vw, 28vw" className="lab__photo" />}
      </div>
    </section>
  );
}
