import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import Stripe from "npm:stripe@^17.3.1";

// CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Environment detection function (inline)
function detectEnvironment(req: Request): { isProduction: boolean; environment: string } {
  const referer = req.headers.get('referer') || '';
  const origin = req.headers.get('origin') || '';
  const host = req.headers.get('host') || '';
  const userAgent = req.headers.get('user-agent') || '';

  const isProductionDomain = 
    referer.includes('migma.com') ||
    origin.includes('migma.com') ||
    host.includes('migma.com') ||
    (referer.includes('vercel.app') && !referer.includes('preview')) ||
    (origin.includes('vercel.app') && !origin.includes('preview'));

  const isStripeWebhook = userAgent.includes('Stripe/');
  const hasProdKeys = Deno.env.get('STRIPE_SECRET_KEY_PROD') && 
                     Deno.env.get('STRIPE_WEBHOOK_SECRET_PROD');

  const isProduction = isProductionDomain || (isStripeWebhook && hasProdKeys);

  return {
    isProduction,
    environment: isProduction ? 'production' : 'test',
  };
}

// Get Stripe config (inline, without publishableKey validation)
function getStripeConfig(req: Request): { secretKey: string; apiVersion: string; appInfo: any } {
  const envInfo = detectEnvironment(req);
  const suffix = envInfo.isProduction ? 'PROD' : 'TEST';
  
  const secretKey = Deno.env.get(`STRIPE_SECRET_KEY_${suffix}`) || '';
  
  // Only validate secretKey (publishableKey is not needed in backend)
  if (!secretKey) {
    throw new Error(`Missing STRIPE_SECRET_KEY_${suffix}`);
  }

  console.log(`🔧 Using Stripe in ${envInfo.environment} mode`);

  return {
    secretKey,
    apiVersion: '2024-12-18.acacia',
    appInfo: {
      name: 'MIGMA Visa Services',
      version: '1.0.0',
    },
  };
}

// Stripe fee constants
const CARD_FEE_PERCENTAGE = 0.039; // 3.9%
const CARD_FEE_FIXED = 30; // $0.30 in cents
const PIX_FEE_PERCENTAGE = 0.0179; // 1.79% (1.19% processing + 0.6% conversion)

// Helper function to calculate PIX amount with fees
function calculatePIXAmountWithFees(netAmountUSD: number, exchangeRate: number): number {
  const netAmountBRL = netAmountUSD * exchangeRate;
  const grossAmountBRL = netAmountBRL / (1 - PIX_FEE_PERCENTAGE);
  const grossAmountRounded = Math.round(grossAmountBRL * 100) / 100;
  return Math.round(grossAmountRounded * 100); // Convert to cents
}

