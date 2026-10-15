import { NextResponse } from 'next/server';
import { stripe } from '@/lib/payments';
import { repo } from '@/lib/db';

/** Stripe calls this after a payment. Point a webhook at /api/stripe/webhook in the Stripe dashboard. */
export async function POST(request: Request) {
  const s = stripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!s || !secret) return NextResponse.json({ error: 'Stripe not configured' }, { status: 501 });

  const signature = request.headers.get('stripe-signature');
  if (!signature) return NextResponse.json({ error: 'Missing signature' }, { status: 400 });

  let event;
  try {
    event = s.webhooks.constructEvent(await request.text(), signature, secret);
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const orderId = session.metadata?.orderId;
    if (orderId && session.payment_status === 'paid') {
      const order = await repo.orders.getById(orderId);
      if (order && order.status === 'awaiting_payment') {
        await repo.orders.updateStatus(orderId, 'paid', { stripeSessionId: session.id });
      }
    }
  }

  return NextResponse.json({ received: true });
}
