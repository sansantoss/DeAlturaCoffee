import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Address, Customer, Expense, GreenLot, Order, OrderLine, PriceOverride, RoastBatch, WholesaleApplication } from '../types';
import type { Repository } from './repository';

/**
 * Production backend. Uses the service-role key on the server only (never shipped to the browser).
 * Callers must already have checked who the user is (see lib/auth).
 */

let admin: SupabaseClient | null = null;
function db(): SupabaseClient {
  if (!admin) {
    admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } },
    );
  }
  return admin;
}

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const toAddress = (r: Row): Address => ({
  id: r.id, label: r.label, line1: r.line1, line2: r.line2 ?? undefined, city: r.city,
  province: r.province, postalCode: r.postal_code, isDefault: r.is_default,
});

const toCustomer = (r: Row): Customer => ({
  id: r.id, email: r.email, contactName: r.contact_name, businessName: r.business_name,
  businessType: r.business_type, phone: r.phone ?? undefined, gstNumber: r.gst_number ?? undefined,
  preferredLocale: r.preferred_locale, status: r.status, priceTier: r.price_tier,
  invoiceTermsDays: r.invoice_terms_days, addresses: (r.addresses ?? []).map(toAddress),
  createdAt: r.created_at, hasLogin: r.has_login ?? true,
});

const toLine = (r: Row): OrderLine => ({
  sku: r.sku, productId: r.product_id, productName: r.product_name, formatLabel: r.format_label,
  roast: r.roast, quantity: r.quantity, unitPriceCents: r.unit_price_cents, grams: r.grams,
});

const toOrder = (r: Row): Order => ({
  id: r.id, number: r.number, customerId: r.customer_id, status: r.status,
  paymentMethod: r.payment_method, lines: (r.order_lines ?? []).map(toLine),
  subtotalCents: r.subtotal_cents, shippingCents: r.shipping_cents, taxCents: r.tax_cents,
  totalCents: r.total_cents, shippingAddress: r.shipping_address, notes: r.notes ?? undefined,
  stripeSessionId: r.stripe_session_id ?? undefined, createdAt: r.created_at, updatedAt: r.updated_at,
});

function check<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data;
}

const toLot = (r: Row): GreenLot => ({
  id: r.id, code: r.code, supplier: r.supplier, origin: r.origin, purchasedAt: r.purchased_at, status: r.status,
  quantity: Number(r.quantity), inputUnit: r.input_unit, pricePerUnitCents: r.price_per_unit_cents, currency: r.currency,
  fxToCad: Number(r.fx_to_cad), costs: r.costs ?? [], notes: r.notes ?? undefined, createdAt: r.created_at,
});
const fromLot = (l: Partial<GreenLot>): Row => {
  const m: Record<string, string> = {
    code: 'code', supplier: 'supplier', origin: 'origin', purchasedAt: 'purchased_at', status: 'status', quantity: 'quantity',
    inputUnit: 'input_unit', pricePerUnitCents: 'price_per_unit_cents', currency: 'currency', fxToCad: 'fx_to_cad', costs: 'costs', notes: 'notes',
  };
  const out: Row = {};
  for (const [k, v] of Object.entries(l)) if (m[k]) out[m[k]] = v ?? null;
  return out;
};
const toBatch = (r: Row): RoastBatch => ({
  id: r.id, lotId: r.lot_id, roastedAt: r.roasted_at, roast: r.roast, greenKg: Number(r.green_kg), roastedKg: Number(r.roasted_kg),
  roasterRateCents: r.roaster_rate_cents, roasterBasis: r.roaster_basis, packagingCents: r.packaging_cents,
  notes: r.notes ?? undefined, createdAt: r.created_at,
});
const toExpense = (r: Row): Expense => ({
  id: r.id, month: r.month, tag: r.tag, description: r.description, amountCents: r.amount_cents, createdAt: r.created_at,
});

const CUSTOMER_SELECT = '*, addresses(*)';
const ORDER_SELECT = '*, order_lines(*)';

