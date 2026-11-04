import type { Customer, Order } from './types';

/**
 * Cuentas por cobrar: pedidos con factura (crédito) que todavía no se cobran.
 * Vencimiento = fecha del pedido + días de crédito del cliente (30 si no tiene).
 */

export type AgingBucket = 'current' | 'soon' | 'd1_30' | 'd31_60' | 'd60';
export const BUCKETS: AgingBucket[] = ['current', 'soon', 'd1_30', 'd31_60', 'd60'];

export interface Receivable {
  order: Order;
  customer?: Customer;
  issued: string; // YYYY-MM-DD
  due: string; // YYYY-MM-DD
  termsDays: number;
  daysLeft: number; // negativo = días vencida
  bucket: AgingBucket;
}

const TZ = 'America/Toronto';
export const dayKey = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(d);
const addDays = (key: string, n: number) => { const d = new Date(`${key}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const diffDays = (a: string, b: string) => Math.round((Date.parse(`${a}T12:00:00Z`) - Date.parse(`${b}T12:00:00Z`)) / 864e5);

export const dueDateOf = (order: Order, customer?: Customer) => addDays(dayKey(new Date(order.createdAt)), customer?.invoiceTermsDays ?? 30);

export function bucketOf(daysLeft: number): AgingBucket {
  if (daysLeft > 7) return 'current';
  if (daysLeft >= 0) return 'soon';
  if (daysLeft >= -30) return 'd1_30';
  if (daysLeft >= -60) return 'd31_60';
  return 'd60';
}

export interface ReceivablesSummary {
  items: Receivable[];
  total: number;
  overdue: number;
  dueSoon: number; // vence en 7 días o menos
  byBucket: Record<AgingBucket, number>;
  collectedThisMonth: number;
  byCustomer: { customer?: Customer; customerId: string; total: number; overdue: number; count: number }[];
}

export function buildReceivables(orders: Order[], customers: Customer[], now = new Date()): ReceivablesSummary {
  const today = dayKey(now);
  const byId = new Map(customers.map((c) => [c.id, c]));
  const items: Receivable[] = orders
    .filter((o) => o.paymentMethod === 'invoice' && !o.paidAt && o.status !== 'cancelled')
    .map((order) => {
      const customer = byId.get(order.customerId);
      const due = dueDateOf(order, customer);
      const daysLeft = diffDays(due, today);
      return { order, customer, issued: dayKey(new Date(order.createdAt)), due, termsDays: customer?.invoiceTermsDays ?? 30, daysLeft, bucket: bucketOf(daysLeft) };
    })
    .sort((a, b) => a.daysLeft - b.daysLeft);

  const byBucket = Object.fromEntries(BUCKETS.map((b) => [b, 0])) as Record<AgingBucket, number>;
  for (const r of items) byBucket[r.bucket] += r.order.totalCents;
  const month = today.slice(0, 7);
  const collectedThisMonth = orders
    .filter((o) => o.paidAt && dayKey(new Date(o.paidAt)).startsWith(month) && o.status !== 'cancelled')
    .reduce((s, o) => s + o.totalCents, 0);

  const cust = new Map<string, ReceivablesSummary['byCustomer'][number]>();
  for (const r of items) {
    const c = cust.get(r.order.customerId) ?? { customer: r.customer, customerId: r.order.customerId, total: 0, overdue: 0, count: 0 };
    c.total += r.order.totalCents;
    if (r.daysLeft < 0) c.overdue += r.order.totalCents;
    c.count += 1;
    cust.set(r.order.customerId, c);
  }

  return {
    items,
    total: items.reduce((s, r) => s + r.order.totalCents, 0),
    overdue: items.filter((r) => r.daysLeft < 0).reduce((s, r) => s + r.order.totalCents, 0),
    dueSoon: byBucket.soon,
    byBucket,
    collectedThisMonth,
    byCustomer: [...cust.values()].sort((a, b) => b.overdue - a.overdue || b.total - a.total),
  };
}
