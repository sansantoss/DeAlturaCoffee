'use client';

import { useState, type ReactNode } from 'react';
import Image from 'next/image';
import type { SiteImage } from '@/lib/images';
import type { RoastLevel } from '@/lib/types';
import { AddToCart, type FormatOption } from './AddToCart';
import { RoastMeter } from './RoastMeter';

export interface RoastTab {
  id: RoastLevel;
  name: string;
  notes: string;
  use: string;
  image: SiteImage | null;
}

/**
 * Parte de arriba de la página del café: la foto cambia con el tueste elegido,
 * a un lado el grano, su historia, la ficha corta y cómo pedir. Todo visible de entrada.
 */
export function ProductHero({
  roasts, initial, roastTitle, intro, spec, cart, order, fallback,
}: {
  roasts: RoastTab[];
  initial: RoastLevel;
  roastTitle: string;
  intro: ReactNode;
  spec: ReactNode;
  /** Cliente aprobado: puede agregar al pedido. */
  cart?: { formats: FormatOption[] };
  /** Visitante o cuenta en revisión: precios y botones. */
  order?: ReactNode;
  fallback: ReactNode;
}) {
  const [roast, setRoast] = useState<RoastLevel>(roasts.some((r) => r.id === initial) ? initial : roasts[0].id);
  const current = roasts.find((r) => r.id === roast) ?? roasts[0];

  return (
    <div className="product">
      <div className="product__media">
        {current.image ? (
          <div className="photo product__photo" style={{ aspectRatio: '4/5' }}>
            <Image key={current.image.src} src={current.image.src} alt={`${current.image.alt} · ${current.name}`} fill priority sizes="(max-width: 860px) 100vw, 45vw" />
          </div>
        ) : fallback}
        <span className="roast-slide__tag">{current.name}</span>
      </div>

      <div className="product__info stack">
        {intro}

        <div className="stack product__roast">
          <p className="field"><span>{roastTitle}</span></p>
          <div className="roast-tabs" role="tablist" aria-label={roastTitle}>
            {roasts.map((r) => (
              <button
                key={r.id}
                type="button"
                role="tab"
                aria-selected={r.id === roast}
                aria-controls="roast-panel"
                onClick={() => setRoast(r.id)}
              >
                <RoastMeter level={r.id} label="" />
                {r.name}
              </button>
            ))}
          </div>
          <div id="roast-panel" role="tabpanel" className="roast-panel" aria-live="polite">
            <p className="roast-panel__notes">{current.notes}</p>
            <p className="hint">{current.use}</p>
          </div>
        </div>

        {spec}

        {cart ? <AddToCart formats={cart.formats} roasts={roasts.map((r) => r.id)} roast={roast} /> : order}
      </div>
    </div>
  );
}
