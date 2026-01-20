import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Clean and validate CPF/CNPJ
 * Removes formatting and ensures it's a valid length
 */
function cleanDocumentNumber(doc: string | null | undefined): string | null {
  if (!doc) return null;

  // Remove all non-numeric characters
  const cleaned = doc.replace(/\D/g, '');

  // CPF should have 11 digits, CNPJ should have 14 digits
  if (cleaned.length === 11 || cleaned.length === 14) {
    return cleaned;
  }

  // For development/testing: pad with zeros if less than 11 digits
  // This allows testing with incomplete CPFs
  if (cleaned.length > 0 && cleaned.length < 11) {
    const padded = cleaned.padEnd(11, '0');
    console.warn(`[Parcelow] CPF has ${cleaned.length} digits, padding to 11 digits for testing: ${padded.substring(0, 3)}***`);
    return padded;
  }

  console.warn(`[Parcelow] Invalid document length: ${cleaned.length} (expected 11 for CPF or 14 for CNPJ)`);
  return cleaned; // Return anyway, let API validate
}

// Parcelow API Client (simplified for Edge Function)
class ParcelowClient {
  private clientId: number | string; // Support both numeric and string IDs
  private clientSecret: string;
  private baseUrl: string;
  private accessToken: string | null = null;
  private tokenExpiresAt: number = 0;

  constructor(clientId: number | string, clientSecret: string, environment: 'staging' | 'production' = 'staging') {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.baseUrl = environment === 'staging'
      ? 'https://sandbox-2.parcelow.com.br'
      : 'https://app.parcelow.com'; // URL de produção (assumindo baseado na documentação)
  }

  private async getAccessToken(): Promise<string> {
    // Check if token is still valid (with 5 minute buffer)
    const now = Date.now();
    if (this.accessToken && this.tokenExpiresAt > now + 5 * 60 * 1000) {
      console.log(`[Parcelow OAuth] Using cached token (expires at: ${new Date(this.tokenExpiresAt).toISOString()})`);
      return this.accessToken;
    }

    // Request new token
    // According to Parcelow docs, both JSON and form-data are accepted
    // For string Client IDs (hex), try JSON first (as per Swagger docs)
    // For numeric Client IDs, try form-urlencoded (works for production)
    const oauthUrl = `${this.baseUrl}/oauth/token`;

    console.log(`[Parcelow OAuth] ========== OAUTH TOKEN REQUEST ==========`);
    console.log(`[Parcelow OAuth] Base URL: ${this.baseUrl}`);
    console.log(`[Parcelow OAuth] OAuth URL: ${oauthUrl}`);
    console.log(`[Parcelow OAuth] Client ID type: ${typeof this.clientId}`);
    console.log(`[Parcelow OAuth] Client ID value: ${this.clientId}`);
    console.log(`[Parcelow OAuth] Client ID string: ${this.clientId.toString()}`);
    console.log(`[Parcelow OAuth] Client ID length: ${this.clientId.toString().length} characters`);
    console.log(`[Parcelow OAuth] Client Secret length: ${this.clientSecret?.length || 0} characters`);
    console.log(`[Parcelow OAuth] Client Secret preview: ${this.clientSecret ? `${this.clientSecret.substring(0, 8)}...${this.clientSecret.substring(this.clientSecret.length - 4)}` : 'MISSING'}`);

    // Determine format: JSON for string IDs (staging hex), form-urlencoded for numeric IDs (production)
    const isStringId = typeof this.clientId === 'string' && this.clientId.length > 10;

    console.log(`[Parcelow OAuth] Client ID is string (hex): ${isStringId}`);

    // Try multiple formats for hex Client IDs:
    // 1. JSON with string Client ID (as per Swagger docs)
    // 2. JSON with Client ID converted to number (if hex can be parsed)
    // 3. Form-urlencoded (fallback)
    let requestBody: string;
    let requestHeaders: Record<string, string>;
    let useJsonFormat = false;

    if (isStringId) {
      // Try to parse hex string as number first
      const hexAsNumber = parseInt(this.clientId, 16);
      const canParseAsHex = !isNaN(hexAsNumber) && hexAsNumber > 0;

      console.log(`[Parcelow OAuth] Attempting to parse hex as number: ${hexAsNumber}`);
      console.log(`[Parcelow OAuth] Can parse as hex number: ${canParseAsHex}`);

      if (canParseAsHex) {
        // Try JSON with numeric Client ID (parsed from hex)
        console.log(`[Parcelow OAuth] Using format: JSON (with hex parsed as number)`);
        useJsonFormat = true;
        requestBody = JSON.stringify({
          client_id: hexAsNumber,
          client_secret: this.clientSecret,
          grant_type: 'client_credentials',
        });
        requestHeaders = {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        };
        console.log(`[Parcelow OAuth] JSON body (hex as number):`, JSON.stringify({
          client_id: hexAsNumber,
          client_secret: this.clientSecret.substring(0, 8) + '...',
          grant_type: 'client_credentials',
        }));
      } else {
        // Use JSON with string Client ID
        console.log(`[Parcelow OAuth] Using format: JSON (with string Client ID)`);
        useJsonFormat = true;
        requestBody = JSON.stringify({
          client_id: this.clientId,
          client_secret: this.clientSecret,
          grant_type: 'client_credentials',
        });
        requestHeaders = {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        };
        console.log(`[Parcelow OAuth] JSON body (string):`, JSON.stringify({
          client_id: this.clientId.toString().substring(0, 16) + '...',
          client_secret: this.clientSecret.substring(0, 8) + '...',
          grant_type: 'client_credentials',
        }));
      }
    } else {
      // Use JSON for standard numeric IDs (like '212' for staging v2)
      console.log(`[Parcelow OAuth] Using format: JSON (standard ID)`);
      useJsonFormat = true;

      // Ensure client_id is a number if possible
      let finalClientId: number | string = this.clientId;
      if (typeof this.clientId !== 'number') {
        const parsed = parseInt(this.clientId.toString());
        if (!isNaN(parsed)) {
          finalClientId = parsed;
        }
      }

      requestBody = JSON.stringify({
        client_id: finalClientId,
        client_secret: this.clientSecret,
        grant_type: 'client_credentials',
      });

      requestHeaders = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      };

      console.log(`[Parcelow OAuth] JSON body preview: client_id=${finalClientId}&grant_type=client_credentials`);
    }

