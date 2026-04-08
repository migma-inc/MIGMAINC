import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SQUARE_CARD_FEE_PERCENTAGE = 0.029;
const SQUARE_CARD_FEE_FIXED = 0.30;
const SQUARE_API_VERSION = Deno.env.get("SQUARE_API_VERSION") || "2026-01-22";

function calculateSquareGrossAmountCents(netAmountUsd: number): number {
  const netAmountCents = Math.round(netAmountUsd * 100);
  return Math.round((netAmountCents + Math.round(SQUARE_CARD_FEE_FIXED * 100)) / (1 - SQUARE_CARD_FEE_PERCENTAGE));
}

function getEnvValue(keys: string[]): string {
  for (const key of keys) {
    const value = Deno.env.get(key);
    if (value) return value;
  }
  return "";
}

function getSupabaseConfig() {
  const supabaseUrl =
    Deno.env.get("MIGMA_REMOTE_URL") ||
    Deno.env.get("REMOTE_SUPABASE_URL") ||
    Deno.env.get("SUPABASE_URL") ||
    "";
  const supabaseServiceKey =
    Deno.env.get("MIGMA_REMOTE_SERVICE_ROLE_KEY") ||
    Deno.env.get("REMOTE_SUPABASE_SERVICE_ROLE_KEY") ||
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ||
    "";

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error("Missing Supabase runtime configuration");
  }

  return { supabaseUrl, supabaseServiceKey };
}

function detectEnvironment(req: Request): { isProduction: boolean; environment: "production" | "test" } {
  const referer = req.headers.get("referer") || "";
  const origin = req.headers.get("origin") || "";
  const host = req.headers.get("host") || "";

  const isProductionDomain =
    referer.includes("migma.com") ||
    origin.includes("migma.com") ||
    host.includes("migma.com") ||
    referer.includes("migmainc.com") ||
    origin.includes("migmainc.com") ||
    host.includes("migmainc.com") ||
    (referer.includes("vercel.app") && !referer.includes("preview")) ||
    (origin.includes("vercel.app") && !origin.includes("preview"));

  return {
    isProduction: isProductionDomain,
    environment: isProductionDomain ? "production" : "test",
  };
}

