import 'server-only';
import { findFormat, getSettings } from './catalog';
import type { CartLine, Locale, OrderLine, PriceTier, Province } from './types';

/**
 * All money is computed on the server, in CAD cents. The browser only sends SKUs and quantities.
 *
 * Tax: roasted coffee beans sold whole or ground are "basic groceries" under the Excise Tax Act
 * (Schedule VI, Part III) and are zero-rated for GST/HST, and exempt from provincial sales taxes.
 * So tax is 0 for every product with taxCategory "zero-rated-grocery". Shipping follows the tax
 * status of what is shipped. Confirm with your accountant before launch; the table below is ready
 * for "standard" items (mugs, merch) if you ever sell them.
 */
const HST_OR_GST: Record<Province, number> = {
  AB: 0.05, BC: 0.05, MB: 0.05, NB: 0.15, NL: 0.15, NS: 0.14, NT: 0.05,
  NU: 0.05, ON: 0.13, PE: 0.15, QC: 0.05, SK: 0.05, YT: 0.05,
};

export interface PricedCart {
  lines: OrderLine[];
  subtotalCents: number;
  shippingCents: number;
  taxCents: number;
  totalCents: number;
  totalKg: number;
  minimumOrderKg: number;
  meetsMinimum: boolean;
  invalidSkus: string[];
}

export async function priceCart(
  cart: CartLine[],
  tier: PriceTier,
  locale: Locale,
  province?: Province,
): Promise<PricedCart> {
  const settings = await getSettings();
  const lines: OrderLine[] = [];
  const invalidSkus: string[] = [];
  let taxableCents = 0;

  for (const item of cart) {
    const quantity = Math.max(0, Math.floor(item.quantity));
    if (!quantity) continue;
    const found = await findFormat(item.sku);
    if (!found || !found.product.roasts.includes(item.roast)) {
      invalidSkus.push(item.sku);
      continue;
    }
    const { product, format } = found;
    const unitPriceCents = format.price[tier];
    lines.push({
      sku: format.sku,
      productId: product.id,
      productName: product.name[locale],
      formatLabel: format.label[locale],
      roast: item.roast,
      quantity,
      unitPriceCents,
      grams: format.grams,
    });
    if (product.taxCategory === 'standard') taxableCents += unitPriceCents * quantity;
  }

  const subtotalCents = lines.reduce((s, l) => s + l.unitPriceCents * l.quantity, 0);
  const totalKg = lines.reduce((s, l) => s + (l.grams * l.quantity) / 1000, 0);
  const shippingCents =
    lines.length === 0 || totalKg >= settings.freeShippingKg ? 0 : settings.shippingFlatCents;
  const rate = province ? HST_OR_GST[province] : 0;
  const taxCents = Math.round(taxableCents * rate);

  return {
    lines,
    subtotalCents,
    shippingCents,
    taxCents,
    totalCents: subtotalCents + shippingCents + taxCents,
    totalKg: Math.round(totalKg * 100) / 100,
    minimumOrderKg: settings.minimumOrderKg,
    meetsMinimum: totalKg >= settings.minimumOrderKg,
    invalidSkus,
  };
}
