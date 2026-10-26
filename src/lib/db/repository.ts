import type {
  Customer, Expense, GreenLot, Order, OrderStatus, PriceOverride, PriceTier, RoastBatch, WholesaleApplication,
} from '../types';

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
  /** Compras de café verde (con sus gastos de importación dentro). */
  lots: {
    list(): Promise<GreenLot[]>;
    getById(id: string): Promise<GreenLot | null>;
    create(lot: GreenLot): Promise<GreenLot>;
    update(id: string, patch: Partial<Omit<GreenLot, 'id' | 'createdAt'>>): Promise<GreenLot>;
  };
  batches: {
    list(): Promise<RoastBatch[]>;
    create(batch: RoastBatch): Promise<RoastBatch>;
    remove(id: string): Promise<void>;
  };
  expenses: {
    list(): Promise<Expense[]>;
    create(expense: Expense): Promise<Expense>;
    remove(id: string): Promise<void>;
  };
  applications: {
    create(app: WholesaleApplication): Promise<WholesaleApplication>;
    /** Admin: every application, newest first. */
    list(): Promise<WholesaleApplication[]>;
  };
}
