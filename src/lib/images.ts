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

type Slot = { file: string; ratio: string; alt: Record<Locale, string>; video?: string; overlay?: number; position?: string };
const config = imagesJson as unknown as {
  slots: Record<string, Slot>;
  products: Record<string, string[]>;
  roasts?: Record<string, Record<string, string>>;
};

export type SlotName = keyof typeof imagesJson.slots;
export interface SiteImage { src: string; alt: string; ratio: string }

const EXT = /\.(jpe?g|png|webp|avif)$/i;
const VEXT = /\.(mp4|webm)$/i;

/** En desarrollo lee la carpeta en vivo (para ver la foto al recargar); en producción usa el manifest. */
function available(): Record<string, string> {
  if (process.env.NODE_ENV !== 'development') return builtManifest as Record<string, string>;
  try {
    const out: Record<string, string> = {};
    for (const f of readdirSync(path.join(process.cwd(), 'public', 'images'))) {
      if (EXT.test(f)) out[f.replace(EXT, '').toLowerCase()] = `/images/${f}`;
    }
    try {
      for (const f of readdirSync(path.join(process.cwd(), 'public', 'videos'))) {
        if (VEXT.test(f)) out[`video/${f.replace(VEXT, '').toLowerCase()}${/\.webm$/i.test(f) ? '.webm' : ''}`] = `/videos/${f}`;
      }
    } catch { /* sin carpeta de videos */ }
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

export interface HeroMedia {
  image: SiteImage | null;
  video: { mp4?: string; webm?: string } | null;
  overlay: number;
  position: string;
}

/** Fondo del inicio: foto, video opcional, velo y encuadre, todo desde content/images.json → slots.hero. */
export function heroMedia(locale: Locale): HeroMedia {
  const s = config.slots.hero;
  const all = available();
  const name = (s.video ?? '').replace(VEXT, '').toLowerCase().trim();
  const mp4 = name ? all[`video/${name}`] : undefined;
  const webm = name ? all[`video/${name}.webm`] : undefined;
  const overlay = typeof s.overlay === 'number' ? Math.min(0.9, Math.max(0, s.overlay)) : 0.55;
  return {
    image: siteImage('hero', locale),
    video: mp4 || webm ? { mp4, webm } : null,
    overlay,
    position: s.position || 'center',
  };
}

/* ---------- Fotos subidas desde Admin › Catálogo (URLs), con respaldo a los archivos de public/images ---------- */

type WithPhotos = { slug: string; images?: string[]; roastImages?: Partial<Record<string, string>> };

/** Galería del café: las subidas en el admin; si no hay, las de content/images.json. */
export function productPhotos(p: WithPhotos, alt: string): SiteImage[] {
  if (p.images?.length) return p.images.map((src, i) => ({ src, alt: i === 0 ? alt : `${alt} (${i + 1})`, ratio: '4/5' }));
  return productImages(p.slug, alt);
}

/** Foto de un tueste: la asignada en el admin, luego la de archivos, luego la primera de la galería. */
export function roastPhoto(p: WithPhotos, roast: string, alt: string): SiteImage | null {
  const url = p.roastImages?.[roast];
  if (url) return { src: url, alt, ratio: '4/5' };
  if (p.images?.length) {
    const file = config.roasts?.[p.slug]?.[roast];
    const src = file ? resolve(file) : null;
    return src ? { src, alt, ratio: '4/5' } : { src: p.images[0], alt, ratio: '4/5' };
  }
  return roastImage(p.slug, roast, alt);
}

/** Foto de finca: URL subida o nombre de archivo en public/images. */
export function farmPhoto(image: string, alt: string): SiteImage | null {
  if (!image) return null;
  if (/^(https?:)?\//.test(image)) return { src: image, alt, ratio: '4/3' };
  return fileImage(image, alt, '4/3');
}
