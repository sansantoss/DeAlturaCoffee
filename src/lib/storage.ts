import 'server-only';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { backend } from './db';

/**
 * Fotos subidas desde el admin.
 *  - Supabase: bucket público "catalog" (lo crea 0005_catalog.sql). Devuelve la URL pública.
 *  - Local: .data/uploads/, servido por /api/uploads/… (solo para desarrollo).
 */
const BUCKET = 'catalog';
const TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

export async function uploadImage(file: File, folder: string): Promise<string> {
  const ext = TYPES[file.type];
  if (!ext) throw new Error('Formato no permitido: usa JPG, PNG o WebP.');
  if (file.size > MAX_UPLOAD_BYTES) throw new Error('La foto pesa más de 5 MB.');
  const safeFolder = folder.replace(/[^a-z0-9/_-]/gi, '').replace(/^\/+|\/+$/g, '') || 'misc';
  const key = `${safeFolder}/${Date.now().toString(36)}-${randomUUID().slice(0, 8)}.${ext}`;
  const bytes = Buffer.from(await file.arrayBuffer());

  if (backend === 'supabase') {
    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
    const { error } = await sb.storage.from(BUCKET).upload(key, bytes, { contentType: file.type, upsert: false, cacheControl: '31536000' });
    if (error) throw new Error(`${error.message}${/not found/i.test(error.message) ? ' (falta el bucket "catalog": corre 0005_catalog.sql)' : ''}`);
    return sb.storage.from(BUCKET).getPublicUrl(key).data.publicUrl;
  }

  const dest = path.join(process.cwd(), '.data', 'uploads', key);
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.writeFile(dest, bytes);
  return `/api/uploads/${key}`;
}
