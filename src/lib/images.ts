import 'server-only';
import { readdirSync } from 'node:fs';
import path from 'node:path';
import imagesJson from '@content/images.json';
import builtManifest from './images.manifest.json';
import type { Locale } from './types';

/**
 * Fotos del sitio. content/images.json dice qué archivo va en cada espacio;
 * si el archivo no existe en public/images, la página muestra la ilustración de respaldo.
 */

type Slot = { file: string; ratio: string; alt: Record<Locale, string> };
const config = imagesJson as unknown as {
  slots: Record<string, Slot>;
  products: Record<string, string[]>;
  roasts?: Record<string, Record<string, string>>;
};

export type SlotName = keyof typeof imagesJson.slots;
export interface SiteImage { src: string; alt: string; ratio: string }

const EXT = /\.(jpe?g|png|webp|avif)$/i;

/** En desarrollo lee la carpeta en vivo (para ver la foto al recargar); en producción usa el manifest. */
function available(): Record<string, string> {
  if (process.env.NODE_ENV !== 'development') return builtManifest as Record<string, string>;
  try {
    const out: Record<string, string> = {};
    for (const f of readdirSync(path.join(process.cwd(), 'public', 'images'))) {
      if (EXT.test(f)) out[f.replace(EXT, '').toLowerCase()] = `/images/${f}`;
    }
    return out;
  } catch {
    return {};
  }
}

const resolve = (file: string) => available()[file.replace(EXT, '').toLowerCase()] ?? null;

export function siteImage(slot: SlotName, locale: Locale): SiteImage | null {
  const s = config.slots[slot];
  const src = s ? resolve(s.file) : null;
  return src ? { src, alt: s.alt[locale], ratio: s.ratio } : null;
}

export function productImages(slug: string, alt: string): SiteImage[] {
  return (config.products[slug] ?? [])
    .map((f) => resolve(f))
    .filter((src): src is string => Boolean(src))
    .map((src, i) => ({ src, alt: i === 0 ? alt : `${alt} (${i + 1})`, ratio: '4/5' }));
}

/** Foto de un tueste (cafe_light, cafe_medium, cafe_dark); si no existe, la primera foto del café. */
export function roastImage(slug: string, roast: string, alt: string): SiteImage | null {
  const file = config.roasts?.[slug]?.[roast];
  const src = file ? resolve(file) : null;
  return src ? { src, alt, ratio: '4/5' } : productImages(slug, alt)[0] ?? null;
}

/** Cualquier archivo de public/images por nombre (fotos de fincas). */
export function fileImage(file: string, alt: string, ratio = '4/3'): SiteImage | null {
  const src = resolve(file);
  return src ? { src, alt, ratio } : null;
}
