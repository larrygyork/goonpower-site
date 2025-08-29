// api/stripe/create-checkout-session.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: '2024-06-20',
});

const USD = 'usd';
const cents = (n: number) => Math.round(n * 100);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { items = [], customer = {}, shipping = 'standard', promo = null } = req.body || {};

    // Map your cart rows to Stripe line_items
    const line_items = (items as any[]).map((it) => ({
      quantity: Number(it.qty || 1),
      price_data: {
        currency: USD,
        unit_amount: cents(Number(it.price)),
        product_data: {
          name: it.name,
          metadata: {
            sku: it.sku || '',
            size: it.size || '',
          },
        },
      },
    }));

    // Shipping options (fixed to match your UI)
    const shipping_rates = {
      standard: { display_name: 'Standard (3–5 days)', fixed_amount: 5.99 },
      expedited: { display_name: 'Expedited (2-day)', fixed_amount: 12.99 },
      free: { display_name: 'Free', fixed_amount: 0 },
    };
    const chosen = shipping_rates[shipping as keyof typeof shipping_rates] || shipping_rates.standard;

    // Build session params
    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: 'payment',
      payment_method_types: ['card', 'us_bank_account', 'link'],
      line_items,
      shipping_address_collection: { allowed_countries: ['US'] },
      shipping_options: [
        { shipping_rate_data: { type: 'fixed_amount', fixed_amount: { amount: cents(chosen.fixed_amount), currency: USD }, display_name: chosen.display_name } },
      ],
      customer_email: customer.email || undefined,
      metadata: {
        promo: promo || '',
        origin: 'goonpower',
      },
      success_url: `${process.env.SITE_URL}/secure-order.html`,
      cancel_url: `${process.env.SITE_URL}/checkout.html`,
    };

    const session = await stripe.checkout.sessions.create(sessionParams);
    return res.status(200).json({ id: session.id, url: session.url });
  } catch (err: any) {
    console.error('[stripe] create-checkout-session error:', err);
    return res.status(500).json({ error: err?.message || 'Stripe error' });
  }
}
