import 'server-only';
import { cookies } from 'next/headers';
import { createHmac, randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { createServerClient } from '@supabase/ssr';
import { backend, repo } from './db';
import { mutateDb, readDb } from './db/local';
import type { Customer } from './types';

/**
 * Authentication with two backends behind one API:
 *  - supabase: Supabase Auth (email + password), session in Supabase's cookies.
 *  - local:    password hashed with scrypt in .data/db.json, session in a signed httpOnly cookie.
 */

const scrypt = promisify(scryptCb) as (pw: string, salt: string, len: number) => Promise<Buffer>;
const SESSION_COOKIE = 'da_session';
const MAX_AGE = 60 * 60 * 24 * 30;

export type AuthResult = { ok: true; userId: string } | { ok: false; error: 'invalid' | 'exists' | 'unknown' };

/* ---------------- Supabase ---------------- */

async function supabase() {
  const store = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => store.getAll(),
        setAll: (list) => {
          try {
            list.forEach(({ name, value, options }) => store.set(name, value, options));
          } catch {
            /* called from a Server Component: the proxy refreshes the session instead */
          }
        },
      },
    },
  );
}

/* ---------------- Local ---------------- */

function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s && process.env.NODE_ENV === 'production') throw new Error('AUTH_SECRET is required');
  return s ?? 'dev-only-secret';
}

function sign(value: string) {
  return createHmac('sha256', secret()).update(value).digest('base64url');
}

async function hashPassword(pw: string) {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${(await scrypt(pw, salt, 64)).toString('hex')}`;
}

async function verifyPassword(pw: string, stored: string) {
  const [salt, hash] = stored.split(':');
  const candidate = await scrypt(pw, salt, 64);
  const expected = Buffer.from(hash, 'hex');
  return expected.length === candidate.length && timingSafeEqual(expected, candidate);
}

async function setLocalSession(userId: string) {
  const exp = Math.floor(Date.now() / 1000) + MAX_AGE;
  const payload = `${userId}.${exp}`;
  (await cookies()).set(SESSION_COOKIE, `${payload}.${sign(payload)}`, {
    httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production',
    path: '/', maxAge: MAX_AGE,
  });
}

/* ---------------- Public API ---------------- */

export async function getUserId(): Promise<string | null> {
  if (backend === 'supabase') {
    const { data } = await (await supabase()).auth.getUser();
    return data.user?.id ?? null;
  }
  const raw = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!raw) return null;
  const parts = raw.split('.');
  if (parts.length !== 3) return null;
  const [userId, exp, sig] = parts;
  const expected = sign(`${userId}.${exp}`);
  if (sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  if (Number(exp) < Date.now() / 1000) return null;
  return userId;
}

export async function getCurrentCustomer(): Promise<Customer | null> {
  const id = await getUserId();
  return id ? repo.customers.getById(id) : null;
}

export async function signIn(email: string, password: string): Promise<AuthResult> {
  if (backend === 'supabase') {
    const { data, error } = await (await supabase()).auth.signInWithPassword({ email, password });
    return error || !data.user ? { ok: false, error: 'invalid' } : { ok: true, userId: data.user.id };
  }
  const db = await readDb();
  const cred = db.credentials.find((c) => c.email.toLowerCase() === email.toLowerCase());
  if (!cred || !(await verifyPassword(password, cred.passwordHash))) return { ok: false, error: 'invalid' };
  await setLocalSession(cred.userId);
  return { ok: true, userId: cred.userId };
}

export async function signUp(email: string, password: string): Promise<AuthResult> {
  if (backend === 'supabase') {
    const { data, error } = await (await supabase()).auth.signUp({ email, password });
    if (error) return { ok: false, error: /registered|exists/i.test(error.message) ? 'exists' : 'unknown' };
    return data.user ? { ok: true, userId: data.user.id } : { ok: false, error: 'unknown' };
  }
  const passwordHash = await hashPassword(password);
  const result = await mutateDb((db): AuthResult => {
    if (db.credentials.some((c) => c.email.toLowerCase() === email.toLowerCase())) {
      return { ok: false, error: 'exists' };
    }
    const userId = crypto.randomUUID();
    db.credentials.push({ userId, email, passwordHash });
    return { ok: true, userId };
  });
  if (result.ok) await setLocalSession(result.userId);
  return result;
}

export async function signOut() {
  if (backend === 'supabase') {
    await (await supabase()).auth.signOut();
    return;
  }
  (await cookies()).delete(SESSION_COOKIE);
}

export { hashPassword };
