import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Stripe from "npm:stripe@^17.3.1";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// 3.9% + $0.30 Stripe card fee — passed on to the customer
const CARD_FEE_PERCENTAGE = 0.039;
const CARD_FEE_FIXED_CENTS = 30;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const body = await req.json();
    const { amount, user_id, email, full_name, service_type, origin } = body;

    if (!amount || !email) {
      return new Response(JSON.stringify({ error: "amount and email are required" }), {
        status: 400,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    // Always use TEST key for now (test mode)
    const stripeKey =
      Deno.env.get("STRIPE_SECRET_KEY_TEST") ||
      Deno.env.get("STRIPE_SECRET_KEY");

    if (!stripeKey) {
      return new Response(JSON.stringify({ error: "Stripe not configured" }), {
        status: 500,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2024-12-18.acacia" as any });

    // Calculate gross amount (net + Stripe fee)
    const baseCents = Math.round(amount * 100);
    const finalAmount = Math.round(baseCents + baseCents * CARD_FEE_PERCENTAGE + CARD_FEE_FIXED_CENTS);

    const siteUrl = origin || "http://localhost:5173";
    const serviceSlug = service_type || "transfer";

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `Migma — Taxa de Processo de Seleção`,
              description: `Serviço: ${serviceSlug.toUpperCase()} · Inclui taxa do cartão`,
            },
            unit_amount: finalAmount,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${siteUrl}/student/checkout/${serviceSlug}?stripe_session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/student/checkout/${serviceSlug}?stripe_cancelled=1`,
      customer_email: email,
      metadata: {
        user_id: user_id || "",
        full_name: full_name || "",
        service_type: serviceSlug,
        source: "migma_student_checkout",
        net_amount_usd: (amount).toString(),
      },
    });

    console.log(`[migma-student-stripe-checkout] Session created: ${session.id} for ${email} — $${(finalAmount / 100).toFixed(2)} USD`);

    return new Response(
      JSON.stringify({ url: session.url, session_id: session.id }),
      { headers: { ...CORS, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("[migma-student-stripe-checkout]", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