async function saveAddresses(customerId: string, addresses: Address[]) {
  check(await db().from('addresses').delete().eq('customer_id', customerId));
  if (!addresses.length) return;
  check(
    await db().from('addresses').insert(
      addresses.map((a) => ({
        customer_id: customerId, label: a.label, line1: a.line1, line2: a.line2 ?? null,
        city: a.city, province: a.province, postal_code: a.postalCode, is_default: a.isDefault,
      })),
    ),
  );
}

export const supabaseRepository: Repository = {
  customers: {
    async list() {
      const rows = check(await db().from('customers').select(CUSTOMER_SELECT).order('created_at', { ascending: false }));
      return (rows ?? []).map(toCustomer);
    },
    async getById(id) {
      const r = check(await db().from('customers').select(CUSTOMER_SELECT).eq('id', id).maybeSingle());
      return r ? toCustomer(r) : null;
    },
    async getByEmail(email) {
      const r = check(
        await db().from('customers').select(CUSTOMER_SELECT).ilike('email', email).maybeSingle(),
      );
      return r ? toCustomer(r) : null;
    },
    async create(c) {
      check(
        await db().from('customers').insert({
          id: c.id, email: c.email, contact_name: c.contactName, business_name: c.businessName,
          business_type: c.businessType, phone: c.phone ?? null, gst_number: c.gstNumber ?? null,
          preferred_locale: c.preferredLocale, status: c.status, price_tier: c.priceTier,
          invoice_terms_days: c.invoiceTermsDays, has_login: c.hasLogin ?? true,
        }),
      );
      await saveAddresses(c.id, c.addresses);
      return (await this.getById(c.id))!;
    },
    async update(id, patch) {
      const row: Row = {};
      if (patch.contactName !== undefined) row.contact_name = patch.contactName;
      if (patch.businessName !== undefined) row.business_name = patch.businessName;
      if (patch.businessType !== undefined) row.business_type = patch.businessType;
      if (patch.phone !== undefined) row.phone = patch.phone;
      if (patch.gstNumber !== undefined) row.gst_number = patch.gstNumber;
      if (patch.preferredLocale !== undefined) row.preferred_locale = patch.preferredLocale;
      if (patch.status !== undefined) row.status = patch.status;
      if (patch.priceTier !== undefined) row.price_tier = patch.priceTier;
      if (patch.invoiceTermsDays !== undefined) row.invoice_terms_days = patch.invoiceTermsDays;
      if (patch.hasLogin !== undefined) row.has_login = patch.hasLogin;
      if (Object.keys(row).length) check(await db().from('customers').update(row).eq('id', id));
      if (patch.addresses) await saveAddresses(id, patch.addresses);
      return (await this.getById(id))!;
    },
  },
  orders: {
    async listAll() {
      const rows = check(await db().from('orders').select(ORDER_SELECT).order('created_at', { ascending: false }).limit(500));
      return (rows ?? []).map(toOrder);
    },
    async listByCustomer(customerId) {
      const rows = check(
        await db().from('orders').select(ORDER_SELECT).eq('customer_id', customerId)
          .order('created_at', { ascending: false }),
      );
      return (rows ?? []).map(toOrder);
    },
    async getById(id) {
      const r = check(await db().from('orders').select(ORDER_SELECT).eq('id', id).maybeSingle());
      return r ? toOrder(r) : null;
    },
    async create(o) {
      const row: Row = check(
        await db().from('orders').insert({
          id: o.id, customer_id: o.customerId, status: o.status, payment_method: o.paymentMethod,
          subtotal_cents: o.subtotalCents, shipping_cents: o.shippingCents, tax_cents: o.taxCents,
          total_cents: o.totalCents, shipping_address: o.shippingAddress, notes: o.notes ?? null,
          stripe_session_id: o.stripeSessionId ?? null,
        }).select('id').single(),
      )!;
      check(
        await db().from('order_lines').insert(
          o.lines.map((l) => ({
            order_id: row.id, sku: l.sku, product_id: l.productId, product_name: l.productName,
            format_label: l.formatLabel, roast: l.roast, quantity: l.quantity,
            unit_price_cents: l.unitPriceCents, grams: l.grams,
          })),
        ),
      );
      return (await this.getById(row.id))!;
    },
    async updateStatus(id, status, patch = {}) {
      const row: Row = { status, updated_at: new Date().toISOString() };
      if (patch.stripeSessionId !== undefined) row.stripe_session_id = patch.stripeSessionId;
      check(await db().from('orders').update(row).eq('id', id));
      return (await this.getById(id))!;
    },
    async findByStripeSession(sessionId) {
      const r = check(
        await db().from('orders').select(ORDER_SELECT).eq('stripe_session_id', sessionId).maybeSingle(),
      );
      return r ? toOrder(r) : null;
    },
  },
  prices: {
    async list() {
      const rows = check(await db().from('product_prices').select('sku, tier, price_cents'));
      return (rows ?? []).map((r: Row): PriceOverride => ({ sku: r.sku, tier: r.tier, priceCents: r.price_cents }));
    },
    async set(sku, tier, priceCents) {
      check(
        await db().from('product_prices').upsert(
          { sku, tier, price_cents: priceCents, updated_at: new Date().toISOString() },
          { onConflict: 'sku,tier' },
        ),
      );
    },
  },
  lots: {
    async list() {
      const rows = check(await db().from('green_lots').select('*').order('purchased_at', { ascending: false }));
      return (rows ?? []).map(toLot);
    },
    async getById(id) {
      const r = check(await db().from('green_lots').select('*').eq('id', id).maybeSingle());
      return r ? toLot(r) : null;
    },
    async create(lot) {
      check(await db().from('green_lots').insert({ id: lot.id, created_at: lot.createdAt, ...fromLot(lot) }));
      return lot;
    },
    async update(id, patch) {
      const r = check(await db().from('green_lots').update(fromLot(patch)).eq('id', id).select('*').single());
      return toLot(r);
    },
  },
  batches: {
    async list() {
      const rows = check(await db().from('roast_batches').select('*').order('roasted_at', { ascending: false }));
      return (rows ?? []).map(toBatch);
    },
    async create(b) {
      check(await db().from('roast_batches').insert({
        id: b.id, lot_id: b.lotId, roasted_at: b.roastedAt, roast: b.roast, green_kg: b.greenKg, roasted_kg: b.roastedKg,
        roaster_rate_cents: b.roasterRateCents, roaster_basis: b.roasterBasis, packaging_cents: b.packagingCents,
        notes: b.notes ?? null, created_at: b.createdAt,
      }));
      return b;
    },
    async remove(id) {
      check(await db().from('roast_batches').delete().eq('id', id));
    },
  },
  expenses: {
    async list() {
      const rows = check(await db().from('expenses').select('*').order('month', { ascending: false }).order('created_at', { ascending: false }));
      return (rows ?? []).map(toExpense);
    },
    async create(e) {
      check(await db().from('expenses').insert({
        id: e.id, month: e.month, tag: e.tag, description: e.description, amount_cents: e.amountCents, created_at: e.createdAt,
      }));
      return e;
    },
    async remove(id) {
      check(await db().from('expenses').delete().eq('id', id));
    },
  },
  applications: {
    async create(a) {
      check(
        await db().from('wholesale_applications').insert({
          id: a.id, email: a.email, contact_name: a.contactName, business_name: a.businessName,
          business_type: a.businessType, city: a.city, province: a.province,
          estimated_kg_per_month: a.estimatedKgPerMonth, message: a.message ?? null, locale: a.locale,
        }),
      );
      return a;
    },
    async list() {
      const rows = check(
        await db().from('wholesale_applications').select('*').order('created_at', { ascending: false }),
      );
      return (rows ?? []).map(
        (r: Row): WholesaleApplication => ({
          id: r.id, email: r.email, contactName: r.contact_name, businessName: r.business_name,
          businessType: r.business_type, city: r.city, province: r.province,
          estimatedKgPerMonth: r.estimated_kg_per_month, message: r.message ?? undefined,
          locale: r.locale, createdAt: r.created_at,
        }),
      );
    },
  },
};
