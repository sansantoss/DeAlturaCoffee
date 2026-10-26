import type { Expense, GreenLot, MassUnit, Order, RoastBatch, RoastLevel } from './types';
import { ROAST_LEVELS } from './types';

/**
 * Cuentas del negocio: costo aterrizado de cada compra, costo por kg de cada tueste,
 * inventario (verde y tostado) y márgenes por mes. Todo en CAD (centavos) y kg.
 * Funciones puras: se pueden probar y reusar en la app.
 */

export const LB_PER_KG = 2.20462262;
export const KG_PER_LB = 0.45359237;
export const toKg = (qty: number, unit: MassUnit) => (unit === 'lb' ? qty * KG_PER_LB : qty);
export const fromKg = (kg: number, unit: MassUnit) => (unit === 'lb' ? kg * LB_PER_KG : kg);

const toCad = (cents: number, currency: 'CAD' | 'USD', fx: number) => (currency === 'USD' ? cents * fx : cents);

export interface LotTotals {
  greenKg: number;
  coffeeCad: number; // el café en sí
  costsCad: number; // flete, aduana, etc.
  landedCad: number;
  perKgCad: number; // costo aterrizado por kg verde
  perLbCad: number;
  costsByCategory: Record<string, number>;
}

export function lotTotals(lot: GreenLot): LotTotals {
  const greenKg = toKg(lot.quantity, lot.inputUnit);
  const coffeeCad = toCad(lot.quantity * lot.pricePerUnitCents, lot.currency, lot.fxToCad);
  const costsByCategory: Record<string, number> = {};
  let costsCad = 0;
  for (const c of lot.costs) {
    const v = toCad(c.amountCents, c.currency, lot.fxToCad);
    costsCad += v;
    costsByCategory[c.category] = (costsByCategory[c.category] ?? 0) + v;
  }
  const landedCad = coffeeCad + costsCad;
  const perKgCad = greenKg > 0 ? landedCad / greenKg : 0;
  return { greenKg, coffeeCad, costsCad, landedCad, perKgCad, perLbCad: perKgCad * KG_PER_LB, costsByCategory };
}

export interface BatchTotals {
  greenCostCad: number;
  roasterCad: number;
  packagingCad: number;
  totalCad: number;
  perKgCad: number; // costo por kg tostado
  shrinkPct: number; // merma
}

export function batchTotals(b: RoastBatch, lot: GreenLot | undefined): BatchTotals {
  const greenCostCad = lot ? b.greenKg * lotTotals(lot).perKgCad : 0;
  const roasterCad = b.roasterRateCents * (b.roasterBasis === 'green' ? b.greenKg : b.roastedKg);
  const packagingCad = b.packagingCents;
  const totalCad = greenCostCad + roasterCad + packagingCad;
  return {
    greenCostCad, roasterCad, packagingCad, totalCad,
    perKgCad: b.roastedKg > 0 ? totalCad / b.roastedKg : 0,
    shrinkPct: b.greenKg > 0 ? (1 - b.roastedKg / b.greenKg) * 100 : 0,
  };
}

const kgOfLine = (l: { grams: number; quantity: number }) => (l.grams * l.quantity) / 1000;
const SHIPPED = new Set(['shipped', 'delivered']);
const COMMITTED = new Set(['awaiting_payment', 'paid', 'invoiced', 'roasting']);

export interface RoastStock {
  productId: string;
  roast: RoastLevel;
  producedKg: number;
  shippedKg: number;
  committedKg: number;
  onHandKg: number; // producido − enviado
  freeKg: number; // en mano − comprometido
  avgCostKgCad: number; // costo promedio ponderado por kg tostado
}

export interface LotStock {
  lot: GreenLot;
  totals: LotTotals;
  usedKg: number;
  remainingKg: number;
}

export interface Inventory {
  since: string | null; // fecha desde la que se cuentan pedidos (primera compra)
  lots: LotStock[];
  greenOnHandKg: number; // de lotes recibidos
  greenIncomingKg: number; // pedidos o en tránsito
  roasts: RoastStock[];
  avgCostKgCad: number; // de todo lo tostado
}

/**
 * Inventario. Los pedidos solo cuentan desde la primera compra registrada
 * (lo anterior es historial/demo y no salió de este inventario).
 */
