import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link, redirect } from '@/i18n/navigation';
import { SiteHeader } from '@/components/SiteHeader';
import { getCurrentCustomer } from '@/lib/auth';
import { repo } from '@/lib/db';
import { formatDate, formatKg, formatMoney } from '@/lib/format';
import { paymentsEnabled, stripe } from '@/lib/payments';
import type { Locale } from '@/lib/types';
import { payOrderAction } from '../../../actions';

export const metadata = { robots: { index: false } };

export default async function OrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale; id: string }>;
  searchParams: Promise<{ paid?: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const customer = await getCurrentCustomer();
  if (!customer) return redirect({ href: `/login?next=/account/orders/${id}`, locale });
  let order = await repo.orders.getById(id);
  if (!order || order.customerId !== customer.id) notFound();

  // Back from Stripe: confirm the payment directly, in case the webhook has not arrived yet.
  const { paid } = await searchParams;
  const s = stripe();
  if (paid && s && order.status === 'awaiting_payment') {
    const session = await s.checkout.sessions.retrieve(paid).catch(() => null);
    if (session?.payment_status === 'paid' && session.metadata?.orderId === order.id) {
      order = await repo.orders.updateStatus(order.id, 'paid', { stripeSessionId: session.id });
    }
  }

  const t = await getTranslations();
  const kg = order.lines.reduce((sum, l) => sum + (l.grams * l.quantity) / 1000, 0);
  const a = order.shippingAddress;
  const notice =
    order.status === 'paid' ? t('order.paidNotice')
    : order.status === 'invoiced' ? t('order.invoiceNotice')
    : order.status === 'awaiting_payment' ? t('order.awaitingNotice')
    : null;

  return (
    <>
      <SiteHeader />
      <main id="content" className="inner" style={{ paddingTop: 'clamp(2.5rem, 6vw, 5rem)' }}>
        <p style={{ marginBottom: '1.5rem' }}><Link href="/account" className="link">← {t('order.back')}</Link></p>
        <div className="stack" style={{ marginBottom: '2rem' }}>
          <h1 className="h-section nums">{t('order.number', { number: order.number })}</h1>
          <p className="nums">
            {t('order.placed', { date: formatDate(order.createdAt, locale) })} ·{' '}
            <span className={`status status--${order.status}`}>{t(`order.status.${order.status}`)}</span>
          </p>
          {notice && <p className={`notice ${order.status === 'awaiting_payment' ? 'notice--strong' : ''}`}>{notice}</p>}
        </div>
        <div className="portal">
          <ul className="lines">
            {order.lines.map((l) => (
              <li key={`${l.sku}-${l.roast}`} className="line-item nums">
                <div>
                  <div className="line-item__name">{l.productName}</div>
                  <div className="line-item__meta">{l.formatLabel} · {t(`formats.${l.roast}`)}</div>
                </div>
                <span>{l.quantity} × {formatMoney(l.unitPriceCents, locale)}</span>
                <span className="line-item__total">{formatMoney(l.unitPriceCents * l.quantity, locale)}</span>
              </li>
            ))}
          </ul>
          <aside className="panel stack nums">
            <div className="totals">
              <div><span>{t('order.kg')}</span><span>{formatKg(kg, locale)}</span></div>
              <div><span>{t('order.subtotal')}</span><span>{formatMoney(order.subtotalCents, locale)}</span></div>
              <div><span>{t('order.shipping')}</span><span>{order.shippingCents ? formatMoney(order.shippingCents, locale) : t('order.free')}</span></div>
              <div><span>{t('order.tax')}</span><span>{formatMoney(order.taxCents, locale)}</span></div>
              <div className="grand"><span>{t('order.total')}</span><span>{formatMoney(order.totalCents, locale)}</span></div>
            </div>
            <div>
              <p className="hint">{t('order.deliverTo')}</p>
              <p>{a.label}<br />{a.line1}{a.line2 ? `, ${a.line2}` : ''}<br />{a.city}, {a.province} {a.postalCode}</p>
            </div>
            {order.status === 'awaiting_payment' && paymentsEnabled() && (
              <form action={payOrderAction}>
                <input type="hidden" name="orderId" value={order.id} />
                <button className="btn btn--block">{t('order.payNow')}</button>
              </form>
            )}
          </aside>
        </div>
      </main>
    </>
  );
}
