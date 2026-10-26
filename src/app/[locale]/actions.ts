'use server';

import { z } from 'zod';
import { getLocale } from 'next-intl/server';
import { revalidatePath } from 'next/cache';
import { redirect as nextRedirect } from 'next/navigation';
import { redirect } from '@/i18n/navigation';
import { getCurrentCustomer, signIn, signOut, signUp } from '@/lib/auth';
import { readCart, writeCart } from '@/lib/cart';
import { findFormat } from '@/lib/catalog';
import { repo } from '@/lib/db';
import { createCheckoutSession, paymentsEnabled } from '@/lib/payments';
import { createOrder } from '@/lib/orders';
import { setOwnPassword } from '@/lib/accounts';
import type { Address, Locale, Order, Province } from '@/lib/types';

const PROVINCES = ['AB', 'BC', 'MB', 'NB', 'NL', 'NS', 'NT', 'NU', 'ON', 'PE', 'QC', 'SK', 'YT'] as const;
const ROAST = z.enum(['light', 'medium', 'dark']);

export type FormState = { error?: string; fields?: string[]; ok?: boolean };

async function locale(): Promise<Locale> {
  return (await getLocale()) as Locale;
}

/* ---------------- Cart ---------------- */

export async function addToCart(_: FormState, form: FormData): Promise<FormState> {
  const customer = await getCurrentCustomer();
  if (!customer || customer.status !== 'approved') return { error: 'auth' };
  const parsed = z
    .object({ sku: z.string().min(1), roast: ROAST, quantity: z.coerce.number().int().min(1).max(999) })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: 'invalid' };
  const found = await findFormat(parsed.data.sku);
  if (!found || !found.product.roasts.includes(parsed.data.roast)) return { error: 'invalid' };

  const cart = await readCart();
  const existing = cart.find((l) => l.sku === parsed.data.sku && l.roast === parsed.data.roast);
  if (existing) existing.quantity += parsed.data.quantity;
  else cart.push(parsed.data);
  await writeCart(cart);
  revalidatePath('/', 'layout');
  return { ok: true };
}

export async function updateCartLine(form: FormData) {
  const parsed = z
    .object({ sku: z.string(), roast: ROAST, quantity: z.coerce.number().int().min(0).max(999) })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) return;
  const cart = (await readCart())
    .map((l) => (l.sku === parsed.data.sku && l.roast === parsed.data.roast ? { ...l, quantity: parsed.data.quantity } : l))
    .filter((l) => l.quantity > 0);
  await writeCart(cart);
  revalidatePath('/', 'layout');
}

/* ---------------- Auth ---------------- */

export async function signInAction(_: FormState, form: FormData): Promise<FormState> {
  const email = String(form.get('email') ?? '').trim();
  const password = String(form.get('password') ?? '');
  if (!email || !password) return { error: 'invalid' };
  const res = await signIn(email, password);
  if (!res.ok) return { error: res.error === 'unconfirmed' ? 'unconfirmed' : 'invalid' };
  const next = String(form.get('next') ?? '');
  redirect({ href: next.startsWith('/') && !next.startsWith('//') ? next : '/account', locale: await locale() });
  return {};
}

const applySchema = z.object({
  businessName: z.string().trim().min(2).max(120),
  contactName: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(200),
  password: z.string().min(8).max(200),
  phone: z.string().trim().max(40).optional().default(''),
  businessType: z.enum(['cafe', 'restaurant', 'retail', 'office', 'other']),
  city: z.string().trim().min(2).max(80),
  province: z.enum(PROVINCES),
  kg: z.coerce.number().int().min(1).max(100000),
  message: z.string().trim().max(2000).optional().default(''),
});

export async function applyAction(_: FormState, form: FormData): Promise<FormState> {
  const parsed = applySchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) {
    return { error: 'invalid', fields: parsed.error.issues.map((i) => String(i.path[0])) };
  }
  const d = parsed.data;
  const loc = await locale();
  if (await repo.customers.getByEmail(d.email)) return { error: 'exists' };
  const res = await signUp(d.email, d.password, `/${loc}/account`);
  if (!res.ok) return { error: res.error === 'exists' ? 'exists' : 'unknown' };

  const now = new Date().toISOString();
  await repo.customers.create({
    id: res.userId,
    email: d.email,
    contactName: d.contactName,
    businessName: d.businessName,
    businessType: d.businessType,
    phone: d.phone || undefined,
    preferredLocale: loc,
    status: 'pending',
    priceTier: 'standard',
    invoiceTermsDays: null,
    addresses: [],
    createdAt: now,
  });
  await repo.applications.create({
    id: crypto.randomUUID(),
    email: d.email,
    contactName: d.contactName,
    businessName: d.businessName,
    businessType: d.businessType,
    city: d.city,
    province: d.province as Province,
    estimatedKgPerMonth: d.kg,
    message: d.message || undefined,
    locale: loc,
    createdAt: now,
  });
  if (res.needsConfirmation) return { ok: true };
  redirect({ href: '/account', locale: loc });
  return {};
}