// Helper function to get exchange rate
async function getExchangeRate(frontendRate?: number): Promise<number> {
  // Priority 1: Frontend provided rate
  if (frontendRate && frontendRate > 0) {
    return frontendRate;
  }

  // Priority 2: API with margin
  try {
    const response = await fetch("https://api.exchangerate-api.com/v4/latest/USD");
    const data = await response.json();
    const baseRate = parseFloat(data.rates.BRL);
    return baseRate * 1.04; // 4% commercial margin
  } catch (error) {
    console.error("[Exchange Rate] Error fetching rate:", error);
  }

  // Priority 3: Fallback
  return 5.6;
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get dynamic Stripe configuration based on environment
    const stripeConfig = getStripeConfig(req);
    
    // Initialize Stripe with the correct key for the environment
    const stripe = new Stripe(stripeConfig.secretKey, {
      apiVersion: stripeConfig.apiVersion as any,
      appInfo: stripeConfig.appInfo,
    });

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get site URL
    const siteUrl = Deno.env.get("SITE_URL") || req.headers.get("origin") || "http://localhost:5173";

    // Parse request body
    const body = await req.json();
    const {
      product_slug,
      seller_id,
      extra_units = 0,
      client_name,
      client_email,
      client_whatsapp,
      client_country,
      client_nationality,
      client_observations,
      payment_method = "card", // "card" or "pix"
      exchange_rate: frontendExchangeRate,
      contract_document_url,
      contract_selfie_url,
      ip_address,
      service_request_id, // NEW: Optional service_request_id from frontend
    } = body;

    // Validate required fields
    if (!product_slug || !client_name || !client_email) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: product_slug, client_name, client_email" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get product from database
    const { data: product, error: productError } = await supabase
      .from("visa_products")
      .select("*")
      .eq("slug", product_slug)
      .eq("is_active", true)
      .single();

    if (productError || !product) {
      return new Response(
        JSON.stringify({ error: "Product not found or inactive" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Calculate total price based on calculation_type
    const basePrice = parseFloat(product.base_price_usd);
    const extraUnitPrice = parseFloat(product.extra_unit_price);
    
    let totalBeforeFees: number;
    if (product.calculation_type === 'units_only') {
      // For units_only: total = extra_units * extra_unit_price
      totalBeforeFees = extra_units * extraUnitPrice;
    } else {
      // For base_plus_units: total = base_price + (extra_units * extra_unit_price)
      totalBeforeFees = basePrice + (extra_units * extraUnitPrice);
    }

    // Calculate amount with fees based on payment method
    const isPixOnly = payment_method === "pix";
    let finalAmount: number;
    let currency: string;
    let exchangeRate = 5.6;
    let feeAmount: number;

    if (isPixOnly) {
      // PIX payment - BRL
      exchangeRate = await getExchangeRate(frontendExchangeRate);
      finalAmount = calculatePIXAmountWithFees(totalBeforeFees, exchangeRate);
      currency = "brl";
      const netBRL = totalBeforeFees * exchangeRate;
      feeAmount = (finalAmount / 100) - netBRL;
    } else {
      // Card payment - USD
      const baseCents = Math.round(totalBeforeFees * 100);
      finalAmount = Math.round(baseCents + (baseCents * CARD_FEE_PERCENTAGE) + CARD_FEE_FIXED);
      currency = "usd";
      feeAmount = (finalAmount / 100) - totalBeforeFees;
    }

    // Generate unique order number
    const orderNumber = `ORD-${new Date().toISOString().split('T')[0].replace(/-/g, '')}-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;

    // Use existing service_request_id or create new one (if not provided)
    let serviceRequestIdToUse = service_request_id;

    // If service_request_id is not provided, we still create the order
    // but the frontend should have already created the service_request
    // This is a fallback for backward compatibility

    // Create payment record first
    const { data: paymentData, error: paymentError } = await supabase
      .from("payments")
      .insert({
        service_request_id: serviceRequestIdToUse || null,
        amount: totalBeforeFees,
        currency: currency.toUpperCase(),
        status: "pending",
      })
      .select()
      .single();

    if (paymentError) {
      console.error("[Checkout] Error creating payment record:", paymentError);
      // Continue anyway - payment record is not critical for order creation
    }

    // Create order in database
    const { data: order, error: orderError } = await supabase
      .from("visa_orders")
      .insert({
        order_number: orderNumber,
        product_slug: product_slug,
        seller_id: seller_id || null,
        service_request_id: serviceRequestIdToUse || null, // NEW: Link to service_request
        base_price_usd: basePrice,
        price_per_dependent_usd: extraUnitPrice,
        number_of_dependents: extra_units,
        extra_units: extra_units,
        extra_unit_label: product.extra_unit_label,
        extra_unit_price_usd: extraUnitPrice,
        calculation_type: product.calculation_type,
        total_price_usd: totalBeforeFees,
        client_name: client_name,
        client_email: client_email,
        client_whatsapp: client_whatsapp || null,
        client_country: client_country || null,
        client_nationality: client_nationality || null,
        client_observations: client_observations || null,
        payment_method: isPixOnly ? "stripe_pix" : "stripe_card",
        payment_status: "pending",
        contract_document_url: contract_document_url || null,
        contract_selfie_url: contract_selfie_url || null,
        contract_accepted: contract_document_url && contract_selfie_url ? true : false,
        contract_signed_at: contract_document_url && contract_selfie_url ? new Date().toISOString() : null,
        ip_address: ip_address || null,
        payment_metadata: {
          base_amount: totalBeforeFees.toFixed(2),
          final_amount: (finalAmount / 100).toFixed(2),
          fee_amount: feeAmount.toFixed(2),
          fee_percentage: isPixOnly ? PIX_FEE_PERCENTAGE.toString() : CARD_FEE_PERCENTAGE.toString(),
          currency: currency.toUpperCase(),
          exchange_rate: exchangeRate.toFixed(4),
          extra_units: extra_units,
          calculation_type: product.calculation_type,
          ip_address: ip_address || null,
          payment_id: paymentData?.id || null, // NEW: Link to payment record
        },
      })
      .select()
      .single();

    if (orderError || !order) {
      console.error("[Checkout] Error creating order:", orderError);
      return new Response(
        JSON.stringify({ error: "Failed to create order" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Anti-chargeback metadata
    const antiChargebackMetadata = {
      order_id: order.id,
      order_number: orderNumber,
      product_slug: product_slug,
      seller_id: seller_id || "",
      extra_units: extra_units.toString(),
      calculation_type: product.calculation_type,
      terms_accepted: "true",
      terms_version: "v1.0-2025-01-15",
      data_authorization: "true",
      ip_address: ip_address || "",
      service_request_id: serviceRequestIdToUse || "",
      anti_chargeback: "enabled",
    };

    // Create Stripe checkout session with anti-chargeback metadata
    const session = await stripe.checkout.sessions.create({
      payment_method_types: isPixOnly ? ["pix"] : ["card"],
      line_items: [
        {
          price_data: {
            currency: currency,
            product_data: {
              name: product.name,
              description: `${product.description}${extra_units > 0 && product.allow_extra_units ? ` (${extra_units} ${product.extra_unit_label.toLowerCase()})` : ''}`,
            },
            unit_amount: finalAmount,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${siteUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/checkout/cancel?order_id=${order.id}`,
      customer_email: client_email,
      metadata: antiChargebackMetadata,
      // Basic anti-fraud settings (work automatically, no dashboard config needed)
      billing_address_collection: "required", // Require billing address
      phone_number_collection: {
        enabled: true, // Collect phone number for verification
      },
    });

    // Update order with Stripe session ID
    await supabase
      .from("visa_orders")
      .update({ stripe_session_id: session.id })
      .eq("id", order.id);

    // Update payment record with external payment ID (Stripe session ID)
    if (paymentData?.id) {
      await supabase
        .from("payments")
        .update({ 
          external_payment_id: session.id,
          raw_webhook_log: { session_id: session.id, created_at: new Date().toISOString() }
        })
        .eq("id", paymentData.id);
    }

    console.log("[Checkout] Session created:", {
      session_id: session.id,
      order_id: order.id,
      order_number: orderNumber,
      amount: finalAmount / 100,
      currency: currency,
    });

    return new Response(
      JSON.stringify({
        success: true,
        checkout_url: session.url,
        session_id: session.id,
        order_id: order.id,
        order_number: orderNumber,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[Checkout] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});


