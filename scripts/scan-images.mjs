// Lista las fotos que existen en public/images y escribe src/lib/images.manifest.json.
// Corre solo antes de `npm run dev` y `npm run build` (predev / prebuild).
// Así en Vercel la web sabe qué fotos hay sin leer el disco en cada visita.
import { readdirSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const DIR = path.join(process.cwd(), 'public', 'images');
const EXT = /\.(jpe?g|png|webp|avif)$/i;
const manifest = {};
if (existsSync(DIR)) {
  for (const f of readdirSync(DIR)) {
    if (!EXT.test(f)) continue;
    const key = f.replace(EXT, '').toLowerCase();
    manifest[key] = `/images/${f}`;
  }
}
mkdirSync(path.join(process.cwd(), 'src', 'lib'), { recursive: true });
writeFileSync(path.join(process.cwd(), 'src', 'lib', 'images.manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`Fotos encontradas: ${Object.keys(manifest).length}`);
