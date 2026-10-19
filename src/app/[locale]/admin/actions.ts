'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { getLocale } from 'next-intl/server';
import { getAdmin } from '@/lib/admin';
import { repo } from '@/lib/db';
import { createManagedCustomer, grantAccess } from '@/lib/accounts';
import { createOrder } from '@/lib/orders';
import type { Locale } from '@/lib/types';

const PROVINCES = ['AB', 'BC', 'MB', 'NB', 'NL', 'NS', 'NT', 'NU', 'ON', 'PE', 'QC', 'SK', 'YT'] as const;
const refresh = () => revalidatePath('/[locale]/admin', 'layout');

async function guard() {
  if (!(await getAdmin())) throw new Error('Forbidden');
}

/* ---------- Clientes ---------- */

const customerSchema = z.object({
  id: z.string().min(1),
  status: z.enum(['pending', 'approved', 'suspended']),
  priceTier: z.enum(['standard', 'partner']),
  invoiceTermsDays: z.enum(['none', '15', '30', '45']),
});

export async function adminUpdateCustomer(form: FormData) {
  await guard();
  const d = customerSchema.parse(Object.fromEntries(form));
  await repo.customers.update(d.id, {
    status: d.status,
    priceTier: d.priceTier,
    invoiceTermsDays: d.invoiceTermsDays === 'none' ? null : Number(d.invoiceTermsDays),
  });
  refresh();
}

export type AdminFormState = { error?: string; fields?: string[]; ok?: boolean; id?: string; password?: string };

const newCustomerSchema = z.object({
  businessName: z.string().trim().min(2).max(120),
  contactName: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(200),
  phone: z.string().trim().max(40).optional().default(''),
  businessType: z.enum(['cafe', 'restaurant', 'retail', 'office', 'other']),
  priceTier: z.enum(['standard', 'partner']),
  invoiceTermsDays: z.enum(['none', '15', '30', '45']),
  preferredLocale: z.enum(['en', 'fr', 'es']),
  line1: z.string().trim().min(3).max(160),
  line2: z.string().trim().max(160).optional().default(''),
  city: z.string().trim().min(2).max(80),
  province: z.enum(PROVINCES),
  postalCode: z.string().trim().min(3).max(10),
});

export async function adminCreateCustomer(_: AdminFormState, form: FormData): Promise<AdminFormState> {
  await guard();
  const parsed = newCustomerSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: 'invalid', fields: parsed.error.issues.map((i) => String(i.path[0])) };
  const d = parsed.data;
  const res = await createManagedCustomer({
    email: d.email,
    businessName: d.businessName,
    contactName: d.contactName,
    businessType: d.businessType,
    phone: d.phone,
    priceTier: d.priceTier,
    invoiceTermsDays: d.invoiceTermsDays === 'none' ? null : Number(d.invoiceTermsDays),
    preferredLocale: d.preferredLocale,
    address: { label: d.businessName, line1: d.line1, line2: d.line2 || undefined, city: d.city, province: d.province, postalCode: d.postalCode },
  });
  if (!res.ok) return { error: res.error };
  refresh();
  return { ok: true, id: res.customer.id };
}

export async function adminGrantAccess(_: AdminFormState, form: FormData): Promise<AdminFormState> {
  await guard();
  const id = String(form.get('id') ?? '');
  if (!id) return { error: 'invalid' };
  try {
    const password = await grantAccess(id);
    // Sin revalidar aquí: si la fila se vuelve a montar se pierde la contraseña antes de que el admin la copie.
    return { ok: true, password };
  } catch {
    return { error: 'unknown' };
  }
}

/* ---------- Pedidos ---------- */

const orderSchema = z.object({
  id: z.string().min(1),
  status: z.enum(['awaiting_payment', 'paid', 'invoiced', 'roasting', 'shipped', 'delivered', 'cancelled']),
});

export async function adminUpdateOrder(form: FormData) {
  await guard();
  const d = orderSchema.parse(Object.fromEntries(form));
  await repo.orders.updateStatus(d.id, d.status);
  refresh();
}

const newOrderSchema = z.object({
  customerId: z.string().min(1),
  payment: z.enum(['card', 'invoice']),
  notes: z.string().max(1000).optional().default(''),
  skipMinimum: z.string().optional(),
  lines: z.array(z.object({
    sku: z.string().min(1),
    roast: z.enum(['espresso', 'filter', 'omni']),
    quantity: z.number().int().min(1).max(999),
  })).min(1),
});

export async function adminCreateOrder(_: AdminFormState, form: FormData): Promise<AdminFormState> {
  await guard();
  let lines: unknown = [];
  try { lines = JSON.parse(String(form.get('lines') ?? '[]')); } catch { lines = []; }
  const parsed = newOrderSchema.safeParse({ ...Object.fromEntries(form), lines });
  if (!parsed.success) return { error: 'invalid' };
  const d = parsed.data;
  const customer = await repo.customers.getById(d.customerId);
  const res = await createOrder(customer, d.lines, {
    payment: d.payment,
    notes: d.notes,
    locale: (await getLocale()) as Locale,
    skipMinimum: d.skipMinimum === 'on',
  });
  if (!res.ok) return { error: res.error };
  refresh();
  return { ok: true, id: res.order.id };
}

/* ---------- Precios ---------- */

const priceSchema = z.object({
  sku: z.string().min(1),
  standard: z.coerce.number().positive().max(100000),
  partner: z.coerce.number().positive().max(100000),
});

export async function adminSetPrices(form: FormData) {
  await guard();
  const d = priceSchema.parse(Object.fromEntries(form));
  await repo.prices.set(d.sku, 'standard', Math.round(d.standard * 100));
  await repo.prices.set(d.sku, 'partner', Math.round(d.partner * 100));
  revalidatePath('/', 'layout'); // los precios cambian en todo el sitio
}