    console.log(`[Parcelow OAuth] Request body length: ${requestBody.length} characters`);
    console.log(`[Parcelow OAuth] Request headers:`, JSON.stringify(requestHeaders, null, 2));

    // Log full request body (masked) for debugging
    if (useJsonFormat) {
      try {
        const bodyObj = JSON.parse(requestBody);
        console.log(`[Parcelow OAuth] Full JSON request (masked):`, {
          client_id: typeof bodyObj.client_id === 'number'
            ? bodyObj.client_id
            : `${bodyObj.client_id.substring(0, 8)}...${bodyObj.client_id.substring(bodyObj.client_id.length - 8)}`,
          client_secret: `${bodyObj.client_secret.substring(0, 8)}...${bodyObj.client_secret.substring(bodyObj.client_secret.length - 8)}`,
          grant_type: bodyObj.grant_type,
        });
      } catch (e) {
        console.log(`[Parcelow OAuth] Could not parse request body for logging`);
      }
    }

    console.log(`[Parcelow OAuth] Making POST request to: ${oauthUrl}`);

    const response = await fetch(oauthUrl, {
      method: 'POST',
      headers: requestHeaders,
      body: requestBody,
    });

    console.log(`[Parcelow OAuth] ========== OAUTH RESPONSE ==========`);
    console.log(`[Parcelow OAuth] Response status: ${response.status} ${response.statusText}`);
    console.log(`[Parcelow OAuth] Response OK: ${response.ok}`);

    const responseHeaders = Object.fromEntries(response.headers.entries());
    console.log(`[Parcelow OAuth] Response headers:`, JSON.stringify(responseHeaders, null, 2));
    console.log(`[Parcelow OAuth] Content-Type: ${responseHeaders['content-type'] || 'not set'}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Parcelow OAuth] ❌ Error response body length: ${errorText.length} characters`);
      console.error(`[Parcelow OAuth] ❌ Error response body (first 1000 chars):`, errorText.substring(0, 1000));

