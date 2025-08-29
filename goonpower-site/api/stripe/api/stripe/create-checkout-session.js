// api/stripe/create-checkout-session.js
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2024-06-20" });

const USD = "usd";
const cents = n => Math.round(Number(n) * 100);

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { items = [], customer = {}, shipping = "standard", promo = null } = req.body || {};

    const line_items = items.map(it => ({
      quantity: Number(it.qty || 1),
      price_data: {
        currency: USD,
        unit_amount: cents(it.price),
        product_data: { name: it.name, metadata: { sku: it.sku || "", size: it.size || "" } }
      }
    }));

    const rates = {
      standard: { name: "Standard (3–5 days)", amount: 5.99 },
      expedited: { name: "Expedited (2-day)", amount: 12.99 },
      free: { name: "Free", amount: 0 }
    };
    const r = rates[shipping] || rates.standard;

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card", "link"], // add more later if you like
      line_items,
      shipping_address_collection: { allowed_countries: ["US"] },
      shipping_options: [
        { shipping_rate_data: { type: "fixed_amount", fixed_amount: { amount: cents(r.amount), currency: USD }, display_name: r.name } }
      ],
      customer_email: customer.email || undefined,
      metadata: { promo: promo || "", origin: "goonpower" },
      success_url: `${process.env.SITE_URL}/secure-order.html`,
      cancel_url: `${process.env.SITE_URL}/checkout.html`
    });

    return res.status(200).json({ id: session.id, url: session.url });
  } catch (err) {
    console.error("[stripe] create-checkout-session error:", err);
    return res.status(500).json({ error: err?.message || "Stripe error" });
  }
}
