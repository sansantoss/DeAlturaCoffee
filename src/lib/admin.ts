import 'server-only';
import { getCurrentCustomer } from './auth';
import { backend } from './db';
import type { Customer } from './types';

/**
 * Who can open /admin. Set ADMIN_EMAILS="ana@dealtura.ca,luis@dealtura.ca" in the environment.
 * In local mode, the seeded admin@dealtura.ca is an admin by default so the demo works.
 * (When there are more staff roles, move this to a `role` column on customers.)
 */
function adminEmails(): string[] {
  const fromEnv = (process.env.ADMIN_EMAILS ?? '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
  if (fromEnv.length) return fromEnv;
  return backend === 'local' ? ['admin@dealtura.ca'] : [];
}

export function isAdmin(customer: Customer | null): boolean {
  return Boolean(customer && adminEmails().includes(customer.email.toLowerCase()));
}

export async function getAdmin(): Promise<Customer | null> {
  const c = await getCurrentCustomer();
  return isAdmin(c) ? c : null;
}
