import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Parcelow API Client (simplified for Edge Function)
class ParcelowClient {
  private clientId: number;
  private clientSecret: string;
  private baseUrl: string;
  private accessToken: string | null = null;
  private tokenExpiresAt: number = 0;

  constructor(clientId: number, clientSecret: string, environment: 'staging' | 'production' = 'staging') {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.baseUrl = environment === 'staging'
      ? 'https://staging.parcelow.com'
      : 'https://app.parcelow.com'; // URL de produção (assumindo baseado na documentação)
  }

  private async getAccessToken(): Promise<string> {
    // Check if token is still valid (with 5 minute buffer)
    const now = Date.now();
    if (this.accessToken && this.tokenExpiresAt > now + 5 * 60 * 1000) {
      return this.accessToken;
    }

    // Request new token
    const response = await fetch(`${this.baseUrl}/oauth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        grant_type: 'client_credentials',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage: string;
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.message || errorJson.error?.message || `Parcelow API error: ${response.status}`;
      } catch {
        errorMessage = `Parcelow API error: ${response.status} ${response.statusText}`;
      }
      throw new Error(errorMessage);
    }

    const tokenData = await response.json();
    this.accessToken = tokenData.access_token;
    this.tokenExpiresAt = Date.now() + (tokenData.expires_in - 300) * 1000;

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
        'Authorization': `Bearer ${token.substring(0, 10)}...`, // Log only first 10 chars for security
        'Content-Type': 'application/json',
      },
      body: data ? JSON.stringify(data) : undefined,
    });

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
    if (contentType && contentType.includes('application/json') && response.status !== 204) {
      const jsonData = await response.json();
      console.log(`[Parcelow API] ✅ Success response:`, JSON.stringify(jsonData, null, 2));
      return jsonData;
    }
    return {} as T;
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

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  console.log("[Parcelow Checkout] ========== REQUEST RECEIVED ==========");
  console.log("[Parcelow Checkout] Method:", req.method);
  console.log("[Parcelow Checkout] URL:", req.url);

  try {
    // Get Parcelow configuration from environment
    console.log("[Parcelow Checkout] 📋 Step 1: Checking environment variables...");
    const parcelowClientId = Deno.env.get("PARCELOW_CLIENT_ID");
    const parcelowClientSecret = Deno.env.get("PARCELOW_CLIENT_SECRET");
    const parcelowEnvironment = (Deno.env.get("PARCELOW_ENVIRONMENT") || "staging") as 'staging' | 'production';

    console.log("[Parcelow Checkout] Environment:", parcelowEnvironment);
    console.log("[Parcelow Checkout] Has Client ID:", !!parcelowClientId);
    console.log("[Parcelow Checkout] Has Client Secret:", !!parcelowClientSecret);

    if (!parcelowClientId || !parcelowClientSecret) {
      console.error("[Parcelow Checkout] ❌ PARCELOW_CLIENT_ID or PARCELOW_CLIENT_SECRET not configured");
      return new Response(
        JSON.stringify({ error: "Parcelow credentials not configured" }),
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
    const parcelowClient = new ParcelowClient(
      parseInt(parcelowClientId),
      parcelowClientSecret,
      parcelowEnvironment
    );
    console.log("[Parcelow Checkout] Parcelow client initialized for environment:", parcelowEnvironment);

    // Prepare client data
    const clientData = {
      cpf: order.client_cpf || '', // Required - might need to be collected in frontend
      name: order.client_name,
      email: order.client_email,
      phone: order.client_whatsapp || '',
      birthdate: order.client_birthdate, // Format: "YYYY-MM-DD" - might need to be collected
      cep: order.client_cep,
      address_street: order.client_address_street,
      address_number: order.client_address_number,
      address_neighborhood: order.client_address_neighborhood,
      address_city: order.client_address_city,
      address_state: order.client_address_state,
      address_complement: order.client_address_complement,
    };

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
        parcelowResponse = await parcelowClient.createOrderUSD({
          reference: order.order_number,
          partner_reference: order.id,
          client: clientData,
          items,
          redirect: redirectUrls,
        });
      }

      console.log("[Parcelow Checkout] ✅ Parcelow order created successfully");
      console.log("[Parcelow Checkout] Order ID:", parcelowResponse.data?.order_id);
      console.log("[Parcelow Checkout] Checkout URL:", parcelowResponse.data?.url_checkout);
    } catch (error: any) {
      console.error("[Parcelow Checkout] ❌ Error creating Parcelow order:", error);
      console.error("[Parcelow Checkout] Error stack:", error.stack);
      throw new Error(`Failed to create Parcelow order: ${error.message}`);
    }

    // Get full order details
    console.log("[Parcelow Checkout] 📋 Step 7: Fetching Parcelow order details...");
    let parcelowOrder: any;
    try {
      parcelowOrder = await parcelowClient.getOrder(parcelowResponse.data.order_id.toString());
      console.log("[Parcelow Checkout] ✅ Parcelow order details fetched");
    } catch (error: any) {
      console.warn("[Parcelow Checkout] ⚠️ Could not fetch order details, using response data");
      parcelowOrder = parcelowResponse.data;
    }

    // Save Parcelow order details to database
    console.log("[Parcelow Checkout] 📋 Step 8: Saving Parcelow order details to database...");
    
    const updateData = {
      parcelow_order_id: parcelowResponse.data.order_id.toString(),
      parcelow_checkout_url: parcelowResponse.data.url_checkout,
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
    console.log("[Parcelow Checkout] - Order ID:", parcelowResponse.data.order_id);
    console.log("[Parcelow Checkout] - Status:", parcelowOrder?.status_text || 'Open');
    console.log("[Parcelow Checkout] - Checkout URL:", parcelowResponse.data.url_checkout);

    return new Response(
      JSON.stringify({
        success: true,
        order_id: parcelowResponse.data.order_id,
        checkout_url: parcelowResponse.data.url_checkout,
        status: parcelowOrder?.status_text || 'Open',
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[Parcelow Checkout] ========== ❌ ERROR OCCURRED ==========");
    console.error("[Parcelow Checkout] Error message:", error.message);
    console.error("[Parcelow Checkout] Error stack:", error.stack);
    
    return new Response(
      JSON.stringify({ 
        error: error.message || "Failed to create Parcelow checkout",
        details: error.stack 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
