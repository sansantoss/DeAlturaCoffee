'use server';

import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { getAdmin } from '@/lib/admin';
import { repo } from '@/lib/db';
import { toKg } from '@/lib/finance';
import type { AdminFormState } from './actions';
import { describeError, type ActionResult } from '@/lib/action-error';

/* Inventario, compras de café verde, tuestes y gastos operativos. Montos en dólares → centavos. */

const refresh = () => revalidatePath('/[locale]/admin', 'layout');

async function guard() {
  if (!(await getAdmin())) throw new Error('Forbidden');
}

/** Acepta "12.50", "12,50" y "1,234.50". */
const num = z.preprocess((v) => {
  let s = String(v ?? '').trim().replace(/\s/g, '');
  if (s.includes(',') && !s.includes('.')) s = s.replace(',', '.');
  else s = s.replace(/,/g, '');
  return s === '' ? NaN : Number(s);
}, z.number().finite().nonnegative());
const positive = num.pipe(z.number().positive());
const cents = (dollars: number) => Math.round(dollars * 100);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

function fail(e: unknown): AdminFormState {
  if (e instanceof z.ZodError) return { error: 'invalid', fields: e.issues.map((i) => String(i.path[0])) };
  const r = describeError(e);
  return { error: r.error, detail: r.detail };
}

/** Para acciones sin formulario de estado (editar fila, borrar): nunca truenan, regresan el error. */
async function safe(fn: () => Promise<void>): Promise<ActionResult> {
  try {
    await fn();
    refresh();
    return {};
  } catch (e) {
    return describeError(e);
  }
}

/* ---------- Compras (lotes de café verde) ---------- */

const lotSchema = z.object({
  code: z.string().trim().min(1).max(40),
  supplier: z.string().trim().min(1).max(120),
  origin: z.string().trim().max(160).default(''),
  purchasedAt: date,
  status: z.enum(['ordered', 'in_transit', 'received']),
  quantity: positive,
  inputUnit: z.enum(['kg', 'lb']),
  pricePerUnit: num,
  currency: z.enum(['CAD', 'USD']),
  fxToCad: positive,
  notes: z.string().max(1000).optional().default(''),
});

export async function adminCreateLot(_: AdminFormState, form: FormData): Promise<AdminFormState> {
  await guard();
  try {
    const d = lotSchema.parse(Object.fromEntries(form));
    const id = randomUUID();
    await repo.lots.create({
      id, code: d.code, supplier: d.supplier, origin: d.origin, purchasedAt: d.purchasedAt, status: d.status,
      quantity: d.quantity, inputUnit: d.inputUnit, pricePerUnitCents: cents(d.pricePerUnit), currency: d.currency,
      fxToCad: d.currency === 'CAD' ? 1 : d.fxToCad, costs: [], notes: d.notes || undefined, createdAt: new Date().toISOString(),
    });
    refresh();
    return { ok: true, id };
  } catch (e) {
    return fail(e);
  }
}

export async function adminUpdateLot(form: FormData): Promise<ActionResult> {
  await guard();
  return safe(async () => {
  const d = z.object({
    id: z.string().min(1),
    status: z.enum(['ordered', 'in_transit', 'received']),
    fxToCad: positive,
  }).parse(Object.fromEntries(form));
  await repo.lots.update(d.id, { status: d.status, fxToCad: d.fxToCad });
  });
}

const costSchema = z.object({
  lotId: z.string().min(1),
  category: z.enum(['freight', 'customs', 'broker', 'insurance', 'storage', 'other']),
  label: z.string().trim().max(120).default(''),
  amount: positive,
  currency: z.enum(['CAD', 'USD']),
});

export async function adminAddLotCost(_: AdminFormState, form: FormData): Promise<AdminFormState> {
  await guard();
  try {
    const d = costSchema.parse(Object.fromEntries(form));
    const lot = await repo.lots.getById(d.lotId);
    if (!lot) return { error: 'unknown' };
    await repo.lots.update(lot.id, {
      costs: [...lot.costs, { id: randomUUID(), category: d.category, label: d.label, amountCents: cents(d.amount), currency: d.currency }],
    });
    refresh();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function adminRemoveLotCost(form: FormData): Promise<ActionResult> {
  await guard();
  return safe(async () => {
    const lotId = String(form.get('lotId') ?? '');
    const costId = String(form.get('costId') ?? '');
    const lot = await repo.lots.getById(lotId);
    if (!lot) return;
    await repo.lots.update(lotId, { costs: lot.costs.filter((c) => c.id !== costId) });
  });
}

/* ---------- Tuestes ---------- */

const batchSchema = z.object({
  lotId: z.string().min(1),
  roastedAt: date,
  roast: z.enum(['light', 'medium', 'dark']),
  greenQty: positive,
  greenUnit: z.enum(['kg', 'lb']),
  roastedQty: positive,
  roastedUnit: z.enum(['kg', 'lb']),
  roasterRate: num,
  roasterRateUnit: z.enum(['kg', 'lb']),
  roasterBasis: z.enum(['green', 'roasted']),
  packaging: num,
  notes: z.string().max(1000).optional().default(''),
});

export async function adminCreateBatch(_: AdminFormState, form: FormData): Promise<AdminFormState> {
  await guard();
  try {
    const d = batchSchema.parse(Object.fromEntries(form));
    const greenKg = toKg(d.greenQty, d.greenUnit);
    const roastedKg = toKg(d.roastedQty, d.roastedUnit);
    if (roastedKg > greenKg) return { error: 'roastedMore', fields: ['roastedQty'] };
    // El tostador puede cobrar por lb: se guarda siempre por kg.
    const ratePerKg = d.roasterRateUnit === 'lb' ? d.roasterRate / 0.45359237 : d.roasterRate;
    await repo.batches.create({
      id: randomUUID(), lotId: d.lotId, roastedAt: d.roastedAt, roast: d.roast,
      greenKg: Math.round(greenKg * 1000) / 1000, roastedKg: Math.round(roastedKg * 1000) / 1000,
      roasterRateCents: cents(ratePerKg), roasterBasis: d.roasterBasis, packagingCents: cents(d.packaging),
      notes: d.notes || undefined, createdAt: new Date().toISOString(),
    });
    refresh();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function adminDeleteBatch(form: FormData): Promise<ActionResult> {
  await guard();
  return safe(() => repo.batches.remove(String(form.get('id') ?? '')));
}

/* ---------- Gastos operativos ---------- */

const expenseSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/),
  tag: z.string().trim().min(1).max(40),
  description: z.string().trim().max(200).default(''),
  amount: positive,
});

export async function adminCreateExpense(_: AdminFormState, form: FormData): Promise<AdminFormState> {
  await guard();
  try {
    const d = expenseSchema.parse(Object.fromEntries(form));
    // Etiquetas consistentes: "renta" y "Renta" son la misma
    const tag = d.tag.charAt(0).toUpperCase() + d.tag.slice(1);
    await repo.expenses.create({
      id: randomUUID(), month: d.month, tag, description: d.description, amountCents: cents(d.amount), createdAt: new Date().toISOString(),
    });
    refresh();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function adminDeleteExpense(form: FormData): Promise<ActionResult> {
  await guard();
  return safe(() => repo.expenses.remove(String(form.get('id') ?? '')));
}
