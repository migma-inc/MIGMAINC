import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import Stripe from "npm:stripe@^17.3.1";

/**
 * create-placement-fee-checkout
 * Cria sessão de pagamento (Parcelow ou Stripe) para a Placement Fee.
 * Chamado APENAS por alunos autenticados (JWT obrigatório).
 *
 * Input: {
 *   application_id: string
 *   payment_method: 'parcelow_card' | 'parcelow_pix' | 'parcelow_ted' | 'stripe'
 *   cpf?: string        (obrigatório para Parcelow)
 *   origin?: string     (URL base para redirect, ex: https://migmainc.com)
 * }
 */

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const STRIPE_FEE_PERCENT = 0.039;
const STRIPE_FEE_FIXED_CENTS = 30;

// ─── Parcelow Client (padrão do projeto) ────────────────────────────────────
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
  const supabase = createClient(migmaUrl, migmaKey); // service role para queries internas

  try {
    // ── 0. Validar JWT do aluno autenticado ───────────────────────────────────
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
    const { application_id, payment_method, cpf, origin, payer_name, payer_email, payer_phone } = body as {
      application_id?: string;
      payment_method?: string;
      cpf?: string;
      origin?: string;
      payer_name?: string;
      payer_email?: string;
      payer_phone?: string;
    };

    if (!application_id || !payment_method) {
      return jsonError("application_id and payment_method are required");
    }

    const validMethods = ["parcelow_card", "parcelow_pix", "parcelow_ted", "stripe"];
    if (!validMethods.includes(payment_method)) {
      return jsonError(`payment_method must be one of: ${validMethods.join(", ")}`);
    }

    // ── 2. Carregar application e verificar ownership ─────────────────────────
    // Primeiro busca o profile_id do aluno (user_profiles.id) via auth user_id
    const { data: myProfile } = await supabase
      .from("user_profiles")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!myProfile?.id) return jsonError("Student profile not found", 404);

    const { data: app, error: appErr } = await supabase
      .from("institution_applications")
      .select(`
        id, profile_id, status,
        institution_scholarships ( placement_fee_usd ),
        user_profiles!institution_applications_profile_id_fkey (
          user_id, email, full_name, phone
        )
      `)
      .eq("id", application_id)
      .maybeSingle();

    if (appErr || !app) return jsonError("Application not found", 404);

    // profile_id em institution_applications = user_profiles.id (não auth.users.id)
    if (app.profile_id !== myProfile.id) {
      return jsonError("Forbidden — application does not belong to authenticated user", 403);
    }

    if (!["payment_pending", "approved"].includes(app.status)) {
      return jsonError(`Application status '${app.status}' is not ready for payment`);
    }

    const profile = app.user_profiles as {
      user_id: string; email: string; full_name: string; phone?: string;
    } | null;
    const scholarship = app.institution_scholarships as { placement_fee_usd: number } | null;
    const placementFee = scholarship?.placement_fee_usd ?? 0;

    if (!profile?.email) return jsonError("Student profile incomplete", 500);

    const siteUrl = (origin || "https://migmainc.com").replace(/\/$/, "");
    const returnBase = `${siteUrl}/student/onboarding?step=placement_fee`;

    console.log(
      `[create-placement-fee-checkout] user=${user.id} app=${application_id}` +
      ` method=${payment_method} amount=${placementFee}`
    );

    // ── 3. Stripe ─────────────────────────────────────────────────────────────
    if (payment_method === "stripe") {
      const stripeKey = Deno.env.get("STRIPE_SECRET_KEY_TEST") || Deno.env.get("STRIPE_SECRET_KEY");
      if (!stripeKey) throw new Error("Stripe not configured");

      const stripe = new Stripe(stripeKey, { apiVersion: "2024-12-18.acacia" as any });

      const finalAmount = Math.round(((placementFee + 0.30) / (1 - STRIPE_FEE_PERCENT)) * 100);

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: [{
          price_data: {
            currency: "usd",
            product_data: {
              name: "Migma — Placement Fee (Garantia de Vaga)",
              description: "Pagamento único para garantir sua bolsa e vaga na universidade. Inclui taxa do cartão.",
            },
            unit_amount: finalAmount,
          },
          quantity: 1,
        }],
        mode: "payment",
        success_url: `${returnBase}&pf_return=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${returnBase}&pf_return=cancelled`,
        customer_email: profile.email,
        metadata: {
          fee_type: "placement_fee",
          application_id,
          user_id: user.id,
          full_name: profile.full_name || "",
          net_amount_usd: placementFee.toString(),
        },
      });

      // Gravar mapeamento para o stripe-visa-webhook rotear corretamente
      await supabase.from("placement_fee_stripe_sessions").insert({
        stripe_session_id: session.id,
        application_id,
        profile_id: myProfile.id,  // user_profiles.id
        amount_usd: placementFee,
      });

      console.log(`[create-placement-fee-checkout] Stripe session: ${session.id}`);
      return jsonOk({ checkout_url: session.url!, session_id: session.id });
    }

    // ── 4. Parcelow (card / pix / ted) ────────────────────────────────────────
    const isProduction = siteUrl.includes("migmainc.com");
    const parcelowEnv: "production" | "staging" = isProduction ? "production" : "staging";

    const parcelowClientId = parcelowEnv === "staging"
      ? (Deno.env.get("PARCELOW_CLIENT_ID_STAGING") || Deno.env.get("PARCELOW_CLIENT_ID"))
      : (Deno.env.get("PARCELOW_CLIENT_ID_PRODUCTION") || Deno.env.get("PARCELOW_CLIENT_ID"));
    const parcelowClientSecret = parcelowEnv === "staging"
      ? (Deno.env.get("PARCELOW_CLIENT_SECRET_STAGING") || Deno.env.get("PARCELOW_CLIENT_SECRET"))
      : (Deno.env.get("PARCELOW_CLIENT_SECRET_PRODUCTION") || Deno.env.get("PARCELOW_CLIENT_SECRET"));

    if (!parcelowClientId || !parcelowClientSecret) {
      throw new Error("Parcelow credentials not configured");
    }

    const parcelowClient = new ParcelowClient(parcelowClientId, parcelowClientSecret, parcelowEnv);

    // Referência: parcelow-webhook extrai appIdShort = ref.split("-APP-")[1]?.slice(0, 8)
    // e faz ILIKE '${appIdShort}%' em institution_applications.id
    const reference = `MIGMA-PF-APP-${application_id}`;

    const orderData = {
      reference,
      partner_reference: user.id,
      client: {
        cpf: (cpf || "00000000000").replace(/\D/g, ""),
        name: payer_name || profile.full_name,
        email: payer_email || profile.email,
        phone: (payer_phone || profile.phone || "11999999999").replace(/\D/g, ""),
        // Endereço genérico — Parcelow exige mas não usa para USD
        cep: "01310900",
        address_street: "Avenida Paulista",
        address_number: 1000,
        address_neighborhood: "Bela Vista",
        address_city: "São Paulo",
        address_state: "SP",
      },
      items: [{
        reference: "PLACEMENT_FEE",
        description: "Migma Placement Fee — Garantia de Vaga",
        quantity: 1,
        amount: Math.round(placementFee * 100), // centavos USD
      }],
      redirect: {
        success: `${returnBase}&pf_return=success`,
        failed: `${returnBase}&pf_return=failed`,
      },
      notify_url: `${migmaUrl}/functions/v1/parcelow-webhook`,
    };

    const parcelowRes = await parcelowClient.createOrder(orderData);
    const resData = parcelowRes.data || parcelowRes;
    const checkoutUrl = resData.url_checkout || resData.checkout_url || resData.url || resData.link;

    if (!checkoutUrl) {
      console.error("[create-placement-fee-checkout] Parcelow sem URL:", JSON.stringify(resData));
      throw new Error("Parcelow did not return a checkout URL");
    }

    console.log(`[create-placement-fee-checkout] Parcelow order criado: ref=${reference}`);
    return jsonOk({ checkout_url: checkoutUrl });

  } catch (err: any) {
    console.error("[create-placement-fee-checkout] Erro Fatal:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
