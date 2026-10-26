'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { Link } from '@/i18n/navigation';
import type { SiteImage } from '@/lib/images';
import { RoastMeter } from '../RoastMeter';

export interface RoastSlide {
  id: 'light' | 'medium' | 'dark';
  name: string;
  notes: string;
  use: string;
  image: SiteImage | null;
}

/** Carrusel de tostados (inicio): una diapositiva por tueste, con flechas, puntos y deslizamiento. */
export function RoastCarousel({
  heading, kicker, product, slides, cta, prev, next, counter,
}: {
  heading: string;
  kicker: string;
  product: string;
  slides: RoastSlide[];
  cta: string;
  prev: string;
  next: string;
  counter: string; // '{n} de {total}'
}) {
  const track = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const el = track.current;
    if (!el) return;
    const update = () => {
      const w = el.firstElementChild?.getBoundingClientRect().width ?? el.clientWidth;
      setActive(Math.max(0, Math.min(slides.length - 1, Math.round(el.scrollLeft / (w + 24)))));
    };
    el.addEventListener('scroll', update, { passive: true });
    return () => el.removeEventListener('scroll', update);
  }, [slides.length]);

  const go = (i: number) => {
    const el = track.current;
    const slide = el?.children[i] as HTMLElement | undefined;
    if (!el || !slide) return;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollTo({ left: slide.offsetLeft - el.offsetLeft, behavior: reduce ? 'auto' : 'smooth' });
    setActive(i);
  };

  return (
    <section className="roasts section" aria-labelledby="roasts-title" aria-roledescription="carousel">
      <div className="roasts__head wrap">
        <div>
          <p className="kicker">{kicker}</p>
          <h2 id="roasts-title" className="h-section">{heading}</h2>
        </div>
        <div className="how__buttons">
          <button type="button" onClick={() => go(Math.max(0, active - 1))} aria-label={prev} disabled={active === 0}>
            <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true"><path d="M13 3 6 10l7 7" stroke="currentColor" strokeWidth="2.2" fill="none" /></svg>
          </button>
          <button type="button" onClick={() => go(Math.min(slides.length - 1, active + 1))} aria-label={next} disabled={active === slides.length - 1}>
            <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true"><path d="m7 3 7 7-7 7" stroke="currentColor" strokeWidth="2.2" fill="none" /></svg>
          </button>
        </div>
      </div>

      <div className="roasts__track" ref={track} tabIndex={0} aria-label={heading}>
        {slides.map((s, i) => (
          <article
            key={s.id}
            className={`roast-slide roast-slide--${s.id}`}
            aria-roledescription="slide"
            aria-label={counter.replace('{n}', String(i + 1)).replace('{total}', String(slides.length))}
          >
            <div className="roast-slide__img">
              {s.image ? (
                <Image src={s.image.src} alt={`${s.image.alt} · ${s.name}`} fill sizes="(max-width: 860px) 90vw, 40vw" />
              ) : (
                <div className="roast-slide__swatch" aria-hidden="true" />
              )}
              <span className="roast-slide__tag">{s.name}</span>
            </div>
            <div className="roast-slide__text">
              <RoastMeter level={s.id} label={s.name} />
              <h3>{s.name}</h3>
              <p className="roast-slide__product">{product}</p>
              <p className="roast-slide__notes">{s.notes}</p>
              <p className="hint">{s.use}</p>
              <Link href={`/coffee?roast=${s.id}`} className="btn" tabIndex={i === active ? 0 : -1}>{cta}</Link>
            </div>
          </article>
        ))}
      </div>

      <div className="roasts__dots wrap" role="group" aria-label={heading}>
        {slides.map((s, i) => (
          <button key={s.id} type="button" aria-label={s.name} aria-current={i === active ? 'true' : undefined} onClick={() => go(i)}>
            <span />
          </button>
        ))}
      </div>
    </section>
  );
}
