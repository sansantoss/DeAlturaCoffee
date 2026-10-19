import type { Customer, Order, OrderStatus, PriceOverride, PriceTier, WholesaleApplication } from '../types';

/**
 * The only door to customer and order data. Two implementations:
 *  - local.ts    : a JSON file in .data/ (development, no setup needed)
 *  - supabase.ts : Postgres (production)
 * The web app and, later, the mobile app's API routes only ever talk to this interface.
 */
export interface Repository {
  customers: {
    /** Admin: everyone, newest first. */
    list(): Promise<Customer[]>;
    getById(id: string): Promise<Customer | null>;
    getByEmail(email: string): Promise<Customer | null>;
    create(customer: Customer): Promise<Customer>;
    update(id: string, patch: Partial<Omit<Customer, 'id' | 'email' | 'createdAt'>>): Promise<Customer>;
  };
  orders: {
    /** Admin: every order, newest first. */
    listAll(): Promise<Order[]>;
    listByCustomer(customerId: string): Promise<Order[]>;
    getById(id: string): Promise<Order | null>;
    create(order: Omit<Order, 'number'>): Promise<Order>;
    updateStatus(id: string, status: OrderStatus, patch?: Partial<Order>): Promise<Order>;
    findByStripeSession(sessionId: string): Promise<Order | null>;
  };
  prices: {
    list(): Promise<PriceOverride[]>;
    set(sku: string, tier: PriceTier, priceCents: number): Promise<void>;
  };
  applications: {
    create(app: WholesaleApplication): Promise<WholesaleApplication>;
    /** Admin: every application, newest first. */
    list(): Promise<WholesaleApplication[]>;
  };
}
