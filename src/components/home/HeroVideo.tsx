'use client';

import { useEffect, useRef } from 'react';

/** Video de fondo del hero: mudo, en loop y sin controles. Si la persona pidió menos movimiento, se queda en pausa. */
export function HeroVideo({ mp4, webm, poster, position }: { mp4?: string; webm?: string; poster?: string; position: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) v.pause();
    else v.play().catch(() => { /* el navegador bloqueó el autoplay: se ve el poster */ });
  }, []);
  return (
    <video
      ref={ref}
      className="hero__video"
      muted
      loop
      playsInline
      autoPlay
      preload="metadata"
      poster={poster}
      aria-hidden="true"
      style={{ objectPosition: position }}
    >
      {webm && <source src={webm} type="video/webm" />}
      {mp4 && <source src={mp4} type="video/mp4" />}
    </video>
  );
}
