import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link, redirect } from '@/i18n/navigation';
import { SiteHeader } from '@/components/SiteHeader';
import { CheckoutForm } from '@/components/forms';
import { getCurrentCustomer } from '@/lib/auth';
import { readCart } from '@/lib/cart';
import { formatKg, formatMoney } from '@/lib/format';
import { paymentsEnabled } from '@/lib/payments';
import { priceCart } from '@/lib/pricing';
import type { Locale } from '@/lib/types';
import { updateCartLine } from '../actions';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const t = await getTranslations({ locale: (await params).locale, namespace: 'cart' });
  return { title: t('title'), robots: { index: false } };
}

export default async function CartPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{ cancelled?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const customer = await getCurrentCustomer();
  if (!customer) return redirect({ href: '/login?next=/cart', locale });
  const t = await getTranslations();
  const address = customer.addresses.find((a) => a.isDefault) ?? customer.addresses[0];
  const priced = await priceCart(await readCart(), customer.priceTier, locale, address?.province);
  const { cancelled } = await searchParams;
  const remaining = Math.max(0, priced.minimumOrderKg - priced.totalKg);
  const approved = customer.status === 'approved';

  return (
    <>
      <SiteHeader />
      <main id="content" className="inner" style={{ paddingTop: 'clamp(2.5rem, 6vw, 5rem)' }}>
        <h1 className="h-section" style={{ marginBottom: '2rem' }}>{t('cart.title')}</h1>
        {cancelled && <p className="notice" style={{ marginBottom: '1.5rem' }}>{t('cart.cancelled')}</p>}
        {!approved && <p className="notice notice--strong" style={{ marginBottom: '1.5rem' }}>{t('product.pending')}</p>}

        {priced.lines.length === 0 ? (
          <div className="stack" style={{ maxWidth: '28rem' }}>
            <p className="notice">{t('cart.empty')}</p>
            <div><Link href="/coffee" className="btn">{t('cart.browse')}</Link></div>
          </div>
        ) : (
          <div className="portal">
            <ul className="lines">
              {priced.lines.map((l) => (
                <li key={`${l.sku}-${l.roast}`} className="line-item nums">
                  <div>
                    <div className="line-item__name">{l.productName}</div>
                    <div className="line-item__meta">{l.formatLabel} · {t(`formats.${l.roast}`)} · {formatMoney(l.unitPriceCents, locale)}</div>
                  </div>
                  <form action={updateCartLine} style={{ display: 'flex', gap: '.5rem', alignItems: 'center' }}>
                    <input type="hidden" name="sku" value={l.sku} />
                    <input type="hidden" name="roast" value={l.roast} />
                    <div className="qty">
                      <button name="quantity" value={l.quantity - 1} aria-label="−1">−</button>
                      <output style={{ width: '3rem', display: 'grid', placeItems: 'center', background: 'var(--cream)' }}>{l.quantity}</output>
                      <button name="quantity" value={l.quantity + 1} aria-label="+1">+</button>
                    </div>
                    <button name="quantity" value={0} className="link" style={{ textDecorationColor: 'currentColor', marginLeft: '.5rem' }}>{t('cart.remove')}</button>
                  </form>
                  <span className="line-item__total">{formatMoney(l.unitPriceCents * l.quantity, locale)}</span>
                </li>
              ))}
            </ul>

            <aside className="panel panel--dark stack nums">
              <div>
                <p>{t('cart.progress', { kg: formatKg(priced.totalKg, locale).replace(' kg', ''), min: priced.minimumOrderKg })}</p>
                <div className="meter" aria-hidden="true">
                  <span style={{ width: `${Math.min(100, (priced.totalKg / priced.minimumOrderKg) * 100)}%` }} />
                </div>
                {!priced.meetsMinimum && <p style={{ marginTop: '.75rem' }}>{t('cart.belowMin', { kg: formatKg(remaining, locale).replace(' kg', '') })}</p>}
              </div>
              <div className="totals">
                <div><span>{t('order.subtotal')}</span><span>{formatMoney(priced.subtotalCents, locale)}</span></div>
                <div><span>{t('order.shipping')}</span><span>{priced.shippingCents ? formatMoney(priced.shippingCents, locale) : t('order.free')}</span></div>
                <div><span>{t('order.tax')}</span><span>{formatMoney(priced.taxCents, locale)}</span></div>
                <div className="grand"><span>{t('order.total')}</span><span>{formatMoney(priced.totalCents, locale)}</span></div>
              </div>
              <div>
                <p style={{ color: '#c9d6d3', fontSize: 'var(--step-small)' }}>{t('cart.address')}</p>
                {address ? (
                  <p>{address.label}<br />{address.line1}<br />{address.city}, {address.province} {address.postalCode}</p>
                ) : (
                  <p>{t('cart.noAddress')} <Link href="/account" className="link" style={{ textDecorationColor: 'currentColor' }}>{t('cart.addAddress')}</Link></p>
                )}
              </div>
              <div style={{ color: 'var(--forest)', background: 'var(--cream)', padding: '1.25rem' }}>
                <CheckoutForm
                  canOrder={approved && priced.meetsMinimum && Boolean(address)}
                  invoiceDays={customer.invoiceTermsDays}
                  paymentsEnabled={paymentsEnabled()}
                />
              </div>
            </aside>
          </div>
        )}
      </main>
    </>
  );
}