async function resolveSquareLocationId(accessToken: string, baseUrl: string): Promise<string> {
  const response = await fetch(`${baseUrl}/v2/locations`, {
    method: "GET",
    headers: {
      "Square-Version": SQUARE_API_VERSION,
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.errors?.[0]?.detail || "Failed to load Square locations");
  }

  const locations = Array.isArray(payload?.locations) ? payload.locations : [];
  const activeLocation =
    locations.find((location: any) => location?.status === "ACTIVE" && location?.capabilities?.includes?.("CREDIT_CARD_PROCESSING")) ||
    locations.find((location: any) => location?.status === "ACTIVE") ||
    locations[0];

  if (!activeLocation?.id) {
    throw new Error("No active Square location found for this access token");
  }

  return activeLocation.id;
}

async function getSquareConfig(req: Request) {
  const envInfo = detectEnvironment(req);
  const suffix = envInfo.isProduction ? "PROD" : "TEST";
  const accessToken = suffix === "TEST"
    ? getEnvValue([`SQUARE_ACCESS_TOKEN_${suffix}`, "Sandbox Access token"])
    : getEnvValue([`SQUARE_ACCESS_TOKEN_${suffix}`, "SQUARE_ACCESS_TOKEN"]);
  const applicationId = suffix === "TEST"
    ? getEnvValue([`SQUARE_APPLICATION_ID_${suffix}`, "Sandbox Application ID"])
    : getEnvValue([`SQUARE_APPLICATION_ID_${suffix}`, "SQUARE_APPLICATION_ID"]);
  const baseUrl = envInfo.isProduction ? "https://connect.squareup.com" : "https://connect.squareupsandbox.com";

  if (!accessToken) {
    throw new Error(`Missing Square access token for ${suffix}`);
  }

  const configuredLocationId = suffix === "TEST"
    ? getEnvValue([`SQUARE_LOCATION_ID_${suffix}`])
    : getEnvValue([`SQUARE_LOCATION_ID_${suffix}`, "SQUARE_LOCATION_ID"]);
  const locationId = configuredLocationId || await resolveSquareLocationId(accessToken, baseUrl);

  return {
    accessToken,
    applicationId,
    locationId,
    baseUrl,
    envInfo,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  let createdOrderIds: string[] = [];
  let createdPaymentId: string | null = null;

  try {
    const squareConfig = await getSquareConfig(req);
    const { supabaseUrl, supabaseServiceKey } = getSupabaseConfig();
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const siteUrl = Deno.env.get("SITE_URL") || req.headers.get("origin") || "http://localhost:5173";

    const body = await req.json();
    const {
      product_slug,
      seller_id,
      extra_units = 0,
      dependent_names = [],
      client_name,
      client_email,
      client_whatsapp,
      client_country,
      client_nationality,
      client_observations,
      contract_document_url,
      contract_selfie_url,
      signature_image_url,
      ip_address,
      service_request_id,
      upsell_product_slug,
      upsell_contract_template_id,
      contract_template_id,
      billing_installment_id,
      coupon_code,
      discount_amount,
    } = body;

    const extraUnitsNum = parseInt(extra_units) || 0;
    const dependentNamesArray = Array.isArray(dependent_names)
      ? dependent_names.filter((name) => typeof name === "string" && name.trim() !== "")
      : [];

    if (!product_slug || !client_name || !client_email || !service_request_id) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: product_slug, client_name, client_email, service_request_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (extraUnitsNum > 0 && dependentNamesArray.length !== extraUnitsNum) {
      return new Response(
        JSON.stringify({ error: `Number of dependent names (${dependentNamesArray.length}) must match number of dependents (${extraUnitsNum})` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: product, error: productError } = await supabase
      .from("visa_products")
      .select("*")
      .eq("slug", product_slug)
      .eq("is_active", true)
      .single();

    if (productError || !product) {
      console.error("[Square Checkout] Product lookup failed", { product_slug, productError });
      return new Response(
        JSON.stringify({ error: "Product not found or inactive" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const basePrice = parseFloat(product.base_price_usd);
    const extraUnitPrice = parseFloat(product.extra_unit_price);
    let totalBeforeFees = product.calculation_type === "units_only"
      ? extraUnitsNum * extraUnitPrice
      : basePrice + (extraUnitsNum * extraUnitPrice);

    const upsellPrice = upsell_product_slug === "canada-tourist-premium"
      ? 399
      : (upsell_product_slug === "canada-tourist-revolution" ? 199 : 0);
    const mainProductPrice = totalBeforeFees;
    totalBeforeFees += upsellPrice;

    const discountAmountNum = parseFloat(discount_amount) || 0;
    if (discountAmountNum > 0) {
      totalBeforeFees = Math.max(0, totalBeforeFees - discountAmountNum);
    }

    if (!Number.isFinite(totalBeforeFees) || totalBeforeFees <= 0) {
      return new Response(
        JSON.stringify({ error: "Invalid total amount calculated" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const netMainOrderAmountUsd = Math.max(totalBeforeFees - upsellPrice, 0);
    const amountCents = calculateSquareGrossAmountCents(totalBeforeFees);
    const finalAmountUsd = amountCents / 100;
    const feeAmount = Math.round((finalAmountUsd - totalBeforeFees) * 100) / 100;

    if (amountCents < 50) {
      return new Response(
        JSON.stringify({ error: "Amount too small. Minimum is $0.50 USD." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const orderId = crypto.randomUUID();
    const orderNumber = `ORD-${new Date().toISOString().split("T")[0].replace(/-/g, "")}-${Math.floor(Math.random() * 10000).toString().padStart(4, "0")}`;
    createdOrderIds.push(orderId);

    const { data: paymentRecord, error: paymentError } = await supabase
      .from("payments")
      .insert({
        service_request_id,
        amount: totalBeforeFees,
        currency: "USD",
        status: "pending",
        is_test: !squareConfig.envInfo.isProduction,
      })
      .select()
      .single();

    if (paymentError) {
      throw new Error(`Failed to create payment record: ${paymentError.message}`);
    }
    createdPaymentId = paymentRecord.id;

    const baseOrderPayload = {
      id: orderId,
      order_number: orderNumber,
      product_slug,
      seller_id: seller_id || null,
      service_request_id,
      base_price_usd: basePrice,
      price_per_dependent_usd: extraUnitPrice,
      number_of_dependents: extraUnitsNum,
      extra_units: extraUnitsNum,
      dependent_names: extraUnitsNum > 0 ? dependentNamesArray : null,
      extra_unit_label: product.extra_unit_label,
      extra_unit_price_usd: extraUnitPrice,
      calculation_type: product.calculation_type,
      total_price_usd: netMainOrderAmountUsd,
      client_name,
      client_email,
      client_whatsapp: client_whatsapp || null,
      client_country: client_country || null,
      client_nationality: client_nationality || null,
      client_observations: client_observations || null,
      payment_method: "square_card",
      payment_status: "pending",
      contract_document_url: contract_document_url || null,
      contract_selfie_url: contract_selfie_url || null,
      signature_image_url: signature_image_url || null,
      contract_accepted: !!(contract_document_url && contract_selfie_url),
      contract_signed_at: contract_document_url && contract_selfie_url ? new Date().toISOString() : null,
      ip_address: ip_address || null,
      contract_template_id: contract_template_id || null,
      coupon_code: coupon_code || null,
      discount_amount: discountAmountNum || 0,
      is_test: !squareConfig.envInfo.isProduction,
      payment_metadata: {
        provider: "square",
        base_amount: mainProductPrice.toFixed(2),
        final_amount: finalAmountUsd.toFixed(2),
        fee_amount: feeAmount.toFixed(2),
        fee_percentage: SQUARE_CARD_FEE_PERCENTAGE.toString(),
        currency: "USD",
        extra_units: extraUnitsNum,
        calculation_type: product.calculation_type,
        ip_address: ip_address || null,
        payment_id: paymentRecord.id,
        has_upsell: !!upsell_product_slug,
        billing_installment_id: billing_installment_id || null,
      },
    };

    const { data: mainOrder, error: orderError } = await supabase
      .from("visa_orders")
      .insert(baseOrderPayload)
      .select()
      .single();

    if (orderError || !mainOrder) {
      throw new Error(orderError?.message || "Failed to create order");
    }

    let upsellOrderId: string | null = null;
    if (upsell_product_slug) {
      upsellOrderId = crypto.randomUUID();
      createdOrderIds.push(upsellOrderId);

      const { error: upsellOrderError } = await supabase
        .from("visa_orders")
        .insert({
          id: upsellOrderId,
          order_number: `ORD-UPS-${new Date().toISOString().split("T")[0].replace(/-/g, "")}-${Math.floor(Math.random() * 10000).toString().padStart(4, "0")}`,
          product_slug: upsell_product_slug,
          seller_id: seller_id || null,
          service_request_id,
          base_price_usd: upsellPrice,
          price_per_dependent_usd: 0,
          extra_units: 0,
          total_price_usd: upsellPrice,
          client_name,
          client_email,
          client_whatsapp: client_whatsapp || null,
          client_country: client_country || null,
          client_nationality: client_nationality || null,
          client_observations: client_observations || null,
          payment_method: "square_card",
          payment_status: "pending",
          contract_document_url: contract_document_url || null,
          contract_selfie_url: contract_selfie_url || null,
          signature_image_url: signature_image_url || null,
          contract_accepted: true,
          contract_signed_at: new Date().toISOString(),
          contract_template_id: upsell_contract_template_id || null,
          ip_address: ip_address || null,
          is_test: !squareConfig.envInfo.isProduction,
          payment_metadata: {
            provider: "square",
            is_upsell: true,
            parent_order_id: orderId,
            base_amount: upsellPrice.toFixed(2),
          },
        });

      if (upsellOrderError) {
        throw new Error(`Failed to create upsell order: ${upsellOrderError.message}`);
      }
    }

    const quickPayName = upsell_product_slug
      ? `${product.name} + Canada Bundle`
      : product.name;
    const redirectUrl = `${siteUrl}/checkout/success?order_id=${orderId}&method=square`;

    const squareResponse = await fetch(`${squareConfig.baseUrl}/v2/online-checkout/payment-links`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${squareConfig.accessToken}`,
        "Content-Type": "application/json",
        "Square-Version": SQUARE_API_VERSION,
      },
      body: JSON.stringify({
        idempotency_key: crypto.randomUUID(),
        quick_pay: {
          name: quickPayName,
          price_money: {
            amount: amountCents,
            currency: "USD",
          },
          location_id: squareConfig.locationId,
        },
        checkout_options: {
          redirect_url: redirectUrl,
        },
        payment_note: `MIGMA ${orderNumber}`,
      }),
    });

    const squareData = await squareResponse.json();
    if (!squareResponse.ok || !squareData?.payment_link?.url) {
      const squareError = squareData?.errors?.map((item: { detail?: string; code?: string }) => item.detail || item.code).join(", ");
      throw new Error(squareError || "Failed to create Square payment link");
    }

    const paymentLinkId = squareData.payment_link.id;
    const squareOrderId = squareData.payment_link.order_id;
    const checkoutUrl = squareData.payment_link.url;

    await supabase
      .from("visa_orders")
      .update({
        payment_metadata: {
          ...mainOrder.payment_metadata,
          square_payment_link_id: paymentLinkId,
          square_order_id: squareOrderId,
          square_checkout_url: checkoutUrl,
          payment_redirect_url: redirectUrl,
        },
      })
      .eq("id", orderId);

    if (upsellOrderId) {
      await supabase
        .from("visa_orders")
        .update({
          payment_metadata: {
            provider: "square",
            is_upsell: true,
            parent_order_id: orderId,
            base_amount: upsellPrice.toFixed(2),
            square_payment_link_id: paymentLinkId,
            square_order_id: squareOrderId,
            square_checkout_url: checkoutUrl,
          },
        })
        .eq("id", upsellOrderId);
    }

    await supabase
      .from("payments")
      .update({
        external_payment_id: paymentLinkId,
        raw_webhook_log: {
          provider: "square",
          payment_link_id: paymentLinkId,
          square_order_id: squareOrderId,
          created_at: new Date().toISOString(),
        },
      })
      .eq("id", paymentRecord.id);

    return new Response(
      JSON.stringify({
        success: true,
        url: checkoutUrl,
        order_id: orderId,
        order_number: orderNumber,
        payment_link_id: paymentLinkId,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: any) {
    console.error("[Square Checkout] Error:", error);

    if (createdOrderIds.length > 0 || createdPaymentId) {
      try {
        const { supabaseUrl, supabaseServiceKey } = getSupabaseConfig();
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        if (createdOrderIds.length > 0) {
          await supabase.from("visa_orders").delete().in("id", createdOrderIds);
        }
        if (createdPaymentId) {
          await supabase.from("payments").delete().eq("id", createdPaymentId);
        }
      } catch (rollbackError) {
        console.error("[Square Checkout] Rollback failed:", rollbackError);
      }
    }

    return new Response(
      JSON.stringify({ error: error?.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
