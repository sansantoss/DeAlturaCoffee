import { promises as fs } from 'node:fs';
import path from 'node:path';

/** Sirve las fotos subidas en modo local (.data/uploads). En producción las fotos viven en Supabase Storage. */
const TYPES: Record<string, string> = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };

export async function GET(_: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const parts = (await params).path;
  if (parts.some((p) => p.includes('..'))) return new Response('Not found', { status: 404 });
  const file = path.join(process.cwd(), '.data', 'uploads', ...parts);
  try {
    const data = await fs.readFile(file);
    const ext = file.split('.').pop()?.toLowerCase() ?? '';
    return new Response(new Uint8Array(data), { headers: { 'Content-Type': TYPES[ext] ?? 'application/octet-stream', 'Cache-Control': 'public, max-age=31536000, immutable' } });
  } catch {
    return new Response('Not found', { status: 404 });
  }
}
