'use client';

import { useEffect, useRef, useState } from 'react';

export interface AltimeterBand {
  id: string;
  label: string;
  min: number;
  max: number;
}

const TOP = 2200; // metros en la parte alta de la escala
const TICKS = [0, 500, 1000, 1500, 2000];

/**
 * Altímetro del hero: el contador sube de 0 a la altitud máxima al cargar,
 * y cada origen aparece en la franja de metros donde crece. Toronto (76 m) abajo.
 * Sin JavaScript o con movimiento reducido, se ve directo en su estado final.
 */
export function Altimeter({
  bands, home, unit, label, locale,
}: { bands: AltimeterBand[]; home: { label: string; m: number }; unit: string; label: string; locale: string }) {
  const max = Math.max(...bands.map((b) => b.max));
  const [value, setValue] = useState(max);
  const [run, setRun] = useState(false);
  const raf = useRef(0);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    setRun(true);
    const start = performance.now();
    const DURATION = 1800;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / DURATION);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(eased * max));
      if (t < 1) raf.current = requestAnimationFrame(tick);
    };
    setValue(0);
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [max]);

  const fmt = (n: number) => n.toLocaleString(locale === 'en' ? 'en-CA' : locale === 'fr' ? 'fr-CA' : 'es-MX');
  const pct = (m: number) => `${(m / TOP) * 100}%`;

  return (
    <figure className={`altimeter ${run ? 'altimeter--run' : ''}`} aria-label={label}>
      <figcaption className="altimeter__readout nums">
        <span className="altimeter__value">{fmt(value)}</span>
        <span className="altimeter__unit">{unit}</span>
      </figcaption>
      <div className="altimeter__scale">
        {TICKS.map((m) => (
          <span key={m} className="altimeter__tick nums" style={{ bottom: pct(m) }}>{fmt(m)}</span>
        ))}
        <div className="altimeter__rail" aria-hidden="true">
          <span className="altimeter__fill" style={{ height: pct(value) }} />
        </div>
        <ul className="altimeter__bands">
          {[...bands.map((b) => ({ ...b, home: false })), { id: 'home', label: home.label, min: 0, max: home.m, home: true }].map((b, i) => (
            <li key={b.id} className={`altimeter__col ${b.home ? 'altimeter__col--home' : ''}`} style={{ ['--i' as string]: i }}>
              <span className="altimeter__bar" style={{ bottom: pct(b.min), height: pct(b.max - b.min) }} />
              <span className="altimeter__tag" style={{ bottom: `calc(${pct(b.max)} + 10px)` }}>
                <span className="altimeter__name">{b.label}</span>
                <span className="altimeter__range nums">{b.home ? fmt(b.max) : `${fmt(b.min)}–${fmt(b.max)}`}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </figure>
  );
}