export async function signOutAction() {
  await signOut();
  redirect({ href: '/', locale: await locale() });
}

/* ---------------- Profile ---------------- */

const profileSchema = z.object({
  businessName: z.string().trim().min(2).max(120),
  contactName: z.string().trim().min(2).max(120),
  phone: z.string().trim().max(40).optional().default(''),
  gstNumber: z.string().trim().max(40).optional().default(''),
  preferredLocale: z.enum(['en', 'fr', 'es']),
  addressLabel: z.string().trim().max(80).optional().default(''),
  line1: z.string().trim().max(160).optional().default(''),
  line2: z.string().trim().max(160).optional().default(''),
  city: z.string().trim().max(80).optional().default(''),
  province: z.enum(PROVINCES).optional(),
  postalCode: z.string().trim().max(10).optional().default(''),
});

export async function saveProfileAction(_: FormState, form: FormData): Promise<FormState> {
  const customer = await getCurrentCustomer();
  if (!customer) return { error: 'auth' };
  const parsed = profileSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: 'invalid', fields: parsed.error.issues.map((i) => String(i.path[0])) };
  const d = parsed.data;

  let addresses: Address[] = customer.addresses;
  if (d.line1 || d.city || d.postalCode) {
    const postal = d.postalCode.toUpperCase().replace(/\s+/g, '');
    const fields: string[] = [];
    if (!d.line1) fields.push('line1');
    if (!d.city) fields.push('city');
    if (!d.province) fields.push('province');
    if (!/^[A-Z]\d[A-Z]\d[A-Z]\d$/.test(postal)) fields.push('postalCode');
    if (fields.length) return { error: 'invalid', fields };
    const existing = customer.addresses.find((a) => a.isDefault);
    addresses = [
      {
        id: existing?.id ?? crypto.randomUUID(),
        label: d.addressLabel || d.businessName,
        line1: d.line1,
        line2: d.line2 || undefined,
        city: d.city,
        province: d.province!,
        postalCode: `${postal.slice(0, 3)} ${postal.slice(3)}`,
        isDefault: true,
      },
    ];
  }

  await repo.customers.update(customer.id, {
    businessName: d.businessName,
    contactName: d.contactName,
    phone: d.phone || undefined,
    gstNumber: d.gstNumber || undefined,
    preferredLocale: d.preferredLocale,
    addresses,
  });
  revalidatePath('/', 'layout');
  return { ok: true };
}

/* ---------------- Orders ---------------- */

export async function placeOrderAction(_: FormState, form: FormData): Promise<FormState> {
  const loc = await locale();
  const customer = await getCurrentCustomer();
  const result = await createOrder(customer, await readCart(), {
    payment: form.get('payment') === 'invoice' ? 'invoice' : 'card',
    notes: String(form.get('notes') ?? ''),
    locale: loc,
  });
  if (!result.ok) return { error: result.error };
  const { order } = result;
  await writeCart([]);
  revalidatePath('/', 'layout');

  if (order.paymentMethod === 'card' && paymentsEnabled()) {
    const session = await createCheckoutSession(order, customer!.email, loc);
    if (session?.url) {
      await repo.orders.updateStatus(order.id, 'awaiting_payment', { stripeSessionId: session.id });
      nextRedirect(session.url);
    }
  }
  redirect({ href: `/account/orders/${order.id}`, locale: loc });
  return {};
}

export async function payOrderAction(form: FormData) {
  const loc = await locale();
  const customer = await getCurrentCustomer();
  const order = await repo.orders.getById(String(form.get('orderId') ?? ''));
  if (!customer || !order || order.customerId !== customer.id || order.status !== 'awaiting_payment') return;
  const session = await createCheckoutSession(order, customer.email, loc);
  if (session?.url) {
    await repo.orders.updateStatus(order.id, 'awaiting_payment', { stripeSessionId: session.id });
    nextRedirect(session.url);
  }
}

/* ---------------- Password ---------------- */

export async function changePasswordAction(_: FormState, form: FormData): Promise<FormState> {
  const customer = await getCurrentCustomer();
  if (!customer) return { error: 'auth' };
  const password = String(form.get('password') ?? '');
  const confirm = String(form.get('confirm') ?? '');
  if (password.length < 8) return { error: 'short', fields: ['password'] };
  if (password !== confirm) return { error: 'mismatch', fields: ['confirm'] };
  await setOwnPassword(customer.id, password);
  return { ok: true };
}
