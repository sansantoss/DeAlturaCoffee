import type { NextRequest } from 'next/server';
import createMiddleware from 'next-intl/middleware';
import { createServerClient } from '@supabase/ssr';
import { routing } from './i18n/routing';

const intl = createMiddleware(routing);

/**
 * Runs before every page:
 * 1. next-intl picks the language (cookie > browser language > English) and redirects / to /en, /fr or /es.
 * 2. In Supabase mode, refreshes the auth session cookie so signed-in buyers stay signed in.
 */
export default async function proxy(request: NextRequest) {
  const response = intl(request);

  if (process.env.DATA_BACKEND === 'supabase') {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => request.cookies.getAll(),
          setAll: (list) =>
            list.forEach(({ name, value, options }) => response.cookies.set(name, value, options)),
        },
      },
    );
    await supabase.auth.getUser();
  }

  return response;
}

export const config = {
  // Everything except API routes, Next internals and files with an extension.
  matcher: '/((?!api|_next|_vercel|.*\\..*).*)',
};
