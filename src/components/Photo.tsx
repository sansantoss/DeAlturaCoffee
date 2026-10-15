import Image from 'next/image';
import type { SiteImage } from '@/lib/images';

/** Foto recortada a una proporción fija (object-fit: cover), así cualquier tamaño de archivo encaja. */
export function Photo({
  image, sizes = '(max-width: 860px) 100vw, 50vw', priority = false, className = '', ratio,
}: { image: SiteImage; sizes?: string; priority?: boolean; className?: string; ratio?: string }) {
  return (
    <div className={`photo ${className}`} style={{ aspectRatio: ratio ?? image.ratio }}>
      <Image src={image.src} alt={image.alt} fill sizes={sizes} priority={priority} />
    </div>
  );
}