      let errorMessage: string;
      try {
        const errorJson = JSON.parse(errorText);
        console.error(`[Parcelow OAuth] ❌ Parsed error JSON:`, JSON.stringify(errorJson, null, 2));
        errorMessage = errorJson.message || errorJson.error?.message || `Parcelow API error: ${response.status}`;
      } catch (parseError) {
        console.error(`[Parcelow OAuth] ❌ Failed to parse error as JSON:`, parseError);
        // If it's HTML, extract meaningful info
        if (errorText.includes('Server Error')) {
          errorMessage = `Parcelow API error: ${response.status} - Server Error. Please check credentials and API status.`;
        } else if (errorText.includes('<!DOCTYPE') || errorText.includes('<html')) {
          errorMessage = `Parcelow API error: ${response.status} - Received HTML response instead of JSON. Check API endpoint and credentials.`;
        } else {
          errorMessage = `Parcelow API error: ${response.status} ${response.statusText}. Response: ${errorText.substring(0, 200)}`;
        }
      }
      console.error(`[Parcelow OAuth] ❌ Final error message: ${errorMessage}`);
      throw new Error(errorMessage);
    }

    const responseText = await response.text();
    console.log(`[Parcelow OAuth] Response body length: ${responseText.length} characters`);
    console.log(`[Parcelow OAuth] Response body preview: ${responseText.substring(0, 200)}...`);

    let tokenData: any;
    try {
      tokenData = JSON.parse(responseText);
      console.log(`[Parcelow OAuth] ✅ Successfully parsed token response`);
      console.log(`[Parcelow OAuth] Token response keys:`, Object.keys(tokenData));
      console.log(`[Parcelow OAuth] Token type: ${tokenData.token_type || 'not set'}`);
      console.log(`[Parcelow OAuth] Expires in: ${tokenData.expires_in || 'not set'} seconds`);
      console.log(`[Parcelow OAuth] Access token length: ${tokenData.access_token?.length || 0} characters`);
      console.log(`[Parcelow OAuth] Access token preview: ${tokenData.access_token ? `${tokenData.access_token.substring(0, 20)}...` : 'MISSING'}`);
    } catch (parseError) {
      console.error(`[Parcelow OAuth] ❌ Failed to parse success response as JSON:`, parseError);
      console.error(`[Parcelow OAuth] Response text:`, responseText);
      throw new Error(`Failed to parse token response: ${parseError}`);
    }

    this.accessToken = tokenData.access_token;
    this.tokenExpiresAt = Date.now() + (tokenData.expires_in - 300) * 1000;

    console.log(`[Parcelow OAuth] ✅ Token stored successfully`);
    console.log(`[Parcelow OAuth] Token expires at: ${new Date(this.tokenExpiresAt).toISOString()}`);
    console.log(`[Parcelow OAuth] =========================================`);

    return this.accessToken;
  }

  private async request<T>(method: string, endpoint: string, data?: any): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    console.log(`[Parcelow API] ${method} ${url}`);
    if (data) {
      console.log(`[Parcelow API] Request body:`, JSON.stringify(data, null, 2));
    }

    const token = await this.getAccessToken();

    const response = await fetch(url, {
      method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: data ? JSON.stringify(data) : undefined,
    });

    // Log only first 10 chars for security
    console.log(`[Parcelow API] Using token: ${token.substring(0, 10)}...`);

    console.log(`[Parcelow API] Response status: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Parcelow API] ❌ Error response:`, errorText);
      let errorMessage: string;
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.message || errorJson.error?.message || `Parcelow API error: ${response.status}`;
      } catch {
        errorMessage = `Parcelow API error: ${response.status} ${response.statusText}`;
      }
      throw new Error(errorMessage);
    }

    const contentType = response.headers.get('content-type');
    console.log(`[Parcelow API] Response Content-Type: ${contentType}`);

    if (contentType && contentType.includes('application/json') && response.status !== 204) {
      const jsonData = await response.json();
      console.log(`[Parcelow API] ✅ Success response:`, JSON.stringify(jsonData, null, 2));

      // Check if response has success: false (API validation error)
      if (jsonData.success === false) {
        const errorMessage = jsonData.message || 'Parcelow API returned an error';
        console.error(`[Parcelow API] ❌ API returned success: false - ${errorMessage}`);
        throw new Error(errorMessage);
      }

      return jsonData;
    } else {
      // Try to read as text for debugging
      const textData = await response.text();
      console.log(`[Parcelow API] ⚠️ Non-JSON response (${response.status}):`, textData.substring(0, 500));
      return {} as T;
    }
  }

  async createOrderUSD(orderData: any): Promise<any> {
    return await this.request('POST', '/api/orders', orderData);
  }

  async createOrderBRL(orderData: any): Promise<any> {
    return await this.request('POST', '/api/orders/brl', orderData);
  }

  async simulate(amountInCents: number): Promise<any> {
    const response = await this.request<{ data: any }>('GET', `/api/simulate?amount=${amountInCents}`);
    return response?.data || response;
  }

  async getOrder(orderId: string): Promise<any> {
    const response = await this.request<{ success?: boolean; data: any }>('GET', `/api/order/${orderId}`);

    // API might return just { data: ... } without success: true property
    if (response.data) {
      if (Array.isArray(response.data) && response.data.length > 0) {
        return response.data[0];
      } else if (typeof response.data === 'object') {
        return response.data;
      }
    }

    console.warn('[ParcelowClient] Invalid order response structure:', JSON.stringify(response));
    throw new Error('Order not found or invalid response format');
  }
}

