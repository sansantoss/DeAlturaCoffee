'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { getAdmin } from '@/lib/admin';
import { repo } from '@/lib/db';

const customerSchema = z.object({
  id: z.string().min(1),
  status: z.enum(['pending', 'approved', 'suspended']),
  priceTier: z.enum(['standard', 'partner']),
  invoiceTermsDays: z.enum(['none', '15', '30', '45']),
});

/** Approve / pause an account, set its price tier and invoice terms. */
export async function adminUpdateCustomer(form: FormData) {
  if (!(await getAdmin())) throw new Error('Forbidden');
  const d = customerSchema.parse(Object.fromEntries(form));
  await repo.customers.update(d.id, {
    status: d.status,
    priceTier: d.priceTier,
    invoiceTermsDays: d.invoiceTermsDays === 'none' ? null : Number(d.invoiceTermsDays),
  });
  revalidatePath('/[locale]/admin', 'page');
}

const orderSchema = z.object({
  id: z.string().min(1),
  status: z.enum(['awaiting_payment', 'paid', 'invoiced', 'roasting', 'shipped', 'delivered', 'cancelled']),
});

/** Move an order through roasting → shipped → delivered (or cancel it). */
export async function adminUpdateOrder(form: FormData) {
  if (!(await getAdmin())) throw new Error('Forbidden');
  const d = orderSchema.parse(Object.fromEntries(form));
  await repo.orders.updateStatus(d.id, d.status);
  revalidatePath('/[locale]/admin', 'page');
}
