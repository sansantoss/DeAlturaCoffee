import 'server-only';
import { getCurrentCustomer } from './auth';
import { backend } from './db';
import type { Customer } from './types';

/**
 * Who can open /admin.
 *   ADMIN_EMAILS="ana@dealtura.ca,luis@dealtura.ca"   → full access
 *   ADMIN_VIEWER_EMAILS="demo-admin@dealtura.ca"       → read-only: sees everything, can't change anything
 * In local mode, the seeded admin@dealtura.ca is an admin by default so the demo works.
 */
const list = (v: string | undefined) => (v ?? '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);

function adminEmails(): string[] {
  const fromEnv = list(process.env.ADMIN_EMAILS);
  if (fromEnv.length) return fromEnv;
  return backend === 'local' ? ['admin@dealtura.ca'] : [];
}

export type AdminRole = 'admin' | 'viewer';

export function adminRole(customer: Customer | null): AdminRole | null {
  if (!customer) return null;
  const email = customer.email.toLowerCase();
  if (adminEmails().includes(email)) return 'admin';
  if (list(process.env.ADMIN_VIEWER_EMAILS).includes(email)) return 'viewer';
  return null;
}

/** Full admin (can change data). */
export function isAdmin(customer: Customer | null): boolean {
  return adminRole(customer) === 'admin';
}

/** Admin or read-only viewer: can open the panel. */
export function isStaff(customer: Customer | null): boolean {
  return adminRole(customer) !== null;
}

export async function getAdmin(): Promise<Customer | null> {
  const c = await getCurrentCustomer();
  return isAdmin(c) ? c : null;
}

export async function getStaff(): Promise<Customer | null> {
  const c = await getCurrentCustomer();
  return isStaff(c) ? c : null;
}

/**
 * For server actions: null when the user may write, { error: 'readOnly' } for the demo account,
 * and throws for anyone else.
 */
export async function writeGuard(): Promise<{ error: 'readOnly' } | null> {
  const role = adminRole(await getCurrentCustomer());
  if (role === 'admin') return null;
  if (role === 'viewer') return { error: 'readOnly' };
  throw new Error('Forbidden');
}
