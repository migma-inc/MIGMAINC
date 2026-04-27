import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

/**
 * matriculausa-split-parcelow-checkout
 * Split payment (2 partes) via Parcelow usando as keys do MatriculaUSA.
 * Espelhado em migma-split-parcelow-checkout mas com MATRICULAUSA_PARCELOW_* secrets
 * e source = 'application_fee'.
 *
 * Input: {
 *   user_id, scholarship_application_id, email, full_name, phone?, cpf?,
 *   total_amount, part1_amount, part1_method, part2_amount, part2_method,
 *   origin?
 * }
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ─── Parcelow Client (MatriculaUSA keys) ─────────────────────────────────────
class ParcelowClient {
  private clientId: number | string;
  private clientSecret: string;
  private baseUrl: string;

  constructor(clientId: number | string, clientSecret: string, environment: "staging" | "production") {
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

function buildParcelowOrder(params: {
  reference: string;
  partnerReference: string;
  cpf: string;
  name: string;
  email: string;
  phone: string;
  amount: number;
  paymentMethod: string;
  redirectSuccess: string;
  redirectFailed: string;
  notifyUrl: string;
}) {
  const methodCodeMap: Record<string, number> = { parcelow_card: 1, parcelow_pix: 2, parcelow_ted: 4 };
  return {
    reference: params.reference,
    partner_reference: params.partnerReference,
    client: {
      cpf: params.cpf.replace(/\D/g, ""),
      name: params.name,
      email: params.email,
      phone: params.phone.replace(/\D/g, ""),
      cep: "01310900",
      address_street: "Avenida Paulista",
      address_number: 1000,
      address_neighborhood: "Bela Vista",
      address_city: "São Paulo",
      address_state: "SP",
    },
    items: [{
      reference: "APPLICATION_FEE_SPLIT",
      description: "MatriculaUSA Application Fee — Taxa de Matrícula (Split)",
      quantity: 1,
      amount: Math.round(params.amount * 100),
    }],
    payment_method: methodCodeMap[params.paymentMethod] ?? 1,
    redirect: { success: params.redirectSuccess, failed: params.redirectFailed },
    notify_url: params.notifyUrl,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const debug_logs: string[] = [];

  try {
    const body = await req.json();
    const {
      user_id,
      scholarship_application_id,
      email,
      full_name,
      phone,
      cpf,
      total_amount,
      part1_amount,
      part1_method,
      part2_amount,
      part2_method,
      origin,
    } = body;

    debug_logs.push(`Iniciando split MatriculaUSA para: ${email}`);

    if (!user_id || !email || !full_name || !scholarship_application_id) {
      return new Response(JSON.stringify({ error: "user_id, email, full_name e scholarship_application_id são obrigatórios", debug_logs }), {
        status: 400, headers: corsHeaders,
      });
    }
    if (!total_amount || !part1_amount || !part1_method || !part2_amount || !part2_method) {
      return new Response(JSON.stringify({ error: "Configuração de split incompleta", debug_logs }), {
        status: 400, headers: corsHeaders,
      });
    }

    const validMethods = ["parcelow_card", "parcelow_pix", "parcelow_ted"];
    if (!validMethods.includes(part1_method) || !validMethods.includes(part2_method)) {
      return new Response(JSON.stringify({ error: `Métodos inválidos. Usar: ${validMethods.join(", ")}`, debug_logs }), {
        status: 400, headers: corsHeaders,
      });
    }

    const p1 = parseFloat(part1_amount);
    const p2 = parseFloat(part2_amount);
    const total = parseFloat(total_amount);
    if (Math.abs(p1 + p2 - total) > 0.01) {
      return new Response(JSON.stringify({ error: `Soma das partes (${p1 + p2}) != total (${total})`, debug_logs }), {
        status: 400, headers: corsHeaders,
      });
    }

    const originUrl = (origin || "https://migmainc.com").replace(/\/$/, "");
    const isProduction = originUrl.includes("migmainc.com");
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

    // ── 1. Criar registro split_payments ──────────────────────────────────────
    const { data: splitRecord, error: splitErr } = await supabase
      .from("split_payments")
      .insert({
        order_id: null,
        application_id: scholarship_application_id,
        migma_user_id: user_id,
        source: "application_fee",
        migma_service_type: "application_fee",
        total_amount_usd: total,
        split_count: 2,
        part1_amount_usd: p1,
        part1_payment_method: part1_method.replace("parcelow_", ""),
        part2_amount_usd: p2,
        part2_payment_method: part2_method.replace("parcelow_", ""),
        overall_status: "pending",
      })
      .select("id")
      .single();

    if (splitErr || !splitRecord) {
      throw new Error(`Erro ao criar split_payments: ${splitErr?.message}`);
    }
    const splitPaymentId = splitRecord.id;
    debug_logs.push(`✅ split_payments criado: ${splitPaymentId}`);

    const p1SuccessUrl = `${originUrl}/checkout/split-payment/redirect?split_payment_id=${splitPaymentId}&split_return=1&part=1`;
    const p2SuccessUrl = `${originUrl}/checkout/split-payment/redirect?split_payment_id=${splitPaymentId}&split_return=1&part=2`;
    const failedUrl = `${originUrl}/student/onboarding?step=payment&af_return=failed`;
    const notifyUrl = `${supabaseUrl}/functions/v1/parcelow-webhook`;

    const appIdShort = scholarship_application_id.slice(0, 8);

    // ── 2. Criar P1 ───────────────────────────────────────────────────────────
    debug_logs.push("Criando P1 via Parcelow MatriculaUSA...");
    const p1Order = buildParcelowOrder({
      reference: `MATRICULAUSA-AF-APP-${scholarship_application_id}-P1`,
      partnerReference: `${user_id}-AF-P1`,
      cpf: cpf || "00000000000",
      name: full_name,
      email,
      phone: phone || "11999999999",
      amount: p1,
      paymentMethod: part1_method,
      redirectSuccess: p1SuccessUrl,
      redirectFailed: failedUrl,
      notifyUrl,
    });
    const p1Res = await parcelowClient.createOrder(p1Order);
    const p1Data = p1Res.data || p1Res;
    const p1CheckoutUrl = p1Data.url_checkout || p1Data.checkout_url || p1Data.url || p1Data.link;
    const p1ParcelowId = (p1Data.id || p1Data.order_id || "").toString();

    if (!p1CheckoutUrl || !p1ParcelowId) {
      await supabase.from("split_payments").delete().eq("id", splitPaymentId);
      throw new Error("Parte 1 não retornou URL de pagamento");
    }

    // ── 3. Criar P2 ───────────────────────────────────────────────────────────
    debug_logs.push("Criando P2 via Parcelow MatriculaUSA...");
    const p2Order = buildParcelowOrder({
      reference: `MATRICULAUSA-AF-APP-${scholarship_application_id}-P2`,
      partnerReference: `${user_id}-AF-P2`,
      cpf: cpf || "00000000000",
      name: full_name,
      email,
      phone: phone || "11999999999",
      amount: p2,
      paymentMethod: part2_method,
      redirectSuccess: p2SuccessUrl,
      redirectFailed: failedUrl,
      notifyUrl,
    });
    const p2Res = await parcelowClient.createOrder(p2Order);
    const p2Data = p2Res.data || p2Res;
    const p2CheckoutUrl = p2Data.url_checkout || p2Data.checkout_url || p2Data.url || p2Data.link;
    const p2ParcelowId = (p2Data.id || p2Data.order_id || "").toString();

    if (!p2CheckoutUrl || !p2ParcelowId) {
      await supabase.from("split_payments").delete().eq("id", splitPaymentId);
      throw new Error("Parte 2 não retornou URL de pagamento");
    }

    // ── 4. Persistir IDs no split_payments ────────────────────────────────────
    await supabase
      .from("split_payments")
      .update({
        part1_parcelow_order_id: p1ParcelowId,
        part1_parcelow_checkout_url: p1CheckoutUrl,
        part2_parcelow_order_id: p2ParcelowId,
        part2_parcelow_checkout_url: p2CheckoutUrl,
        updated_at: new Date().toISOString(),
      })
      .eq("id", splitPaymentId);

    debug_logs.push("✅ Split MatriculaUSA criado com sucesso");

    return new Response(JSON.stringify({
      success: true,
      split_payment_id: splitPaymentId,
      part1_checkout_url: p1CheckoutUrl,
      part2_checkout_url: p2CheckoutUrl,
      debug_logs,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err: any) {
    console.error("[matriculausa-split-parcelow-checkout] Erro Fatal:", err.message);
    return new Response(JSON.stringify({ success: false, error: err.message, debug_logs }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