// Environment detection function (copied from Stripe integration)
function detectEnvironment(req: Request): { isProduction: boolean; environment: 'production' | 'staging' } {
  const referer = req.headers.get('referer') || '';
  const origin = req.headers.get('origin') || '';
  const host = req.headers.get('host') || '';

  const isProductionDomain =
    referer.includes('migmainc.com') ||
    origin.includes('migmainc.com') ||
    host.includes('migmainc.com') ||
    (referer.includes('vercel.app') && !referer.includes('preview')) ||
    (origin.includes('vercel.app') && !origin.includes('preview'));

  // Default to staging unless on production domain
  const isProduction = isProductionDomain;

  return {
    isProduction,
    environment: isProduction ? 'production' : 'staging',
  };
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }



  try {
    // Detect environment dynamically
    const envInfo = detectEnvironment(req);
    const parcelowEnvironment = envInfo.environment;

    console.log("[Parcelow Checkout] 📋 Step 1: Detecting environment...");
    console.log("[Parcelow Checkout] Detected environment:", parcelowEnvironment);
    console.log("[Parcelow Checkout] Is Production Domain:", envInfo.isProduction);

    // Initialize Supabase client
    console.log("[Parcelow Checkout] 📋 Step 2: Initializing Supabase client...");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get site URL
    const siteUrl = Deno.env.get("SITE_URL") || req.headers.get("origin") || "http://localhost:5173";

    // Parse request body
    console.log("[Parcelow Checkout] 📋 Step 3: Parsing request body...");
    const body = await req.json();
    const { order_id, action = 'create', currency = "USD", amount_usd } = body;

    // Handle Simulation Action - NO DB REQUIRED
    if (action === 'simulate') {
      if (!amount_usd) {
        throw new Error("amount_usd is required for simulation");
      }

      const amountInCents = Math.round(parseFloat(amount_usd) * 100);
      console.log(`[Parcelow Checkout] 🔄 Action: Simulate for amount ${amountInCents}`);

      try {
        const parcelowClientId = parcelowEnvironment === 'staging'
          ? (Deno.env.get("PARCELOW_CLIENT_ID_STAGING") || Deno.env.get("PARCELOW_CLIENT_ID"))
          : (Deno.env.get("PARCELOW_CLIENT_ID_PRODUCTION") || Deno.env.get("PARCELOW_CLIENT_ID"));

        const parcelowClientSecret = parcelowEnvironment === 'staging'
          ? (Deno.env.get("PARCELOW_CLIENT_SECRET_STAGING") || Deno.env.get("PARCELOW_CLIENT_SECRET"))
          : (Deno.env.get("PARCELOW_CLIENT_SECRET_PRODUCTION") || Deno.env.get("PARCELOW_CLIENT_SECRET"));

        if (!parcelowClientId || !parcelowClientSecret) throw new Error("Missing Parcelow credentials");

        // Simple client init for simulation
        const clientIdToUse = (!isNaN(parseInt(parcelowClientId)) && parcelowClientId.trim() === parseInt(parcelowClientId).toString())
          ? parseInt(parcelowClientId) : parcelowClientId;

        const simpleClient = new ParcelowClient(clientIdToUse, parcelowClientSecret, parcelowEnvironment);

        const simulation = await simpleClient.simulate(amountInCents);
        console.log("[Parcelow Checkout] 🟢 Simulation result:", JSON.stringify(simulation));

        const responseData = {
          success: true,
          action: 'simulate',
          data: {
            total_usd: amountInCents,
            // API DOC: simulation.ted.amount is BRL string "5869.50"
            total_brl: simulation.ted?.amount ? Math.round(parseFloat(simulation.ted.amount) * 100) : 0,
            exchange_rate: simulation.dolar,
            rawRequest: simulation
          }
        };

        return new Response(JSON.stringify(responseData), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

      } catch (error: any) {
        console.error("[Parcelow Checkout] ❌ Simulation failed:", error.message);
        return new Response(
          JSON.stringify({ error: `Simulation failed: ${error.message}` }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // CREATE ACTION - DB REQUIRED
    if (!order_id) {
      throw new Error("order_id is required");
    }

    // Get order from database
    console.log("[Parcelow Checkout] 📋 Step 4: Fetching order from database...");
    const { data: order, error: orderError } = await supabase
      .from("visa_orders")
      .select("*")
      .eq("id", order_id)
      .single();

    if (orderError || !order) {
      throw new Error(`Order not found: ${orderError?.message}`);
    }

    // Initialize Parcelow client
    console.log("[Parcelow Checkout] 📋 Step 5: Initializing Parcelow client...");

    // Select credentials based on environment
    const parcelowClientId = parcelowEnvironment === 'staging'
      ? (Deno.env.get("PARCELOW_CLIENT_ID_STAGING") || Deno.env.get("PARCELOW_CLIENT_ID"))
      : (Deno.env.get("PARCELOW_CLIENT_ID_PRODUCTION") || Deno.env.get("PARCELOW_CLIENT_ID"));

    const parcelowClientSecret = parcelowEnvironment === 'staging'
      ? (Deno.env.get("PARCELOW_CLIENT_SECRET_STAGING") || Deno.env.get("PARCELOW_CLIENT_SECRET"))
      : (Deno.env.get("PARCELOW_CLIENT_SECRET_PRODUCTION") || Deno.env.get("PARCELOW_CLIENT_SECRET"));

    if (!parcelowClientId || !parcelowClientSecret) {
      throw new Error("Missing Parcelow credentials");
    }

    // Determine ID type
    let clientIdToUse: number | string;
    const clientIdNumber = parseInt(parcelowClientId, 10);
    const isNumericId = !isNaN(clientIdNumber) && clientIdNumber.toString() === parcelowClientId.trim();

    if (isNumericId) {
      clientIdToUse = clientIdNumber;
    } else {
      clientIdToUse = parcelowClientId;
    }

    const parcelowClient = new ParcelowClient(
      clientIdToUse,
      parcelowClientSecret,
      parcelowEnvironment
    );

    // Try to get client CPF from service_request -> client relationship
    let clientCpf: string | null = null;
    let clientBirthdate: string | null = null;
    let clientAddress: any = null;

    if (order.service_request_id) {
      try {
        const { data: serviceRequest, error: srError } = await supabase
          .from("service_requests")
          .select("client_id")
          .eq("id", order.service_request_id)
          .single();

        if (!srError && serviceRequest?.client_id) {
          const { data: client, error: clientError } = await supabase
            .from("clients")
            .select("document_number, date_of_birth, postal_code, address_line, city, state, phone")
            .eq("id", serviceRequest.client_id)
            .single();

          if (!clientError && client) {
            clientCpf = client.document_number || null;
            clientBirthdate = client.date_of_birth || null;

            clientAddress = {
              cep: client.postal_code,
              street: client.address_line,
              number: "N/A",
              neighborhood: "Centro",
              city: client.city,
              state: client.state,
              complement: "",
              phone: client.phone
            };
            console.log("[Parcelow Checkout] ✅ Found client data from clients table");
          }
        }
      } catch (error: any) {
        console.warn("[Parcelow Checkout] ⚠️ Could not fetch client data:", error.message);
      }
    }

    // Calculate amount early for simulation
    const amountInCents = Math.round(parseFloat(order.total_price_usd) * 100);

    // Handle Simulation Action
    if (action === 'simulate') {
      console.log(`[Parcelow Checkout] 🔄 Action: Simulate for amount ${amountInCents}`);
      try {
        const simulation = await parcelowClient.simulate(amountInCents);
        console.log("[Parcelow Checkout] 🟢 Simulation result:", JSON.stringify(simulation));

        // Format to match expected frontend structure (partially)
        const responseData = {
          success: true,
          action: 'simulate',
          data: {
            // Ensure these fields exist based on API doc: data.order (USD), data.ted.amount (BRL?) -> Wait doc says:
            // data.order: "1042.93" (USD value?)
            // data.dolar: "5.7333"
            // data.ted.amount: "5869.50" (BRL value for TED)
            // We want total_usd (input) and total_brl (output)
            total_usd: amountInCents, // Input amount
            total_brl: simulation.ted?.amount ? Math.round(parseFloat(simulation.ted.amount) * 100) : 0, // Convert string BRL to cents
            exchange_rate: simulation.dolar,
            rawRequest: simulation
          }
        };

        return new Response(JSON.stringify(responseData), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

      } catch (error: any) {
        console.error("[Parcelow Checkout] ❌ Simulation failed:", error.message);
        return new Response(
          JSON.stringify({ error: `Simulation failed: ${error.message}` }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Prepare client data
    // Prioritize payment-specific CPF (from Step 3) over profile document (which might be a passport)
    const rawCpf = order.payment_metadata?.cpf || clientCpf || order.client_cpf || '';
    const clientCpfToUse = cleanDocumentNumber(rawCpf);

    if (!clientCpfToUse || clientCpfToUse.length < 11) {
      return new Response(
        JSON.stringify({
          error: "CPF is required for Parcelow payment.",
          details: "CPF missing or invalid"
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const clientData = {
      cpf: clientCpfToUse,
      name: order.client_name,
      email: order.client_email,
      phone: order.client_whatsapp || clientAddress?.phone || '',
      birthdate: clientBirthdate || order.client_birthdate || undefined,
      cep: order.client_cep || clientAddress?.cep,
      address_street: order.client_address_street || clientAddress?.street,
      address_number: order.client_address_number || clientAddress?.number,
      address_neighborhood: order.client_address_neighborhood || clientAddress?.neighborhood,
      address_city: order.client_address_city || clientAddress?.city,
      address_state: order.client_address_state || clientAddress?.state,
      address_complement: order.client_address_complement || clientAddress?.complement,
    };

    // Prepare order items
    // amountInCents is already calculated above

    const items = [
      {
        reference: order.order_number,
        description: `Order ${order.order_number} - ${order.client_name}`,
        quantity: 1,
        amount: amountInCents,
      },
    ];

    // Prepare redirect URLs
    const redirectUrls = {
      success: `${siteUrl}/checkout/success?order_id=${order.id}`,
      failed: `${siteUrl}/checkout/cancel?order_id=${order.id}`,
    };

    // Create order
    console.log("[Parcelow Checkout] 📋 Step 6: Creating Parcelow order...");
    let parcelowResponse: any;

    try {
      if (currency === "BRL") {
        // BRL Logic (Placeholder)
        const amountBRL = parseFloat(order.total_price_usd) * 5;
        const amountBRLInCents = Math.round(amountBRL * 100);
        items[0].amount = amountBRLInCents;

        const notifyUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/parcelow-webhook`;
        parcelowResponse = await parcelowClient.createOrderBRL({
          reference: order.order_number,
          partner_reference: order.id,
          client: clientData,
          items,
          redirect: redirectUrls,
          notify_url: notifyUrl,
        });
      } else {
        try {
          const notifyUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/parcelow-webhook`;
          parcelowResponse = await parcelowClient.createOrderUSD({
            reference: order.order_number,
            partner_reference: order.id,
            client: clientData,
            items,
            redirect: redirectUrls,
            notify_url: notifyUrl,
          });
        } catch (err: any) {
          if (err.message && err.message.includes('Email do cliente existente')) {
            console.warn('[Parcelow Checkout] ⚠️ Customer email exists, retrying with aliased email...');
            const emailParts = clientData.email.split('@');
            const aliasedEmail = `${emailParts[0]}+${Date.now()}@${emailParts[1]}`;
            const clientDataRetry = { ...clientData, email: aliasedEmail };

            const notifyUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/parcelow-webhook`;
            parcelowResponse = await parcelowClient.createOrderUSD({
              reference: order.order_number,
              partner_reference: order.id,
              client: clientDataRetry,
              items,
              redirect: redirectUrls,
              notify_url: notifyUrl,
            });
          } else {
            throw err;
          }
        }
      }

      console.log("[Parcelow Checkout] ✅ Parcelow order created successfully");
      // Concise logging
      console.log("[Parcelow Checkout] Order ID:", parcelowResponse?.data?.order_id || parcelowResponse?.order_id);
      console.log("[Parcelow Checkout] 🟢 RAW Parcelow Response:", JSON.stringify(parcelowResponse, null, 2));

    } catch (error: any) {
      console.error("[Parcelow Checkout] ❌ Error creating Parcelow order:", error.message);
      throw new Error(`Failed to create Parcelow order: ${error.message}`);
    }

    // Get full order details
    console.log("[Parcelow Checkout] 📋 Step 7: Fetching Parcelow order details...");
    let parcelowOrder: any;

    const orderId = parcelowResponse?.data?.order_id || parcelowResponse?.order_id || (parcelowResponse?.data?.id);
    const checkoutUrl = parcelowResponse?.data?.url_checkout || parcelowResponse?.url_checkout || (parcelowResponse?.data?.url_checkout);

    if (!orderId || !checkoutUrl) {
      console.error("[Parcelow Checkout] Missing ID or URL in:", JSON.stringify(parcelowResponse, null, 2));
      throw new Error("Parcelow API response missing order_id or url_checkout");
    }

    try {
      parcelowOrder = await parcelowClient.getOrder(orderId.toString());
      console.log("[Parcelow Checkout] ✅ Parcelow order details fetched via API");
    } catch (error: any) {
      console.warn("[Parcelow Checkout] ⚠️ Could not fetch order details, using response data");
      // Use the response from creation as fallback.
      // Ensure we unwrap 'data' if it exists at the root, so we have the actual order object
      if (parcelowResponse?.data && typeof parcelowResponse.data === 'object' && !parcelowResponse.id) {
        parcelowOrder = parcelowResponse.data;
      } else {
        parcelowOrder = parcelowResponse;
      }
    }

    console.log("[Parcelow Checkout] 🟢 parcelowOrder for DB update:", JSON.stringify(parcelowOrder, null, 2));

    // Save Parcelow order details to database
    console.log("[Parcelow Checkout] 📋 Step 8: Saving Parcelow order details to database...");

    const updateData = {
      parcelow_order_id: orderId.toString(),
      parcelow_checkout_url: checkoutUrl,
      parcelow_status: parcelowOrder?.status_text || 'Open',
      parcelow_status_code: parcelowOrder?.status || 0,
    };

    const { error: updateOrderError } = await supabase
      .from("visa_orders")
      .update(updateData)
      .eq("id", order.id);

    if (updateOrderError) {
      console.error("[Parcelow Checkout] ❌ Error updating visa_orders:", updateOrderError.message);
    } else {
      console.log("[Parcelow Checkout] ✅ visa_orders updated successfully");
    }

    // Construct response properly ensuring all fields are present
    // The structure of parcelowOrder depends on whether it came from getOrder or createOrder response

    // Construct response properly ensuring all fields are present
    // The structure of parcelowOrder depends on whether it came from getOrder or createOrder response

    // Normalize parcelowOrder to be the inner data object if possible
    let normalizedOrder = parcelowOrder;

    if (parcelowOrder && parcelowOrder.data && typeof parcelowOrder.data === 'object' && !parcelowOrder.order_amount) {
      normalizedOrder = parcelowOrder.data;
    }

    // BRUTE FORCE FALLBACKS:
    // Try to find the values anywhere we can
    const finalOrderAmount = normalizedOrder?.order_amount
      || parcelowOrder?.data?.order_amount
      || parcelowOrder?.order_amount
      || amountInCents; // Calculated in Step 5

    const finalTotalUsd = normalizedOrder?.total_usd
      || parcelowOrder?.data?.total_usd
      || parcelowOrder?.total_usd
      || finalOrderAmount; // WCS: assume no fees if API fails to report total

    const finalTotalBrl = normalizedOrder?.total_brl
      || parcelowOrder?.data?.total_brl
      || parcelowOrder?.total_brl;

    const debugResponse = {
      success: true,
      order_id: orderId,
      checkout_url: checkoutUrl,
      status: normalizedOrder?.status_text || 'Open',
      total_usd: finalTotalUsd,
      total_brl: finalTotalBrl,
      order_amount: finalOrderAmount,
      _debug_fallback_used: !normalizedOrder?.total_usd // Flag if we had to use fallbacks
    };

    console.log("[Parcelow Checkout] 🟢 FINAL RESPONSE PAYLOAD:", JSON.stringify(debugResponse, null, 2));

    return new Response(
      JSON.stringify(debugResponse),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("[Parcelow Checkout] ========== ❌ ERROR OCCURRED ==========");
    console.error(`[Parcelow Checkout] ${error.message}`);

    return new Response(
      JSON.stringify({
        error: error.message || "Failed to create Parcelow checkout",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
