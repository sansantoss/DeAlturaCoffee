import 'server-only';
import { randomBytes, randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { backend, repo } from './db';
import { mutateDb } from './db/local';
import { hashPassword } from './auth';
import type { Address, Customer, Locale, PriceTier } from './types';

/**
 * Cuentas que maneja el equipo: clientes que piden por correo o teléfono.
 * Se crean con un usuario de login (para que el id ya exista) pero sin contraseña conocida;
 * cuando el cliente quiera entrar, el admin le da acceso con una contraseña temporal.
 * Como es la misma cuenta, todos sus pedidos anteriores ya están ahí.
 */

function adminAuth() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  }).auth.admin;
}

/** Contraseña temporal fácil de dictar por teléfono: 3 bloques de 4, sin caracteres confusos. */
function tempPassword() {
  const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789';
  const bytes = randomBytes(12);
  const chars = Array.from(bytes, (b) => alphabet[b % alphabet.length]);
  return `${chars.slice(0, 4).join('')}-${chars.slice(4, 8).join('')}-${chars.slice(8, 12).join('')}`;
}

export interface ManagedInput {
  email: string;
  businessName: string;
  contactName: string;
  businessType: Customer['businessType'];
  phone?: string;
  priceTier: PriceTier;
  invoiceTermsDays: number | null;
  preferredLocale: Locale;
  address: Omit<Address, 'id' | 'isDefault'>;
}

export type ManagedResult = { ok: true; customer: Customer } | { ok: false; error: 'exists' | 'unknown' };

export async function createManagedCustomer(input: ManagedInput): Promise<ManagedResult> {
  if (await repo.customers.getByEmail(input.email)) return { ok: false, error: 'exists' };

  let id: string;
  if (backend === 'supabase') {
    const { data, error } = await adminAuth().createUser({
      email: input.email,
      password: randomBytes(24).toString('base64url'), // nadie la conoce hasta "Dar acceso"
      email_confirm: true,
    });
    if (error || !data.user) return { ok: false, error: /registered|exists/i.test(error?.message ?? '') ? 'exists' : 'unknown' };
    id = data.user.id;
  } else {
    id = randomUUID();
    const passwordHash = await hashPassword(randomBytes(24).toString('base64url'));
    await mutateDb((db) => { db.credentials.push({ userId: id, email: input.email, passwordHash }); });
  }

  const customer = await repo.customers.create({
    id,
    email: input.email,
    contactName: input.contactName,
    businessName: input.businessName,
    businessType: input.businessType,
    phone: input.phone || undefined,
    preferredLocale: input.preferredLocale,
    status: 'approved',
    priceTier: input.priceTier,
    invoiceTermsDays: input.invoiceTermsDays,
    addresses: [{ ...input.address, id: randomUUID(), isDefault: true }],
    createdAt: new Date().toISOString(),
    hasLogin: false,
  });
  return { ok: true, customer };
}

/** Genera una contraseña temporal para el cliente y la regresa UNA vez para que el admin se la pase. */
export async function grantAccess(customerId: string): Promise<string> {
  const password = tempPassword();
  if (backend === 'supabase') {
    const { error } = await adminAuth().updateUserById(customerId, { password });
    if (error) throw new Error(error.message);
  } else {
    const passwordHash = await hashPassword(password);
    await mutateDb((db) => {
      const cred = db.credentials.find((c) => c.userId === customerId);
      if (!cred) throw new Error('Customer has no login');
      cred.passwordHash = passwordHash;
    });
  }
  await repo.customers.update(customerId, { hasLogin: true });
  return password;
}

/** El cliente cambia su propia contraseña (ya con sesión). */
export async function setOwnPassword(customerId: string, password: string): Promise<void> {
  if (backend === 'supabase') {
    const { error } = await adminAuth().updateUserById(customerId, { password });
    if (error) throw new Error(error.message);
    return;
  }
  const passwordHash = await hashPassword(password);
  await mutateDb((db) => {
    const cred = db.credentials.find((c) => c.userId === customerId);
    if (cred) cred.passwordHash = passwordHash;
  });
}
