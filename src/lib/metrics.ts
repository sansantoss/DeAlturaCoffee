import 'server-only';
import type { Customer, Order, OrderStatus } from './types';

/** Métricas del panel. Se calculan sobre los pedidos (cancelados excluidos), en hora de Toronto. */

export type Period = 'today' | '7d' | 'month' | 'year';
export const PERIODS: Period[] = ['today', '7d', 'month', 'year'];
const TZ = 'America/Toronto';

const dayKey = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
const monthKey = (d: Date) => dayKey(d).slice(0, 7);
const addDays = (key: string, n: number) => {
  const d = new Date(`${key}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

export interface Bucket { key: string; label: string; cents: number; orders: number; current: boolean }
export interface ProductRow { productId: string; name: string; kg: number; units: number; cents: number }
export interface CustomerRow { id: string; name: string; orders: number; kg: number; cents: number }
export interface Totals { cents: number; orders: number; kg: number; avgCents: number }

export interface Dashboard {
  period: Period;
  totals: Totals;
  previous: Totals;
  series: Bucket[];
  products: ProductRow[];
  customers: CustomerRow[];
  byStatus: Record<OrderStatus, number>;
  toFulfil: number; // pagados/facturados/en tueste: trabajo pendiente
}

const kgOf = (o: Order) => o.lines.reduce((s, l) => s + (l.grams * l.quantity) / 1000, 0);

function totalsOf(orders: Order[]): Totals {
  const cents = orders.reduce((s, o) => s + o.totalCents, 0);
  const kg = orders.reduce((s, o) => s + kgOf(o), 0);
  return { cents, orders: orders.length, kg, avgCents: orders.length ? Math.round(cents / orders.length) : 0 };
}

/** Rango [desde, hasta] en claves YYYY-MM-DD, del periodo actual y del anterior (para comparar). */
function ranges(period: Period, now: Date) {
  const today = dayKey(now);
  if (period === 'today') return { cur: [today, today], prev: [addDays(today, -1), addDays(today, -1)] };
  if (period === '7d') return { cur: [addDays(today, -6), today], prev: [addDays(today, -13), addDays(today, -7)] };
  if (period === 'month') {
    const start = `${today.slice(0, 7)}-01`;
    const prevStart = `${addDays(start, -1).slice(0, 7)}-01`;
    const elapsed = Number(today.slice(8, 10)) - 1;
    return { cur: [start, today], prev: [prevStart, addDays(prevStart, elapsed)] }; // mismo número de días
  }
  const y = Number(today.slice(0, 4));
  return { cur: [`${y}-01-01`, today], prev: [`${y - 1}-01-01`, `${y - 1}${today.slice(4)}`] };
}

export function buildDashboard(all: Order[], customers: Customer[], period: Period, locale: string, now = new Date()): Dashboard {
  const live = all.filter((o) => o.status !== 'cancelled');
  const { cur, prev } = ranges(period, now);
  const inRange = (o: Order, [a, b]: string[]) => { const k = dayKey(new Date(o.createdAt)); return k >= a && k <= b; };
  const current = live.filter((o) => inRange(o, cur));
  const previous = live.filter((o) => inRange(o, prev));
  const today = dayKey(now);

  // Serie para la gráfica: días (hoy → últimos 14, 7d, mes) o meses (año)
  const series: Bucket[] = [];
  const fmtDay = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', timeZone: 'UTC' });
  const fmtMonth = new Intl.DateTimeFormat(locale, { month: 'short', timeZone: 'UTC' });
  if (period === 'year') {
    const y = today.slice(0, 4);
    for (let m = 1; m <= 12; m++) {
      const key = `${y}-${String(m).padStart(2, '0')}`;
      const os = live.filter((o) => monthKey(new Date(o.createdAt)) === key);
      series.push({ key, label: fmtMonth.format(new Date(`${key}-15T12:00:00Z`)), cents: os.reduce((s, o) => s + o.totalCents, 0), orders: os.length, current: key === today.slice(0, 7) });
    }
  } else {
    const [start, end] = period === 'today' ? [addDays(today, -13), today] : period === 'month' ? [cur[0], addDays(`${addDays(`${today.slice(0, 7)}-28`, 4).slice(0, 7)}-01`, -1)] : cur;
    for (let k = start; k <= end; k = addDays(k, 1)) {
      const os = live.filter((o) => dayKey(new Date(o.createdAt)) === k);
      series.push({ key: k, label: fmtDay.format(new Date(`${k}T12:00:00Z`)), cents: os.reduce((s, o) => s + o.totalCents, 0), orders: os.length, current: k === today });
    }
  }

  const productMap = new Map<string, ProductRow>();
  for (const o of current) for (const l of o.lines) {
    const r = productMap.get(l.productId) ?? { productId: l.productId, name: l.productName, kg: 0, units: 0, cents: 0 };
    r.kg += (l.grams * l.quantity) / 1000; r.units += l.quantity; r.cents += l.unitPriceCents * l.quantity;
    productMap.set(l.productId, r);
  }

  const names = new Map(customers.map((c) => [c.id, c.businessName]));
  const customerMap = new Map<string, CustomerRow>();
  for (const o of current) {
    const r = customerMap.get(o.customerId) ?? { id: o.customerId, name: names.get(o.customerId) ?? '—', orders: 0, kg: 0, cents: 0 };
    r.orders += 1; r.kg += kgOf(o); r.cents += o.totalCents;
    customerMap.set(o.customerId, r);
  }

  const byStatus = { awaiting_payment: 0, paid: 0, invoiced: 0, roasting: 0, shipped: 0, delivered: 0, cancelled: 0 } as Record<OrderStatus, number>;
  for (const o of all) byStatus[o.status] += 1;

  return {
    period,
    totals: totalsOf(current),
    previous: totalsOf(previous),
    series,
    products: [...productMap.values()].sort((a, b) => b.kg - a.kg),
    customers: [...customerMap.values()].sort((a, b) => b.cents - a.cents).slice(0, 8),
    byStatus,
    toFulfil: byStatus.paid + byStatus.invoiced + byStatus.roasting,
  };
}
