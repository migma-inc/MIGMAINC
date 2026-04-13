import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// --- CLASSE TRANSPLANTADA DA SUA REFERÊNCIA ---
class ParcelowClient {
  private clientId: number | string;
  private clientSecret: string;
  private baseUrl: string;
  private accessToken: string | null = null;

  constructor(clientId: number | string, clientSecret: string, environment: 'staging' | 'production' = 'staging') {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.baseUrl = environment === 'staging' ? 'https://sandbox-2.parcelow.com.br' : 'https://app.parcelow.com';
  }

  private async getAccessToken(): Promise<string> {
    const oauthUrl = `${this.baseUrl}/oauth/token`;
    const isStringId = typeof this.clientId === 'string' && this.clientId.length > 10;
    
    let requestBody: string;
    let requestHeaders = { 'Content-Type': 'application/json', 'Accept': 'application/json' };

    if (isStringId) {
      const hexAsNumber = parseInt(this.clientId as string, 16);
      const canParseAsHex = !isNaN(hexAsNumber) && hexAsNumber > 0;
      requestBody = JSON.stringify({
        client_id: canParseAsHex ? hexAsNumber : this.clientId,
        client_secret: this.clientSecret,
        grant_type: 'client_credentials',
      });
    } else {
      let finalClientId: number | string = this.clientId;
      if (typeof this.clientId !== 'number') {
        const parsed = parseInt(this.clientId.toString());
        if (!isNaN(parsed)) finalClientId = parsed;
      }
      requestBody = JSON.stringify({
        client_id: finalClientId,
        client_secret: this.clientSecret,
        grant_type: 'client_credentials',
      });
    }

    const response = await fetch(oauthUrl, { method: 'POST', headers: requestHeaders, body: requestBody });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Parcelow Auth Error (${response.status}): ${errorText}`);
    }
    const tokenData = await response.json();
    return tokenData.access_token;
  }

  async createOrderUSD(orderData: any): Promise<any> {
    const token = await this.getAccessToken();
    const response = await fetch(`${this.baseUrl}/api/orders`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(orderData),
    });
    if (!response.ok) throw new Error(await response.text());
    return await response.json();
  }
}

// --- DETECÇÃO DE AMBIENTE REPLICADA ---
function detectEnvironment(req: Request) {
  const referer = req.headers.get('referer') || '', origin = req.headers.get('origin') || '', host = req.headers.get('host') || '';
  const isProd = referer.includes('migmainc.com') || origin.includes('migmainc.com') || host.includes('migmainc.com');
  return { isProduction: isProd, environment: isProd ? 'production' : 'staging' as const };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Iniciar Supabase
  const migmaUrl = Deno.env.get("SUPABASE_URL")!;
  const migmaKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(migmaUrl, migmaKey);

  try {
    const body = await req.json();
    const envInfo = detectEnvironment(req);
    const parcelowEnv = body.parcelow_environment || envInfo.environment;
    
    const parcelowClientId = parcelowEnv === 'staging'
      ? (Deno.env.get("PARCELOW_CLIENT_ID_STAGING") || Deno.env.get("PARCELOW_CLIENT_ID"))
      : (Deno.env.get("PARCELOW_CLIENT_ID_PRODUCTION") || Deno.env.get("PARCELOW_CLIENT_ID"));

    const parcelowClientSecret = parcelowEnv === 'staging'
      ? (Deno.env.get("PARCELOW_CLIENT_SECRET_STAGING") || Deno.env.get("PARCELOW_CLIENT_SECRET"))
      : (Deno.env.get("PARCELOW_CLIENT_SECRET_PRODUCTION") || Deno.env.get("PARCELOW_CLIENT_SECRET"));

    if (!parcelowClientId || !parcelowClientSecret) throw new Error("Chaves Parcelow ausentes nos secrets.");

    const client = new ParcelowClient(parcelowClientId, parcelowClientSecret, parcelowEnv);
    const finalRef = body.order_id || `MIG-${Date.now()}`;
    const originUrl = body.site_url || req.headers.get("origin") || 'https://migmainc.com';

    // Determinar slug para redirecionamento
    const serviceSlug = (body.service_type || 'transfer').replace('-selection-process', '');
    const successUrl = `${originUrl}/student/checkout/${serviceSlug}?success=true&order_id=${finalRef}`;
    const failedUrl = `${originUrl}/student/checkout/${serviceSlug}?failed=true&order_id=${finalRef}`;

    console.log(`[migma-parcelow-checkout] Criando checkout [${serviceSlug}] para ${body.email} valor=${body.amount}`);

    const orderData = {
      reference: finalRef,
      partner_reference: body.user_id || "migma_guest",
      client: {
        cpf: body.cpf?.replace(/\D/g, ''),
        name: body.full_name,
        email: body.email,
        phone: body.phone?.replace(/\D/g, '') || "11999999999",
        cep: "01310900", address_street: "Avenida Paulista", address_number: 1000, address_neighborhood: "Bela Vista", address_city: "São Paulo", address_state: "SP"
      },
      items: [{ reference: "MIGMA_FEE", description: "Migma Selection Fee", quantity: 1, amount: Math.round(parseFloat(body.amount) * 100) }],
      redirect: {
        success: successUrl,
        failed: failedUrl
      },
      notify_url: `${Deno.env.get("SUPABASE_URL")}/functions/v1/parcelow-webhook`
    };

    const response = await client.createOrderUSD(orderData);
    const data = response.data || response;
    const checkoutUrl = data.url_checkout || data.checkout_url || data.url || data.link;
    const parcelowOrderId = data.id || data.order_id;

    if (!parcelowOrderId) {
        console.error("[migma-parcelow-checkout] Resposta da Parcelow sem ID:", JSON.stringify(data));
    } else {
        console.log(`[migma-parcelow-checkout] ✅ Gravando pendente: ParcelowID=${parcelowOrderId} UserID=${body.user_id}`);
        
        const { error: insertErr } = await supabase
            .from("migma_parcelow_pending")
            .insert({
                migma_user_id: body.user_id,
                parcelow_order_id: parcelowOrderId.toString(),
                parcelow_checkout_url: checkoutUrl,
                amount: parseFloat(body.amount),
                service_type: body.service_type || 'transfer',
                status: 'pending',
                updated_at: new Date().toISOString()
            });
            
        if (insertErr) {
            console.error("[migma-parcelow-checkout] ❌ Erro ao gravar migma_parcelow_pending:", insertErr);
        }
    }

    return new Response(JSON.stringify({ ...data, checkout_url: checkoutUrl, parcelow_id: parcelowOrderId }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err: any) {
    console.error("[migma-parcelow-checkout] Erro Fatal:", err.message);
    return new Response(JSON.stringify({ error: err.message }), { status: 200, headers: corsHeaders });
  }
});