/** `defaultProductId`: a qué café asignar las compras viejas que no tienen café elegido. */
export function buildInventory(lots: GreenLot[], batches: RoastBatch[], orders: Order[], defaultProductId?: string): Inventory {
  const since = lots.length ? [...lots].map((l) => l.purchasedAt).sort()[0] : null;
  const byLot = new Map(lots.map((l) => [l.id, l]));

  const lotStocks: LotStock[] = lots.map((lot) => {
    const usedKg = batches.filter((b) => b.lotId === lot.id).reduce((s, b) => s + b.greenKg, 0);
    const totals = lotTotals(lot);
    return { lot, totals, usedKg, remainingKg: totals.greenKg - usedKg };
  });

  const relevant = since ? orders.filter((o) => o.status !== 'cancelled' && o.createdAt.slice(0, 10) >= since) : [];
  const pidOf = (b: RoastBatch) => byLot.get(b.lotId)?.productId ?? defaultProductId ?? '';
  // Una fila por café × tueste que tenga tuestes o pedidos
  const keys = new Set<string>();
  for (const b of batches) keys.add(`${pidOf(b)}|${b.roast}`);
  for (const o of relevant) for (const l of o.lines) if ((ROAST_LEVELS as readonly string[]).includes(l.roast)) keys.add(`${l.productId}|${l.roast}`);
  let totalCost = 0;
  let totalKg = 0;
  const roasts: RoastStock[] = [...keys].sort().map((key) => {
    const [productId, roast] = key.split('|') as [string, RoastLevel];
    const own = batches.filter((b) => b.roast === roast && pidOf(b) === productId);
    const producedKg = own.reduce((s, b) => s + b.roastedKg, 0);
    const cost = own.reduce((s, b) => s + batchTotals(b, byLot.get(b.lotId)).totalCad, 0);
    totalCost += cost;
    totalKg += producedKg;
    let shippedKg = 0;
    let committedKg = 0;
    for (const o of relevant) for (const l of o.lines) {
      if (l.roast !== roast || l.productId !== productId) continue;
      if (SHIPPED.has(o.status)) shippedKg += kgOfLine(l);
      else if (COMMITTED.has(o.status)) committedKg += kgOfLine(l);
    }
    const onHandKg = producedKg - shippedKg;
    return { productId, roast, producedKg, shippedKg, committedKg, onHandKg, freeKg: onHandKg - committedKg, avgCostKgCad: producedKg ? cost / producedKg : 0 };
  }).sort((a, b) => a.productId.localeCompare(b.productId) || ROAST_LEVELS.indexOf(a.roast) - ROAST_LEVELS.indexOf(b.roast));

  return {
    since,
    lots: lotStocks,
    greenOnHandKg: lotStocks.filter((s) => s.lot.status === 'received').reduce((s, x) => s + x.remainingKg, 0),
    greenIncomingKg: lotStocks.filter((s) => s.lot.status !== 'received').reduce((s, x) => s + x.remainingKg, 0),
    roasts,
    avgCostKgCad: totalKg ? totalCost / totalKg : 0,
  };
}

export interface MonthMargin {
  month: string; // YYYY-MM
  salesCad: number; // café vendido (subtotal, sin envío)
  shippingCad: number; // envío cobrado
  kg: number;
  cogsCad: number; // costo del café vendido
  grossCad: number; // ingresos (ventas + envío) − costo
  expensesCad: number;
  netCad: number; // ventas + envío − costo − gastos
  orders: number;
}

const monthOf = (iso: string) => {
  const d = new Date(iso);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Toronto', year: 'numeric', month: '2-digit' }).format(d).slice(0, 7);
};

