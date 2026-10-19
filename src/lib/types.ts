/**
 * Domain model. These shapes mirror the Postgres tables in supabase/migrations one to one,
 * so moving from JSON to the database never changes the rest of the app.
 * The future Expo app imports the same types.
 */

export type Locale = 'en' | 'fr' | 'es';
export type Localized = Record<Locale, string>;

/* ---------- Catalog (content/*.json today, `products` / `origins` tables later) ---------- */

export interface Origin {
  id: string; // 'ven-merida'
  country: Localized;
  region: string; // 'Santa Cruz de Mora, Mérida'
  altitude: { min: number; max: number }; // metres above sea level
  story: Localized;
  active: boolean; // false = announced, not yet sold
}

export type RoastProfile = 'filter' | 'espresso' | 'omni';

export interface ProductFormat {
  sku: string; // 'VEN-SCM-1KG'
  label: Localized; // '1 kg bag'
  grams: number; // net weight of one unit
  unitsPerCase: number; // 1 for bulk bags, 12 for retail 340 g bags
  /** Wholesale price in CAD cents per unit, by customer price tier. */
  price: Record<PriceTier, number>;
}

export interface Product {
  id: string;
  slug: string;
  originId: string;
  name: Localized;
  variety: string;
  process: Localized;
  tastingNotes: Localized;
  score?: number; // SCA cupping score, only if certified
  roasts: RoastProfile[];
  formats: ProductFormat[];
  /** Canadian sales tax category. Roasted coffee beans are basic groceries: zero-rated. */
  taxCategory: 'zero-rated-grocery' | 'standard';
  active: boolean;
}

export interface Settings {
  currency: 'CAD';
  /** Minimum order in kilograms, across all lines. */
  minimumOrderKg: number;
  /** Day(s) of the week we roast, for the delivery promise. 0 = Sunday. */
  roastDays: number[];
  /** Show wholesale prices to visitors who are not signed in. */
  publicPrices: boolean;
  contactEmail: string;
  freeShippingKg: number;
  shippingFlatCents: number;
}

/* ---------- Customers & orders (.data/db.json today, Postgres later) ---------- */

export type PriceTier = 'standard' | 'partner';
export type AccountStatus = 'pending' | 'approved' | 'suspended';
export type Province =
  | 'AB' | 'BC' | 'MB' | 'NB' | 'NL' | 'NS' | 'NT' | 'NU' | 'ON' | 'PE' | 'QC' | 'SK' | 'YT';

export interface Address {
  id: string;
  label: string; // 'Main café'
  line1: string;
  line2?: string;
  city: string;
  province: Province;
  postalCode: string;
  isDefault: boolean;
}

export interface Customer {
  id: string; // = auth user id
  email: string;
  contactName: string;
  businessName: string;
  businessType: 'cafe' | 'restaurant' | 'retail' | 'office' | 'other';
  phone?: string;
  gstNumber?: string;
  preferredLocale: Locale;
  status: AccountStatus;
  priceTier: PriceTier;
  /** Approved accounts can pay by invoice (net terms) instead of card. */
  invoiceTermsDays: number | null;
  addresses: Address[];
  createdAt: string;
  /** false = cuenta gestionada por el equipo (pide por correo/teléfono), todavía sin contraseña propia. */
  hasLogin?: boolean;
}

export type OrderStatus =
  | 'awaiting_payment'
  | 'paid'
  | 'invoiced'
  | 'roasting'
  | 'shipped'
  | 'delivered'
  | 'cancelled';

export type PaymentMethod = 'card' | 'invoice';

export interface OrderLine {
  sku: string;
  productId: string;
  productName: string; // snapshot at order time
  formatLabel: string; // snapshot
  roast: RoastProfile;
  quantity: number;
  unitPriceCents: number;
  grams: number; // per unit, for the kg total
}

export interface Order {
  id: string;
  number: string; // 'DA-1042', human facing
  customerId: string;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  lines: OrderLine[];
  subtotalCents: number;
  shippingCents: number;
  taxCents: number;
  totalCents: number;
  shippingAddress: Omit<Address, 'id' | 'isDefault'>;
  notes?: string;
  stripeSessionId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface WholesaleApplication {
  id: string;
  email: string;
  contactName: string;
  businessName: string;
  businessType: Customer['businessType'];
  city: string;
  province: Province;
  estimatedKgPerMonth: number;
  message?: string;
  locale: Locale;
  createdAt: string;
}

/** Precio editado desde el admin. Sobrescribe el de content/products.json. */
export interface PriceOverride {
  sku: string;
  tier: PriceTier;
  priceCents: number;
}

export interface CartLine {
  sku: string;
  roast: RoastProfile;
  quantity: number;
}
