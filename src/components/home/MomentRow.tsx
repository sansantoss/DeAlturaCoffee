'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

export function MomentRow({
  heading,
  backLabel,
  nextLabel,
  children,
}: {
  heading: string;
  backLabel: string;
  nextLabel: string;
  children: ReactNode;
}) {
  const row = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const el = row.current;
    if (!el) return;
    const update = () => {
      const max = el.scrollWidth - el.clientWidth;
      setProgress(max > 0 ? el.scrollLeft / max : 1);
    };
    update();
    el.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      el.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, []);

  const move = (dir: 1 | -1) => {
    const el = row.current;
    if (!el) return;
    el.scrollBy({ left: dir * 312, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  };

  return (
    <section className="section wrap" aria-labelledby="how-title">
      <div className="how__head">
        <h2 id="how-title" className="h-section">{heading}</h2>
        <div className="how__buttons">
          <button type="button" onClick={() => move(-1)} aria-label={backLabel}>
            <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true"><path d="M13 3 6 10l7 7" stroke="currentColor" strokeWidth="2.2" fill="none" /></svg>
          </button>
          <button type="button" onClick={() => move(1)} aria-label={nextLabel}>
            <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true"><path d="m7 3 7 7-7 7" stroke="currentColor" strokeWidth="2.2" fill="none" /></svg>
          </button>
        </div>
      </div>
      <div className="progress" aria-hidden="true">
        <span style={{ width: `${Math.max(16, progress * 100)}%` }} />
      </div>
      <div className="row" ref={row} tabIndex={0} role="group" aria-label={heading}>
        {children}
      </div>
    </section>
  );
}