/** Márgenes por mes del año. El costo del café usa el costo promedio por kg de cada tueste. */
export function buildMargins(year: number, orders: Order[], inv: Inventory, expenses: Expense[]): MonthMargin[] {
  const costByRoast = new Map(inv.roasts.filter((r) => r.producedKg > 0).map((r) => [`${r.productId}|${r.roast}`, r.avgCostKgCad]));
  // Si un café no tiene tuestes registrados, se usa el promedio por tueste y luego el general
  const byRoastOnly = new Map<string, number>();
  for (const lv of ROAST_LEVELS) {
    const rs = inv.roasts.filter((r) => r.roast === lv && r.producedKg > 0);
    const kg = rs.reduce((s, r) => s + r.producedKg, 0);
    if (kg) byRoastOnly.set(lv, rs.reduce((s, r) => s + r.avgCostKgCad * r.producedKg, 0) / kg);
  }
  const months = Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`);
  return months.map((month) => {
    const os = orders.filter((o) => o.status !== 'cancelled' && monthOf(o.createdAt) === month);
    let kg = 0;
    let cogs = 0;
    for (const o of os) for (const l of o.lines) {
      const k = kgOfLine(l);
      kg += k;
      cogs += k * (costByRoast.get(`${l.productId}|${l.roast}`) ?? byRoastOnly.get(l.roast) ?? inv.avgCostKgCad);
    }
    const salesCad = os.reduce((s, o) => s + o.subtotalCents, 0);
    const shippingCad = os.reduce((s, o) => s + o.shippingCents, 0);
    const expensesCad = expenses.filter((e) => e.month === month).reduce((s, e) => s + e.amountCents, 0);
    return {
      month, salesCad, shippingCad, kg, cogsCad: cogs, grossCad: salesCad + shippingCad - cogs, expensesCad,
      netCad: salesCad + shippingCad - cogs - expensesCad, orders: os.length,
    };
  });
}

/* ---------- Estado de resultados (como en La Sirena: ventas → costo → utilidad bruta → gastos → utilidad) ---------- */

export interface CostParts { green: number; roaster: number; packaging: number; total: number } // CAD centavos por kg tostado

/** Costo promedio por kg tostado, separado en café verde, tostador e insumos; por tueste y en general. */
/** Claves: "café|tueste", "tueste" (todos los cafés) y el promedio general. */
export function roastCostParts(lots: GreenLot[], batches: RoastBatch[], defaultProductId?: string): { byRoast: Map<string, CostParts>; all: CostParts | null } {
  const byLot = new Map(lots.map((l) => [l.id, l]));
  const acc = new Map<string, { g: number; r: number; p: number; kg: number }>();
  const all = { g: 0, r: 0, p: 0, kg: 0 };
  for (const b of batches) {
    const t = batchTotals(b, byLot.get(b.lotId));
    const pid = byLot.get(b.lotId)?.productId ?? defaultProductId ?? '';
    const a = acc.get(b.roast) ?? { g: 0, r: 0, p: 0, kg: 0 };
    const ap = acc.get(`${pid}|${b.roast}`) ?? { g: 0, r: 0, p: 0, kg: 0 };
    for (const x of [a, ap, all]) { x.g += t.greenCostCad; x.r += t.roasterCad; x.p += t.packagingCad; x.kg += b.roastedKg; }
    acc.set(b.roast, a);
    acc.set(`${pid}|${b.roast}`, ap);
  }
  const parts = (x: { g: number; r: number; p: number; kg: number }): CostParts => ({
    green: x.g / x.kg, roaster: x.r / x.kg, packaging: x.p / x.kg, total: (x.g + x.r + x.p) / x.kg,
  });
  const byRoast = new Map<string, CostParts>();
  for (const [k, v] of acc) if (v.kg > 0) byRoast.set(k, parts(v));
  return { byRoast, all: all.kg > 0 ? parts(all) : null };
}

export interface Statement {
  months: string[];
  orders: number;
  kg: number;
  salesCad: number;
  shippingCad: number;
  revenueCad: number;
  cogs: { green: number; roaster: number; packaging: number; total: number };
  grossCad: number;
  expensesByTag: { tag: string; cents: number }[];
  expensesCad: number;
  operatingCad: number; // utilidad de operación
  hasCost: boolean;
}

export function buildStatement(months: string[], orders: Order[], lots: GreenLot[], batches: RoastBatch[], expenses: Expense[], defaultProductId?: string): Statement {
  const set = new Set(months);
  const { byRoast, all } = roastCostParts(lots, batches, defaultProductId);
  const os = orders.filter((o) => o.status !== 'cancelled' && set.has(monthOf(o.createdAt)));
  const cogs = { green: 0, roaster: 0, packaging: 0, total: 0 };
  let kg = 0;
  for (const o of os) for (const l of o.lines) {
    const k = kgOfLine(l);
    kg += k;
    const c = byRoast.get(`${l.productId}|${l.roast}`) ?? byRoast.get(l.roast) ?? all;
    if (!c) continue;
    cogs.green += k * c.green; cogs.roaster += k * c.roaster; cogs.packaging += k * c.packaging; cogs.total += k * c.total;
  }
  const salesCad = os.reduce((s, o) => s + o.subtotalCents, 0);
  const shippingCad = os.reduce((s, o) => s + o.shippingCents, 0);
  const tags = new Map<string, number>();
  for (const e of expenses) if (set.has(e.month)) tags.set(e.tag, (tags.get(e.tag) ?? 0) + e.amountCents);
  const expensesByTag = [...tags.entries()].map(([tag, cents]) => ({ tag, cents })).sort((a, b) => b.cents - a.cents);
  const expensesCad = expensesByTag.reduce((s, x) => s + x.cents, 0);
  const revenueCad = salesCad + shippingCad;
  const grossCad = revenueCad - cogs.total;
  return {
    months, orders: os.length, kg, salesCad, shippingCad, revenueCad, cogs, grossCad,
    expensesByTag, expensesCad, operatingCad: grossCad - expensesCad, hasCost: Boolean(all),
  };
}

/** Meses de un periodo: este mes, el anterior, últimos 3 o el año a la fecha. */
export type StatementPeriod = 'month' | 'prev' | 'quarter' | 'year';
export function periodMonths(p: StatementPeriod | string, now = new Date()): string[] {
  const cur = monthOf(now.toISOString());
  const shift = (m: string, d: number) => { const x = new Date(`${m}-15T12:00:00Z`); x.setUTCMonth(x.getUTCMonth() + d); return x.toISOString().slice(0, 7); };
  if (/^\d{4}-\d{2}$/.test(p)) return [p];
  if (p === 'prev') return [shift(cur, -1)];
  if (p === 'quarter') return [shift(cur, -2), shift(cur, -1), cur];
  if (p === 'year') { const n = Number(cur.slice(5, 7)); return Array.from({ length: n }, (_, i) => `${cur.slice(0, 4)}-${String(i + 1).padStart(2, '0')}`); }
  return [cur];
}
