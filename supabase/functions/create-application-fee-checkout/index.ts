import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import Stripe from "npm:stripe@^17.3.1";

/**
 * create-application-fee-checkout
 * Cria sessão de pagamento (Stripe ou Parcelow) para a Taxa de Matrícula.
 * Usa exclusivamente as keys do projeto MatriculaUSA (prefixo MATRICULAUSA_).
 *
 * Input: {
 *   scholarship_application_id: string
 *   payment_method: 'stripe' | 'parcelow_card' | 'parcelow_pix' | 'parcelow_ted'
 *   cpf?: string        (obrigatório para Parcelow)
 *   origin?: string     (URL base para redirect)
 * }
 */

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const STRIPE_FEE_PERCENT = 0.039;
const STRIPE_FEE_FIXED_CENTS = 30;

// ─── Parcelow Client (MatriculaUSA keys) ─────────────────────────────────────
class ParcelowClient {
  private clientId: number | string;
  private clientSecret: string;
  private baseUrl: string;

  constructor(clientId: number | string, clientSecret: string, environment: "staging" | "production" = "staging") {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.baseUrl = environment === "production"
      ? "https://app.parcelow.com"
      : "https://sandbox-2.parcelow.com.br";
  }

  private async getAccessToken(): Promise<string> {
    const isStringId = typeof this.clientId === "string" && this.clientId.length > 10;
    let body: string;
    if (isStringId) {
      const hexNum = parseInt(this.clientId as string, 16);
      body = JSON.stringify({
        client_id: !isNaN(hexNum) && hexNum > 0 ? hexNum : this.clientId,
        client_secret: this.clientSecret,
        grant_type: "client_credentials",
      });
    } else {
      const parsed = parseInt(this.clientId.toString());
      body = JSON.stringify({
        client_id: isNaN(parsed) ? this.clientId : parsed,
        client_secret: this.clientSecret,
        grant_type: "client_credentials",
      });
    }
    const res = await fetch(`${this.baseUrl}/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body,
    });
    if (!res.ok) throw new Error(`Parcelow Auth (${res.status}): ${await res.text()}`);
    return (await res.json()).access_token;
  }

  async createOrder(orderData: Record<string, unknown>): Promise<any> {
    const token = await this.getAccessToken();
    const res = await fetch(`${this.baseUrl}/api/orders`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(orderData),
    });
    if (!res.ok) throw new Error(`Parcelow Order (${res.status}): ${await res.text()}`);
    return await res.json();
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function jsonError(msg: string, status = 400) {
  return new Response(JSON.stringify({ error: msg }), {
    status, headers: { ...CORS, "Content-Type": "application/json" },
  });
}
function jsonOk(data: Record<string, unknown>) {
  return new Response(JSON.stringify(data), {
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

// ─── Main ─────────────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const migmaUrl = Deno.env.get("SUPABASE_URL")!;
  const migmaKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const supabase = createClient(migmaUrl, migmaKey);

  try {
    // ── 0. Validar JWT do aluno ───────────────────────────────────────────────
    const authHeader = req.headers.get("authorization") ?? "";
    const jwt = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (!jwt) return jsonError("Unauthorized — JWT required", 401);

    const userClient = createClient(migmaUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    });
    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) return jsonError("Unauthorized — invalid JWT", 401);

    // ── 1. Parse e validar input ──────────────────────────────────────────────
    const body = await req.json();
    const { scholarship_application_id, payment_method, cpf, origin, payer_name, payer_email, payer_phone } = body as {
      scholarship_application_id?: string;
      payment_method?: string;
      cpf?: string;
      origin?: string;
      payer_name?: string;
      payer_email?: string;
      payer_phone?: string;
    };

    if (!scholarship_application_id || !payment_method) {
      return jsonError("scholarship_application_id and payment_method are required");
    }

    const validMethods = ["stripe", "parcelow_card", "parcelow_pix", "parcelow_ted"];
    if (!validMethods.includes(payment_method)) {
      return jsonError(`payment_method must be one of: ${validMethods.join(", ")}`);
    }

    // ── 2. Carregar profile e verificar ownership ─────────────────────────────
    const { data: myProfile } = await supabase
      .from("user_profiles")
      .select("id, email, full_name, phone, num_dependents")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!myProfile?.id) return jsonError("Student profile not found", 404);

    const numDependents = myProfile.num_dependents || 0;
    // Migma Rule: $350 base + $100 per dependent
    let applicationFee = 350 + (numDependents * 100);
    let applicationType: 'legacy' | 'institution' = 'legacy';
    let applicationFound = false;

    // Tentar scholarship_applications (Legacy)
    const { data: legacyApp } = await supabase
      .from("scholarship_applications")
      .select("id, student_id, is_application_fee_paid")
      .eq("id", scholarship_application_id)
      .maybeSingle();

    if (legacyApp) {
      if (legacyApp.student_id !== myProfile.id) return jsonError("Forbidden", 403);
      if (legacyApp.is_application_fee_paid) return jsonError("Application fee already paid");
      applicationType = 'legacy';
      applicationFound = true;
    } else {
      // Tentar institution_applications (V11)
      const { data: v11App } = await supabase
        .from("institution_applications")
        .select("id, profile_id, status")
        .eq("id", scholarship_application_id)
        .maybeSingle();

      if (v11App) {
        if (v11App.profile_id !== myProfile.id) return jsonError("Forbidden", 403);
        applicationType = 'institution';
        applicationFound = true;
      }
    }

    if (!applicationFound) return jsonError("Application not found", 404);

    const siteUrl = (origin || "https://migmainc.com").replace(/\/$/, "");
    const returnBase = `${siteUrl}/student/onboarding?step=payment`;

    console.log(
      `[create-application-fee-checkout] user=${user.id} app=${scholarship_application_id}` +
      ` type=${applicationType} method=${payment_method} amount=${applicationFee}`
    );

    // ── 3. Stripe (MatriculaUSA keys) ─────────────────────────────────────────
    if (payment_method === "stripe") {
      const isProduction = siteUrl.includes("migmainc.com");
      const stripeKey = isProduction
        ? Deno.env.get("MATRICULAUSA_STRIPE_SECRET_KEY_PROD")
        : Deno.env.get("MATRICULAUSA_STRIPE_SECRET_KEY_TEST");
      if (!stripeKey) throw new Error("MatriculaUSA Stripe key not configured");

      const stripe = new Stripe(stripeKey, { apiVersion: "2024-12-18.acacia" as any });

      const baseCents = Math.round(applicationFee * 100);
      const finalAmount = Math.round((baseCents + STRIPE_FEE_FIXED_CENTS) / (1 - STRIPE_FEE_PERCENT));

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: [{
          price_data: {
            currency: "usd",
            product_data: {
              name: "MatriculaUSA — Application Fee (Taxa de Matrícula)",
              description: `Taxa de matrícula para bolsa selecionada. Inclui taxa do cartão.`,
            },
            unit_amount: finalAmount,
          },
          quantity: 1,
        }],
        mode: "payment",
        success_url: `${returnBase}&af_return=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${returnBase}&af_return=cancelled`,
        customer_email: myProfile.email,
        metadata: {
          fee_type: "application_fee",
          application_type: applicationType,
          scholarship_application_id,
          user_id: user.id,
          full_name: myProfile.full_name || "",
          net_amount_usd: applicationFee.toString(),
        },
      });

      await supabase.from("application_fee_stripe_sessions").insert({
        stripe_session_id: session.id,
        scholarship_application_id: applicationType === 'legacy' ? scholarship_application_id : null,
        profile_id: myProfile.id,
        amount_usd: applicationFee,
      });

      console.log(`[create-application-fee-checkout] Stripe session: ${session.id}`);
      return jsonOk({ checkout_url: session.url!, session_id: session.id });
    }

    // ── 4. Parcelow (MatriculaUSA keys) ───────────────────────────────────────
    const isProduction = siteUrl.includes("migmainc.com");
    const parcelowEnv: "production" | "staging" = isProduction ? "production" : "staging";

    const parcelowClientId = parcelowEnv === "staging"
      ? Deno.env.get("MATRICULAUSA_PARCELOW_CLIENT_ID_STAGING")
      : Deno.env.get("MATRICULAUSA_PARCELOW_CLIENT_ID_PRODUCTION");
    const parcelowClientSecret = parcelowEnv === "staging"
      ? Deno.env.get("MATRICULAUSA_PARCELOW_CLIENT_SECRET_STAGING")
      : Deno.env.get("MATRICULAUSA_PARCELOW_CLIENT_SECRET_PRODUCTION");

    if (!parcelowClientId || !parcelowClientSecret) {
      throw new Error("MatriculaUSA Parcelow credentials not configured");
    }

    const parcelowClient = new ParcelowClient(parcelowClientId, parcelowClientSecret, parcelowEnv);

    // Reference: parcelow-webhook detecta MATRICULAUSA-AF-APP- e usa slice(0,8) ILIKE
    const reference = applicationType === 'legacy'
      ? `MATRICULAUSA-AF-APP-${scholarship_application_id}`
      : `MATRICULAUSA-AF-V11-${scholarship_application_id}`;

    const orderData = {
      reference,
      partner_reference: user.id,
      client: {
        cpf: (cpf || "00000000000").replace(/\D/g, ""),
        name: payer_name || myProfile.full_name,
        email: payer_email || myProfile.email,
        phone: (payer_phone || myProfile.phone || "11999999999").replace(/\D/g, ""),
        cep: "01310900",
        address_street: "Avenida Paulista",
        address_number: 1000,
        address_neighborhood: "Bela Vista",
        address_city: "São Paulo",
        address_state: "SP",
      },
      items: [{
        reference: "APPLICATION_FEE",
        description: "MatriculaUSA Application Fee — Taxa de Matrícula",
        quantity: 1,
        amount: Math.round(applicationFee * 100),
      }],
      redirect: {
        success: `${returnBase}&af_return=success`,
        failed: `${returnBase}&af_return=failed`,
      },
      notify_url: `${migmaUrl}/functions/v1/parcelow-webhook`,
    };

    const parcelowRes = await parcelowClient.createOrder(orderData);
    const resData = parcelowRes.data || parcelowRes;
    const checkoutUrl = resData.url_checkout || resData.checkout_url || resData.url || resData.link;

    if (!checkoutUrl) {
      console.error("[create-application-fee-checkout] Parcelow sem URL:", JSON.stringify(resData));
      throw new Error("Parcelow did not return a checkout URL");
    }

    // Registrar em migma_parcelow_pending para fallback no webhook (idêntico ao Stripe usa application_fee_stripe_sessions)
    const parcelowOrderId = (resData.id || resData.order_id || "").toString();
    if (parcelowOrderId) {
      try {
        await supabase.from("migma_parcelow_pending").insert({
          migma_user_id: user.id,
          parcelow_order_id: parcelowOrderId,
          parcelow_checkout_url: checkoutUrl,
          amount: applicationFee,
          service_type: applicationType === 'legacy' ? 'application_fee_legacy' : 'application_fee_v11',
          service_request_id: scholarship_application_id, // application UUID armazenado aqui
          status: 'pending',
        });
        console.log(`[create-application-fee-checkout] migma_parcelow_pending registrado: parcelowId=${parcelowOrderId}`);
      } catch (pendingErr: any) {
        console.warn("[create-application-fee-checkout] migma_parcelow_pending insert falhou (não crítico):", pendingErr.message);
      }
    }

    console.log(`[create-application-fee-checkout] Parcelow order criado: ref=${reference}`);
    return jsonOk({ checkout_url: checkoutUrl });

  } catch (err: any) {
    console.error("[create-application-fee-checkout] Erro Fatal:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
