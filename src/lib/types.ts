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

/** Niveles de tueste que se venden hoy. */
export const ROAST_LEVELS = ['light', 'medium', 'dark'] as const;
export type RoastLevel = (typeof ROAST_LEVELS)[number];
/** Incluye los perfiles viejos (espresso/filtro) para que los pedidos anteriores se sigan leyendo. */
export type RoastProfile = RoastLevel | 'filter' | 'espresso' | 'omni';

/** Cómo sabe y para qué sirve cada tueste de un café. */
export interface RoastInfo { notes: Localized; use: Localized }

/** Resultado del análisis de laboratorio (ficha técnica). */
export interface LabSheet {
  date: string; // '2026-03-20'
  lab: string; // quién lo analizó
  lot: string;
  harvest: string; // '2025–2026'
  moisturePct: number;
  densityGL: number;
  screen: string; // '16–18'
  screenAbove16Pct: number;
  primaryDefects: number;
  cupping: { key: string; score: number }[]; // aroma, sabor... (máx. 10)
  descriptors: Localized;
}

/** Una finca de la que viene el café. Se publica solo si published = true. */
export interface Farm {
  id: string;
  published: boolean;
  name: string;
  producer: string;
  town: string;
  state: string;
  altitude: number; // msnm
  variety: string;
  image: string; // nombre del archivo en public/images (sin extensión)
  text: Localized;
}

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
  roasts: RoastLevel[];
  roastInfo?: Partial<Record<RoastLevel, RoastInfo>>;
  farm?: string;
  producer?: string;
  harvest?: string;
  lab?: LabSheet;
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
  roast: RoastLevel;
  quantity: number;
}

/* ---------- Inventario y costos (panel de admin) ---------- */

export type MassUnit = 'kg' | 'lb';
export type CostCurrency = 'CAD' | 'USD';
export type LotStatus = 'ordered' | 'in_transit' | 'received';
export type LotCostCategory = 'freight' | 'customs' | 'broker' | 'insurance' | 'storage' | 'other';

/** Un gasto ligado a una compra: flete a Canadá, aduana, agente, seguro... */
export interface LotCost {
  id: string;
  category: LotCostCategory;
  label: string;
  amountCents: number;
  currency: CostCurrency;
}

/** Ficha de compra de café verde (un lote). Se compra en lb o kg, en USD o CAD. */
export interface GreenLot {
  id: string;
  code: string; // 'VEN-2026-01'
  supplier: string;
  origin: string;
  purchasedAt: string; // YYYY-MM-DD
  status: LotStatus;
  quantity: number; // en inputUnit
  inputUnit: MassUnit;
  /** Precio del café por unidad (lb o kg), en la moneda de la compra, en centavos. */
  pricePerUnitCents: number;
  currency: CostCurrency;
  /** Tipo de cambio a CAD (1 si la compra es en CAD). */
  fxToCad: number;
  costs: LotCost[];
  notes?: string;
  createdAt: string;
}

/** Un tueste: kg verdes que entran, kg tostados que salen, cobro del tostador e insumos. */
export interface RoastBatch {
  id: string;
  lotId: string;
  roastedAt: string; // YYYY-MM-DD
  roast: RoastLevel;
  greenKg: number;
  roastedKg: number;
  /** Lo que cobra el tostador, CAD por kg. */
  roasterRateCents: number;
  roasterBasis: 'green' | 'roasted';
  /** Empaque, etiquetas, válvulas... del tueste, total en CAD. */
  packagingCents: number;
  notes?: string;
  createdAt: string;
}

/** Gasto operativo del mes con etiqueta libre (renta, transporte, marketing...). */
export interface Expense {
  id: string;
  month: string; // YYYY-MM
  tag: string;
  description: string;
  amountCents: number; // CAD
  createdAt: string;
}
