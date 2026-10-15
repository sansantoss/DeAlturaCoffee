import 'server-only';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getUserId } from './auth';
import { backend, repo } from './db';
import type { Customer } from './types';

/**
 * Who is calling the JSON API.
 * - Mobile app (Expo): signs in with Supabase Auth and sends `Authorization: Bearer <access_token>`.
 * - Browser / local mode: falls back to the website session cookie.
 */
export async function apiCustomer(req: Request): Promise<Customer | null> {
  const auth = req.headers.get('authorization');
  if (auth?.startsWith('Bearer ') && backend === 'supabase') {
    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      auth: { persistSession: false },
    });
    const { data } = await sb.auth.getUser(auth.slice(7));
    return data.user ? repo.customers.getById(data.user.id) : null;
  }
  const id = await getUserId();
  return id ? repo.customers.getById(id) : null;
}

export const json = (data: unknown, status = 200) => NextResponse.json(data, { status });
export const unauthorized = () => json({ error: 'unauthorized' }, 401);
