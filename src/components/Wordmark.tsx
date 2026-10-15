import { Link } from '@/i18n/navigation';

/**
 * Logo principal: el wordmark DEALTURA / COFFEE (public/brand/wordmark.svg).
 * Se pinta con máscara CSS para que tome el color del texto (verde en crema, crema en verde).
 * Para cambiar el logo: reemplaza public/brand/wordmark.svg (o corre `npm run brand`).
 */
function Mark() {
  return <span className="wordmark__svg" aria-hidden="true" />;
}

export function Wordmark({ href = '/', className }: { href?: string; className?: string }) {
  return (
    <Link href={href} className={`wordmark ${className ?? ''}`} aria-label="DeAltura Coffee">
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

/** Logo secundario: el sello circular (public/brand/emblem.svg). */
export function Emblem({ className, size = 160, onDark = false }: { className?: string; size?: number; onDark?: boolean }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={onDark ? '/brand/emblem-cream.svg' : '/brand/emblem.svg'} alt="DeAltura Coffee" width={size} height={size} className={className} />;
}
