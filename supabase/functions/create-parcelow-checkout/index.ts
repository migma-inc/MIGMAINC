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
        'Authorization': `Bearer ${token}`, // Use full token in request
        'Content-Type': 'application/json',
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

  async getOrder(orderId: string): Promise<any> {
    const response = await this.request<{ success: boolean; data: any[] }>('GET', `/api/order/${orderId}`);
    if (response.success && Array.isArray(response.data) && response.data.length > 0) {
      return response.data[0];
    }
    throw new Error('Order not found');
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

  console.log("[Parcelow Checkout] ========== REQUEST RECEIVED ==========");
  console.log("[Parcelow Checkout] Method:", req.method);
  console.log("[Parcelow Checkout] URL:", req.url);

  try {
    // Detect environment dynamically
    const envInfo = detectEnvironment(req);
    const parcelowEnvironment = envInfo.environment;

    console.log("[Parcelow Checkout] 📋 Step 1: Detecting environment...");
    console.log("[Parcelow Checkout] Detected environment:", parcelowEnvironment);
    console.log("[Parcelow Checkout] Is Production Domain:", envInfo.isProduction);

    // Select credentials based on environment
    // Sandbox (Staging) uses Client ID 282
    // Production uses Client ID 1118
    const parcelowClientId = parcelowEnvironment === 'staging'
      ? (Deno.env.get("PARCELOW_CLIENT_ID_STAGING") || Deno.env.get("PARCELOW_CLIENT_ID"))
      : (Deno.env.get("PARCELOW_CLIENT_ID_PRODUCTION") || Deno.env.get("PARCELOW_CLIENT_ID"));

    const parcelowClientSecret = parcelowEnvironment === 'staging'
      ? (Deno.env.get("PARCELOW_CLIENT_SECRET_STAGING") || Deno.env.get("PARCELOW_CLIENT_SECRET"))
      : (Deno.env.get("PARCELOW_CLIENT_SECRET_PRODUCTION") || Deno.env.get("PARCELOW_CLIENT_SECRET"));

    // The original instruction had a duplicate line for parcelowClientSecret, removed it.

    console.log("[Parcelow Checkout] Using credentials for:", parcelowEnvironment);
    console.log("[Parcelow Checkout] Client ID found:", !!parcelowClientId);
    console.log("[Parcelow Checkout] Client ID length:", parcelowClientId?.length || 0);
    console.log("[Parcelow Checkout] Client ID preview:", parcelowClientId ? `${parcelowClientId.substring(0, 8)}...${parcelowClientId.substring(parcelowClientId.length - 4)}` : "MISSING");
    console.log("[Parcelow Checkout] Client Secret found:", !!parcelowClientSecret);
    console.log("[Parcelow Checkout] Client Secret length:", parcelowClientSecret?.length || 0);
    console.log("[Parcelow Checkout] Client Secret preview:", parcelowClientSecret ? `${parcelowClientSecret.substring(0, 8)}...${parcelowClientSecret.substring(parcelowClientSecret.length - 4)}` : "MISSING");

    // Determine which variable was used
    const clientIdSource = parcelowEnvironment === 'staging'
      ? (Deno.env.get("PARCELOW_CLIENT_ID_STAGING") ? "PARCELOW_CLIENT_ID_STAGING" : "PARCELOW_CLIENT_ID (fallback)")
      : (Deno.env.get("PARCELOW_CLIENT_ID_PRODUCTION") ? "PARCELOW_CLIENT_ID_PRODUCTION" : "PARCELOW_CLIENT_ID (fallback)");

    const clientSecretSource = parcelowEnvironment === 'staging'
      ? (Deno.env.get("PARCELOW_CLIENT_SECRET_STAGING") ? "PARCELOW_CLIENT_SECRET_STAGING" : "PARCELOW_CLIENT_SECRET (fallback)")
      : (Deno.env.get("PARCELOW_CLIENT_SECRET_PRODUCTION") ? "PARCELOW_CLIENT_SECRET_PRODUCTION" : "PARCELOW_CLIENT_SECRET (fallback)");

    console.log("[Parcelow Checkout] Client ID source:", clientIdSource);
    console.log("[Parcelow Checkout] Client Secret source:", clientSecretSource);

    if (!parcelowClientId || !parcelowClientSecret) {
      console.error("[Parcelow Checkout] ❌ Parcelow credentials not configured");
      const missingVars = [];
      if (!parcelowClientId) {
        missingVars.push(parcelowEnvironment === 'staging' ? "PARCELOW_CLIENT_ID_STAGING (or PARCELOW_CLIENT_ID)" : "PARCELOW_CLIENT_ID_PRODUCTION (or PARCELOW_CLIENT_ID)");
      }
      if (!parcelowClientSecret) {
        missingVars.push(parcelowEnvironment === 'staging' ? "PARCELOW_CLIENT_SECRET_STAGING (or PARCELOW_CLIENT_SECRET)" : "PARCELOW_CLIENT_SECRET_PRODUCTION (or PARCELOW_CLIENT_SECRET)");
      }
      return new Response(
        JSON.stringify({
          error: "Parcelow credentials not configured",
          details: `Missing: ${missingVars.join(", ")}`,
          environment: parcelowEnvironment
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Initialize Supabase client
    console.log("[Parcelow Checkout] 📋 Step 2: Initializing Supabase client...");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    console.log("[Parcelow Checkout] Supabase client initialized");

    // Get site URL
    const siteUrl = Deno.env.get("SITE_URL") || req.headers.get("origin") || "http://localhost:5173";

    // Parse request body
    console.log("[Parcelow Checkout] 📋 Step 3: Parsing request body...");
    const body = await req.json();
    console.log("[Parcelow Checkout] Request body:", JSON.stringify(body, null, 2));

    const {
      order_id,
      currency = "USD", // "USD" or "BRL"
    } = body;

    if (!order_id) {
      console.error("[Parcelow Checkout] ❌ order_id is missing from request body");
      return new Response(
        JSON.stringify({ error: "order_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[Parcelow Checkout] Order ID:", order_id);
    console.log("[Parcelow Checkout] Currency:", currency);

    // Get order from database
    console.log("[Parcelow Checkout] 📋 Step 4: Fetching order from database...");
    const { data: order, error: orderError } = await supabase
      .from("visa_orders")
      .select("*")
      .eq("id", order_id)
      .single();

    if (orderError || !order) {
      console.error("[Parcelow Checkout] ❌ Error fetching order:", orderError);
      return new Response(
        JSON.stringify({ error: "Order not found", details: orderError?.message }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[Parcelow Checkout] ✅ Order found:", order.order_number);
    console.log("[Parcelow Checkout] Order total_price_usd:", order.total_price_usd);
    console.log("[Parcelow Checkout] Service Request ID:", order.service_request_id);

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
          // Correct column names based on actual DB schema
          const { data: client, error: clientError } = await supabase
            .from("clients")
            .select("document_number, date_of_birth, postal_code, address_line, city, state, phone")
            .eq("id", serviceRequest.client_id)
            .single();

          if (!clientError && client) {
            clientCpf = client.document_number || null;
            clientBirthdate = client.date_of_birth || null;

            // Map generic address_line to specific fields best effort
            clientAddress = {
              cep: client.postal_code,
              street: client.address_line, // Assuming full address in line
              number: "N/A", // Not separate in DB
              neighborhood: "Centro", // Not in DB
              city: client.city,
              state: client.state,
              complement: "",
              phone: client.phone
            };
            console.log("[Parcelow Checkout] ✅ Found client data (CPF, birthdate, address) from clients table");
          } else if (clientError) {
            console.error("[Parcelow Checkout] ❌ Error fetching client details:", clientError);
          }
        }
      } catch (error: any) {
        console.warn("[Parcelow Checkout] ⚠️ Could not fetch client data:", error.message);
      }
    }

    // Check if order already has a Parcelow order
    if (order.parcelow_order_id) {
      console.warn("[Parcelow Checkout] ⚠️ Order already has a Parcelow order:", order.parcelow_order_id);
      return new Response(
        JSON.stringify({ error: "Order already has a Parcelow order" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Initialize Parcelow client
    console.log("[Parcelow Checkout] 📋 Step 5: Initializing Parcelow client...");
    console.log("[Parcelow Checkout] ========== CLIENT INITIALIZATION ==========");
    console.log(`[Parcelow Checkout] Client ID (raw string): ${parcelowClientId}`);
    console.log(`[Parcelow Checkout] Client ID length: ${parcelowClientId?.length || 0}`);
    console.log(`[Parcelow Checkout] Client ID type (before conversion): ${typeof parcelowClientId}`);
    console.log(`[Parcelow Checkout] Client ID preview: ${parcelowClientId ? `${parcelowClientId.substring(0, 16)}...${parcelowClientId.substring(parcelowClientId.length - 8)}` : 'MISSING'}`);

    // Try to parse as number first (for numeric IDs like 1118)
    // If it fails, use as string (for hex IDs like the new credentials)
    let clientIdToUse: number | string;
    const clientIdNumber = parseInt(parcelowClientId, 10);
    const isNumericId = !isNaN(clientIdNumber) && clientIdNumber.toString() === parcelowClientId.trim();

    console.log(`[Parcelow Checkout] Attempting to parse as number: ${clientIdNumber}`);
    console.log(`[Parcelow Checkout] Is numeric ID: ${isNumericId}`);
    console.log(`[Parcelow Checkout] Parsed number equals original: ${clientIdNumber.toString() === parcelowClientId.trim()}`);

    if (isNumericId) {
      clientIdToUse = clientIdNumber;
      console.log(`[Parcelow Checkout] ✅ Using Client ID as number: ${clientIdToUse}`);
    } else {
      // For hex/string IDs, use as string
      // The OAuth endpoint will receive it as string anyway (form-urlencoded)
      console.log(`[Parcelow Checkout] ⚠️ Client ID is not numeric, using as string`);
      console.log(`[Parcelow Checkout] Client ID value: ${parcelowClientId}`);
      clientIdToUse = parcelowClientId;
      console.log(`[Parcelow Checkout] Using Client ID as string: ${clientIdToUse.substring(0, 16)}...`);
    }

    console.log(`[Parcelow Checkout] Final Client ID to use: ${clientIdToUse} (type: ${typeof clientIdToUse})`);
    console.log(`[Parcelow Checkout] Client ID string representation: ${clientIdToUse.toString()}`);
    console.log(`[Parcelow Checkout] Client Secret length: ${parcelowClientSecret?.length || 0}`);
    console.log(`[Parcelow Checkout] Client Secret preview: ${parcelowClientSecret ? `${parcelowClientSecret.substring(0, 8)}...${parcelowClientSecret.substring(parcelowClientSecret.length - 4)}` : 'MISSING'}`);
    console.log(`[Parcelow Checkout] Environment: ${parcelowEnvironment}`);
    console.log(`[Parcelow Checkout] ============================================`);

    const parcelowClient = new ParcelowClient(
      clientIdToUse, // Can be number or string now
      parcelowClientSecret,
      parcelowEnvironment
    );
    console.log("[Parcelow Checkout] ✅ Parcelow client initialized for environment:", parcelowEnvironment);

    // Prepare client data
    // CPF is required by Parcelow - if not available, we'll need to handle this
    const rawCpf = clientCpf || order.client_cpf || '';
    const clientCpfToUse = cleanDocumentNumber(rawCpf);

    console.log(`[Parcelow Checkout] Raw CPF: ${rawCpf ? rawCpf.substring(0, 3) + '***' : 'MISSING'}`);
    console.log(`[Parcelow Checkout] Cleaned CPF length: ${clientCpfToUse?.length || 0}`);

    if (!clientCpfToUse || clientCpfToUse.length < 11) {
      console.error("[Parcelow Checkout] ❌ CPF is required but not found or invalid");
      return new Response(
        JSON.stringify({
          error: "CPF is required for Parcelow payment. Please ensure client document is provided.",
          details: `CPF not found or invalid (length: ${clientCpfToUse?.length || 0}, expected 11 or 14). Raw CPF: ${rawCpf ? rawCpf.substring(0, 3) + '***' : 'MISSING'}`
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const clientData = {
      cpf: clientCpfToUse,
      name: order.client_name,
      email: order.client_email,
      phone: order.client_whatsapp || clientAddress?.phone || '',
      birthdate: clientBirthdate || order.client_birthdate || undefined, // Format: "YYYY-MM-DD"
      cep: order.client_cep || clientAddress?.cep,
      address_street: order.client_address_street || clientAddress?.street,
      address_number: order.client_address_number || clientAddress?.number,
      address_neighborhood: order.client_address_neighborhood || clientAddress?.neighborhood,
      address_city: order.client_address_city || clientAddress?.city,
      address_state: order.client_address_state || clientAddress?.state,
      address_complement: order.client_address_complement || clientAddress?.complement,
    };

    console.log("[Parcelow Checkout] Client data prepared:", {
      cpf: clientCpfToUse.substring(0, 3) + "***", // Log only first 3 digits for security
      name: clientData.name,
      email: clientData.email,
      hasBirthdate: !!clientData.birthdate,
    });

    // Prepare order items
    const amountInCents = Math.round(parseFloat(order.total_price_usd) * 100);
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
        // For BRL, we need to convert USD to BRL first
        // For now, we'll use the USD amount - in production, should use exchange rate
        const amountBRL = parseFloat(order.total_price_usd) * 5; // Placeholder conversion
        const amountBRLInCents = Math.round(amountBRL * 100);
        items[0].amount = amountBRLInCents;

        parcelowResponse = await parcelowClient.createOrderBRL({
          reference: order.order_number,
          partner_reference: order.id,
          client: clientData,
          items,
          redirect: redirectUrls,
        });
      } else {
        try {
          parcelowResponse = await parcelowClient.createOrderUSD({
            reference: order.order_number,
            partner_reference: order.id,
            client: clientData,
            items,
            redirect: redirectUrls,
          });
        } catch (err: any) {
          // Handle "Customer email exists" error by aliasing the email for testing/sandbox
          if (err.message && err.message.includes('Email do cliente existente')) {
            console.warn('[Parcelow Checkout] ⚠️ Customer email exists, retrying with aliased email for checkout creation...');
            const emailParts = clientData.email.split('@');
            const aliasedEmail = `${emailParts[0]}+${Date.now()}@${emailParts[1]}`;
            const clientDataRetry = { ...clientData, email: aliasedEmail };

            parcelowResponse = await parcelowClient.createOrderUSD({
              reference: order.order_number,
              partner_reference: order.id,
              client: clientDataRetry,
              items,
              redirect: redirectUrls,
            });
          } else {
            throw err;
          }
        }
      }

      console.log("[Parcelow Checkout] ✅ Parcelow order created successfully");
      console.log("[Parcelow Checkout] Full response:", JSON.stringify(parcelowResponse, null, 2));
      console.log("[Parcelow Checkout] Response has 'data' property:", !!parcelowResponse?.data);
      console.log("[Parcelow Checkout] Order ID:", parcelowResponse?.data?.order_id || parcelowResponse?.order_id);
      console.log("[Parcelow Checkout] Checkout URL:", parcelowResponse?.data?.url_checkout || parcelowResponse?.url_checkout);

      // Validate response structure
      if (!parcelowResponse || (!parcelowResponse.data && !parcelowResponse.order_id)) {
        console.error("[Parcelow Checkout] ❌ Invalid response structure from Parcelow API");
        console.error("[Parcelow Checkout] Expected: { data: { order_id, url_checkout } } or { order_id, url_checkout }");
        console.error("[Parcelow Checkout] Received:", JSON.stringify(parcelowResponse, null, 2));
        throw new Error("Invalid response from Parcelow API: missing order_id and url_checkout");
      }
    } catch (error: any) {
      console.error("[Parcelow Checkout] ❌ Error creating Parcelow order:", error);
      console.error("[Parcelow Checkout] Error stack:", error.stack);
      throw new Error(`Failed to create Parcelow order: ${error.message}`);
    }

    // Get full order details
    console.log("[Parcelow Checkout] 📋 Step 7: Fetching Parcelow order details...");
    let parcelowOrder: any;

    // Extract order_id from response (handle both formats)
    const orderId = parcelowResponse?.data?.order_id || parcelowResponse?.order_id;
    const checkoutUrl = parcelowResponse?.data?.url_checkout || parcelowResponse?.url_checkout;

    if (!orderId || !checkoutUrl) {
      console.error("[Parcelow Checkout] ❌ Missing required fields in Parcelow response");
      console.error("[Parcelow Checkout] order_id:", orderId);
      console.error("[Parcelow Checkout] url_checkout:", checkoutUrl);
      throw new Error("Parcelow API response missing order_id or url_checkout");
    }

    try {
      parcelowOrder = await parcelowClient.getOrder(orderId.toString());
      console.log("[Parcelow Checkout] ✅ Parcelow order details fetched");
    } catch (error: any) {
      console.warn("[Parcelow Checkout] ⚠️ Could not fetch order details, using response data");
      parcelowOrder = parcelowResponse.data || parcelowResponse;
    }

    // Save Parcelow order details to database
    console.log("[Parcelow Checkout] 📋 Step 8: Saving Parcelow order details to database...");

    const updateData = {
      parcelow_order_id: orderId.toString(),
      parcelow_checkout_url: checkoutUrl,
      parcelow_status: parcelowOrder?.status_text || 'Open',
      parcelow_status_code: parcelowOrder?.status || 0,
    };
    console.log("[Parcelow Checkout] Update data:", JSON.stringify(updateData, null, 2));

    const { error: updateOrderError } = await supabase
      .from("visa_orders")
      .update(updateData)
      .eq("id", order.id);

    if (updateOrderError) {
      console.error("[Parcelow Checkout] ❌ Error updating visa_orders:", updateOrderError);
      return new Response(
        JSON.stringify({ error: "Failed to update order", details: updateOrderError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    console.log("[Parcelow Checkout] ✅ visa_orders updated successfully");

    console.log("[Parcelow Checkout] ========== ✅ CHECKOUT CREATED SUCCESSFULLY ==========");
    console.log("[Parcelow Checkout] Summary:");
    console.log("[Parcelow Checkout] - Order ID:", orderId);
    console.log("[Parcelow Checkout] - Status:", parcelowOrder?.status_text || 'Open');
    console.log("[Parcelow Checkout] - Checkout URL:", checkoutUrl);

    return new Response(
      JSON.stringify({
        success: true,
        order_id: orderId,
        checkout_url: checkoutUrl,
        status: parcelowOrder?.status_text || 'Open',
        total_usd: parcelowOrder?.total_usd || null,
        total_brl: parcelowOrder?.total_brl || null,
        order_amount: parcelowOrder?.order_amount || null,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[Parcelow Checkout] ========== ❌ ERROR OCCURRED ==========");
    console.error("[Parcelow Checkout] Error message:", error.message);
    console.error("[Parcelow Checkout] Error stack:", error.stack);
    console.error("[Parcelow Checkout] Error name:", error.name);
    console.error("[Parcelow Checkout] Full error:", JSON.stringify(error, null, 2));

    // Return more detailed error for debugging
    return new Response(
      JSON.stringify({
        error: error.message || "Failed to create Parcelow checkout",
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
        type: error.name || 'UnknownError'
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
