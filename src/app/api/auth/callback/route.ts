import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

/**
 * Destino del enlace del correo de confirmación de Supabase.
 * Cambia el código del enlace por una sesión y manda al cliente a su cuenta.
 * Vive en /api para que el selector de idioma no lo redirija.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const nextParam = url.searchParams.get('next') ?? '/en/account';
  const next = nextParam.startsWith('/') && !nextParam.startsWith('//') ? nextParam : '/en/account';

  if (code && process.env.DATA_BACKEND === 'supabase') {
    const store = await cookies();
    const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      cookies: {
        getAll: () => store.getAll(),
        setAll: (list) => list.forEach(({ name, value, options }) => store.set(name, value, options)),
      },
    });
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, url.origin));
  }
  // Enlace vencido o inválido: al login, que ya sabe explicar qué hacer.
  const locale = next.split('/')[1] || 'en';
  return NextResponse.redirect(new URL(`/${locale}/login`, url.origin));
}
