import 'server-only';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { Customer, Order, PriceOverride, WholesaleApplication } from '../types';
import type { Repository } from './repository';

/**
 * Development backend: everything in .data/db.json. Same shape as the Postgres tables.
 * Not for production: serverless hosts like Vercel have a read-only, per-instance filesystem.
 */

export interface LocalDb {
  customers: Customer[];
  orders: Order[];
  applications: WholesaleApplication[];
  /** Local-mode login only. In Supabase mode passwords live in Supabase Auth, never here. */
  credentials: { userId: string; email: string; passwordHash: string }[];
  orderSeq: number;
  prices: PriceOverride[];
}

const FILE = path.join(process.cwd(), '.data', 'db.json');
const EMPTY: LocalDb = { customers: [], orders: [], applications: [], credentials: [], orderSeq: 1000, prices: [] };

let queue: Promise<unknown> = Promise.resolve();

export async function readDb(): Promise<LocalDb> {
  try {
    return { ...EMPTY, ...JSON.parse(await fs.readFile(FILE, 'utf8')) };
  } catch {
    return structuredClone(EMPTY);
  }
}

/** Serialises writes so two requests never clobber each other. */
export function mutateDb<T>(fn: (db: LocalDb) => T | Promise<T>): Promise<T> {
  const run = queue.then(async () => {
    const db = await readDb();
    const result = await fn(db);
    await fs.mkdir(path.dirname(FILE), { recursive: true });
    await fs.writeFile(FILE, JSON.stringify(db, null, 2));
    return result;
  });
  queue = run.catch(() => undefined);
  return run;
}

export const localRepository: Repository = {
  customers: {
    async list() {
      return (await readDb()).customers.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },
    async getById(id) {
      return (await readDb()).customers.find((c) => c.id === id) ?? null;
    },
    async getByEmail(email) {
      const e = email.toLowerCase();
      return (await readDb()).customers.find((c) => c.email.toLowerCase() === e) ?? null;
    },
    create(customer) {
      return mutateDb((db) => {
        db.customers.push(customer);
        return customer;
      });
    },
    update(id, patch) {
      return mutateDb((db) => {
        const c = db.customers.find((x) => x.id === id);
        if (!c) throw new Error('Customer not found');
        Object.assign(c, patch);
        return c;
      });
    },
  },
  orders: {
    async listAll() {
      return (await readDb()).orders.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },
    async listByCustomer(customerId) {
      return (await readDb()).orders
        .filter((o) => o.customerId === customerId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },
    async getById(id) {
      return (await readDb()).orders.find((o) => o.id === id) ?? null;
    },
    create(order) {
      return mutateDb((db) => {
        db.orderSeq += 1;
        const full: Order = { ...order, number: `DA-${db.orderSeq}` };
        db.orders.push(full);
        return full;
      });
    },
    updateStatus(id, status, patch = {}) {
      return mutateDb((db) => {
        const o = db.orders.find((x) => x.id === id);
        if (!o) throw new Error('Order not found');
        Object.assign(o, patch, { status, updatedAt: new Date().toISOString() });
        return o;
      });
    },
    async findByStripeSession(sessionId) {
      return (await readDb()).orders.find((o) => o.stripeSessionId === sessionId) ?? null;
    },
  },
  prices: {
    async list() {
      return (await readDb()).prices ?? [];
    },
    set(sku, tier, priceCents) {
      return mutateDb((db) => {
        db.prices ??= [];
        const i = db.prices.findIndex((p) => p.sku === sku && p.tier === tier);
        if (i >= 0) db.prices[i].priceCents = priceCents;
        else db.prices.push({ sku, tier, priceCents });
      });
    },
  },
  applications: {
    create(app) {
      return mutateDb((db) => {
        db.applications.push(app);
        return app;
      });
    },
    async list() {
      return (await readDb()).applications.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },
  },
};
