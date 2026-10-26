import { getTranslations } from 'next-intl/server';
import { getAdmin } from '@/lib/admin';
import { repo } from '@/lib/db';
import { buildStatement, periodMonths } from '@/lib/finance';

/**
 * Descargas para Excel (CSV con BOM, se abre directo en Excel):
 *   ?type=statement&p=month|prev|quarter|year|YYYY-MM  → estado de resultados
 *   ?type=orders                                       → todos los pedidos
 *   ?type=expenses                                     → todos los gastos
 * Solo para admins.
 */
export async function GET(req: Request) {
  if (!(await getAdmin())) return new Response('Forbidden', { status: 403 });
  const url = new URL(req.url);
  const type = url.searchParams.get('type') ?? 'statement';
  const locale = (['en', 'fr', 'es'].includes(url.searchParams.get('locale') ?? '') ? url.searchParams.get('locale') : 'es') as 'en' | 'fr' | 'es';
  const t = await getTranslations({ locale });
  const dollars = (c: number) => (Math.round(c) / 100).toFixed(2);
  let rows: (string | number)[][] = [];
  let name = 'dealtura';

  if (type === 'statement') {
    const p = url.searchParams.get('p') ?? 'month';
    const months = periodMonths(p);
    const [orders, lots, batches, expenses] = await Promise.all([repo.orders.listAll(), repo.lots.list(), repo.batches.list(), repo.expenses.list()]);
    const st = buildStatement(months, orders, lots, batches, expenses);
    const pct = (v: number) => (st.revenueCad ? `${((v / st.revenueCad) * 100).toFixed(1)}%` : '');
    const f = (k: string) => t(`admin.fin.${k}` as 'admin.fin.st.title');
    rows = [
      [f('st.title'), months.length === 1 ? months[0] : `${months[0]} – ${months[months.length - 1]}`],
      [],
      [f('st.concept'), 'CAD', f('st.pctRevenue')],
      [f('st.income')],
      [f('mar.sales'), dollars(st.salesCad), pct(st.salesCad)],
      [f('st.shipping'), dollars(st.shippingCad), pct(st.shippingCad)],
      [`= ${f('st.revenue')}`, dollars(st.revenueCad), '100%'],
      [f('st.cogs')],
      [f('st.green'), dollars(st.cogs.green), pct(st.cogs.green)],
      [f('st.roaster'), dollars(st.cogs.roaster), pct(st.cogs.roaster)],
      [f('st.packaging'), dollars(st.cogs.packaging), pct(st.cogs.packaging)],
      [`= ${f('mar.gross')}`, dollars(st.grossCad), pct(st.grossCad)],
      [f('st.opexTitle')],
      ...st.expensesByTag.map((e) => [e.tag, dollars(e.cents), pct(e.cents)]),
      [f('st.opex'), dollars(st.expensesCad), pct(st.expensesCad)],
      [`= ${f('st.operating')}`, dollars(st.operatingCad), pct(st.operatingCad)],
      [],
      ['kg', st.kg.toFixed(1)],
      [t('admin.col.orders'), st.orders],
    ];
    name = `estado-resultados-${p}`;
  } else if (type === 'orders') {
    const [orders, customers] = await Promise.all([repo.orders.listAll(), repo.customers.list()]);
    const names = new Map(customers.map((c) => [c.id, c.businessName]));
    rows = [['#', 'Fecha', 'Cliente', 'Ciudad', 'Estado', 'Pago', 'kg', 'Subtotal', 'Envío', 'Total', 'Detalle']];
    for (const o of orders) {
      const kg = o.lines.reduce((s, l) => s + (l.grams * l.quantity) / 1000, 0);
      rows.push([
        o.number, o.createdAt.slice(0, 10), names.get(o.customerId) ?? '', o.shippingAddress?.city ?? '',
        t(`order.status.${o.status}`), o.paymentMethod, kg.toFixed(2), dollars(o.subtotalCents), dollars(o.shippingCents), dollars(o.totalCents),
        o.lines.map((l) => `${l.quantity}× ${l.formatLabel} (${l.roast})`).join(' | '),
      ]);
    }
    name = 'pedidos';
  } else if (type === 'expenses') {
    const expenses = await repo.expenses.list();
    rows = [['Mes', 'Etiqueta', 'Descripción', 'CAD'], ...expenses.map((e) => [e.month, e.tag, e.description, dollars(e.amountCents)])];
    name = 'gastos';
  } else {
    return new Response('Bad request', { status: 400 });
  }

  const esc = (v: string | number) => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = '﻿' + rows.map((r) => r.map(esc).join(',')).join('\r\n');
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${name}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
