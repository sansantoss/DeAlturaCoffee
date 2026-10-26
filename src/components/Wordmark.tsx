import { Link } from '@/i18n/navigation';

/**
 * Logo principal: el wordmark DEALTURA / COFFEE (public/brand/wordmark.svg).
 * Se pinta con máscara CSS para que tome el color del texto (verde en crema, crema en verde).
 * Para cambiar el logo: reemplaza public/brand/wordmark.svg (o corre `npm run brand`).
 */
function Mark() {
  return <span className="wordmark__svg" aria-hidden="true" />;
}

/** Montañas de la marca (public/brand/mountains.svg, en terracotta) sobre las letras. */
function Mountains() {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/brand/mountains.svg" alt="" aria-hidden="true" className="wordmark__mountains" width={2034} height={554} />;
}

export function Wordmark({ href = '/', className, mountains = true }: { href?: string; className?: string; mountains?: boolean }) {
  return (
    <Link href={href} className={`wordmark ${mountains ? 'wordmark--peaks' : ''} ${className ?? ''}`} aria-label="DeAltura Coffee">
      {mountains && <Mountains />}
      <Mark />
    </Link>
  );
}

export function WordmarkStatic() {
  return (
    <span className="wordmark" role="img" aria-label="DeAltura Coffee">
      <Mark />
    </span>
  );
}

/** Logo secundario: el sello circular con las montañas (public/brand/emblem-round.png, de la guía de marca). */
export function Emblem({ className, size = 160 }: { className?: string; size?: number; onDark?: boolean }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/brand/emblem-round.png" alt="DeAltura Coffee" width={size} height={size} className={className} />;
}
