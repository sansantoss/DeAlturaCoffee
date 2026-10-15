'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Staggered entrance for every [data-reveal] block: children rise in one after another, once.
 * Content is never hidden without JavaScript (the hidden state only applies under html.js).
 */
export function Reveal() {
  const pathname = usePathname();

  useEffect(() => {
    const targets = Array.from(document.querySelectorAll<HTMLElement>('[data-reveal]:not(.is-in)'));
    targets.forEach((el) => {
      Array.from(el.children).forEach((child, i) => (child as HTMLElement).style.setProperty('--i', String(i)));
    });
    if (!('IntersectionObserver' in window)) {
      targets.forEach((el) => el.classList.add('is-in'));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add('is-in');
          io.unobserve(entry.target);
        }
      },
      { rootMargin: '0px 0px -10% 0px', threshold: 0.08 },
    );
    targets.forEach((el) => io.observe(el));
    // Safety net: anything on screen that the observer missed is shown after a moment.
    const timer = window.setTimeout(() => {
      targets.forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.top < innerHeight && r.bottom > 0) el.classList.add('is-in');
      });
    }, 2000);
    return () => {
      io.disconnect();
      window.clearTimeout(timer);
    };
  }, [pathname]);

  return null;
}
