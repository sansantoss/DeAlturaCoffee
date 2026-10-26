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
export function buildInventory(lots: GreenLot[], batches: RoastBatch[], orders: Order[]): Inventory {
  const since = lots.length ? [...lots].map((l) => l.purchasedAt).sort()[0] : null;
  const byLot = new Map(lots.map((l) => [l.id, l]));

  const lotStocks: LotStock[] = lots.map((lot) => {
    const usedKg = batches.filter((b) => b.lotId === lot.id).reduce((s, b) => s + b.greenKg, 0);
    const totals = lotTotals(lot);
    return { lot, totals, usedKg, remainingKg: totals.greenKg - usedKg };
  });

  const relevant = since ? orders.filter((o) => o.status !== 'cancelled' && o.createdAt.slice(0, 10) >= since) : [];
  let totalCost = 0;
  let totalKg = 0;
  const roasts: RoastStock[] = ROAST_LEVELS.map((roast) => {
    const own = batches.filter((b) => b.roast === roast);
    const producedKg = own.reduce((s, b) => s + b.roastedKg, 0);
    const cost = own.reduce((s, b) => s + batchTotals(b, byLot.get(b.lotId)).totalCad, 0);
    totalCost += cost;
    totalKg += producedKg;
    let shippedKg = 0;
    let committedKg = 0;
    for (const o of relevant) for (const l of o.lines) {
      if (l.roast !== roast) continue;
      if (SHIPPED.has(o.status)) shippedKg += kgOfLine(l);
      else if (COMMITTED.has(o.status)) committedKg += kgOfLine(l);
    }
    const onHandKg = producedKg - shippedKg;
    return { roast, producedKg, shippedKg, committedKg, onHandKg, freeKg: onHandKg - committedKg, avgCostKgCad: producedKg ? cost / producedKg : 0 };
  });

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
  grossCad: number; // ventas − costo
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
  const costByRoast = new Map(inv.roasts.map((r) => [r.roast as string, r.avgCostKgCad || inv.avgCostKgCad]));
  const months = Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`);
  return months.map((month) => {
    const os = orders.filter((o) => o.status !== 'cancelled' && monthOf(o.createdAt) === month);
    let kg = 0;
    let cogs = 0;
    for (const o of os) for (const l of o.lines) {
      const k = kgOfLine(l);
      kg += k;
      cogs += k * (costByRoast.get(l.roast) ?? inv.avgCostKgCad);
    }
    const salesCad = os.reduce((s, o) => s + o.subtotalCents, 0);
    const shippingCad = os.reduce((s, o) => s + o.shippingCents, 0);
    const expensesCad = expenses.filter((e) => e.month === month).reduce((s, e) => s + e.amountCents, 0);
    return {
      month, salesCad, shippingCad, kg, cogsCad: cogs, grossCad: salesCad - cogs, expensesCad,
      netCad: salesCad + shippingCad - cogs - expensesCad, orders: os.length,
    };
  });
}
