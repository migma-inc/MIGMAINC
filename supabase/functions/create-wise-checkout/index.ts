import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Wise API Client (simplified for Edge Function)
class WiseClient {
  private personalToken: string;
  private baseUrl: string;

  constructor(personalToken: string, environment: 'sandbox' | 'production' = 'sandbox') {
    this.personalToken = personalToken;
    this.baseUrl = environment === 'sandbox'
      ? 'https://api.wise-sandbox.com'
      : 'https://api.wise.com';
  }

  private async request<T>(method: string, endpoint: string, data?: any): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    console.log(`[Wise API] ${method} ${url}`);
    if (data) {
      console.log(`[Wise API] Request body:`, JSON.stringify(data, null, 2));
    }

    const response = await fetch(url, {
      method,
      headers: {
        'Authorization': `Bearer ${this.personalToken}`,
        'Content-Type': 'application/json',
      },
      body: data ? JSON.stringify(data) : undefined,
    });

    console.log(`[Wise API] Response status: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Wise API] ❌ Error response:`, errorText);
      let errorMessage: string;
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.message || errorJson.error?.message || `Wise API error: ${response.status}`;
        console.error(`[Wise API] Parsed error message:`, errorMessage);
      } catch {
        errorMessage = `Wise API error: ${response.status} ${response.statusText}`;
      }
      throw new Error(errorMessage);
    }

    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json') && response.status !== 204) {
      const jsonData = await response.json();
      // Log apenas resumo para não poluir logs (comentar linha abaixo se precisar ver resposta completa)
      // console.log(`[Wise API] ✅ Success response:`, JSON.stringify(jsonData, null, 2));
      return jsonData;
    }
    return {} as T;
  }

  async getProfileId(): Promise<string> {
    const profiles = await this.request<Array<{ id: number }>>('GET', '/v1/profiles');
    if (profiles && profiles.length > 0) {
      return profiles[0].id.toString();
    }
    throw new Error('No profile found in Wise account');
  }

  async createQuote(profileId: string, params: {
    sourceCurrency: string;
    targetCurrency: string;
    sourceAmount?: number;
    targetAmount?: number;
  }): Promise<any> {
    return await this.request('POST', `/v3/profiles/${profileId}/quotes`, params);
  }

  async createRecipient(profileId: string, params: any): Promise<any> {
    return await this.request('POST', '/v1/accounts', {
      profile: profileId,
      ...params,
    });
  }

  async createTransfer(profileId: string, params: {
    targetAccount: string;
    quoteUuid: string;
    customerTransactionId: string;
    reference?: string;
  }): Promise<any> {
    return await this.request('POST', '/v1/transfers', params);
  }

  async getTransferStatus(transferId: string): Promise<any> {
    return await this.request('GET', `/v1/transfers/${transferId}`);
  }

  async getTransferPaymentUrl(transferId: string): Promise<string | null> {
    // Try to get payment URL from transfer details
    // This may not be available with Personal Token, but worth trying
    try {
      const transfer = await this.getTransferStatus(transferId);
      // Check various possible fields for payment URL
      if (transfer.paymentLink) return transfer.paymentLink;
      if (transfer.payment_url) return transfer.payment_url;
      if (transfer.payinUrl) return transfer.payinUrl;
      if (transfer.payin_url) return transfer.payin_url;
      if (transfer.paymentUrl) return transfer.paymentUrl;
      return null;
    } catch (error) {
      console.error(`[Wise API] Error getting transfer payment URL:`, error);
      return null;
    }
  }
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

    console.log("[Wise Checkout] ========== REQUEST RECEIVED ==========");

  try {
    // UUID pattern regex (reusable throughout the function)
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    
    // Get Wise configuration from environment
    const wisePersonalToken = Deno.env.get("WISE_PERSONAL_TOKEN");
    const wiseEnvironment = (Deno.env.get("WISE_ENVIRONMENT") || "sandbox") as 'sandbox' | 'production';
    const wiseProfileId = Deno.env.get("WISE_PROFILE_ID"); // Optional, will fetch if not provided

    console.log("[Wise Checkout] 🌍 Environment:", wiseEnvironment);
    
    if (!wisePersonalToken) {
      console.error("[Wise Checkout] ❌ WISE_PERSONAL_TOKEN not configured");
      return new Response(
        JSON.stringify({ error: "WISE_PERSONAL_TOKEN not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get Migma bank details from environment
    const migmaBankDetails = {
      accountHolderName: Deno.env.get("WISE_MIGMA_ACCOUNT_HOLDER_NAME") || "Migma Inc",
      currency: Deno.env.get("WISE_MIGMA_CURRENCY") || "USD",
      type: (Deno.env.get("WISE_MIGMA_ACCOUNT_TYPE") || "aba") as 'iban' | 'sort_code' | 'aba' | 'swift',
      legalType: (Deno.env.get("WISE_MIGMA_LEGAL_TYPE") || "BUSINESS") as 'PRIVATE' | 'BUSINESS',
      details: {
        aba: Deno.env.get("WISE_MIGMA_ABA"),
        accountNumber: Deno.env.get("WISE_MIGMA_ACCOUNT_NUMBER"),
        swift: Deno.env.get("WISE_MIGMA_SWIFT"),
        iban: Deno.env.get("WISE_MIGMA_IBAN"),
        sortCode: Deno.env.get("WISE_MIGMA_SORT_CODE"),
        bankName: Deno.env.get("WISE_MIGMA_BANK_NAME"),
        bankAddress: Deno.env.get("WISE_MIGMA_BANK_ADDRESS"),
        city: Deno.env.get("WISE_MIGMA_CITY"),
        country: Deno.env.get("WISE_MIGMA_COUNTRY") || "US",
      },
    };


    // Validate required bank details based on account type
    if (migmaBankDetails.type === 'aba') {
      if (!migmaBankDetails.details.aba || !migmaBankDetails.details.accountNumber) {
        console.error("[Wise Checkout] ❌ Missing required bank details for ABA account type");
        console.error("[Wise Checkout] Missing ABA:", !migmaBankDetails.details.aba);
        console.error("[Wise Checkout] Missing Account Number:", !migmaBankDetails.details.accountNumber);
        return new Response(
          JSON.stringify({ error: "WISE_MIGMA_ABA and WISE_MIGMA_ACCOUNT_NUMBER must be configured for ABA account type" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } else if (migmaBankDetails.type === 'swift') {
      if (!migmaBankDetails.details.swift || !migmaBankDetails.details.accountNumber) {
        console.error("[Wise Checkout] ❌ Missing required bank details for SWIFT account type");
        console.error("[Wise Checkout] Missing SWIFT:", !migmaBankDetails.details.swift);
        console.error("[Wise Checkout] Missing Account Number:", !migmaBankDetails.details.accountNumber);
        return new Response(
          JSON.stringify({ error: "WISE_MIGMA_SWIFT and WISE_MIGMA_ACCOUNT_NUMBER must be configured for SWIFT account type" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } else if (migmaBankDetails.type === 'iban') {
      if (!migmaBankDetails.details.iban) {
        console.error("[Wise Checkout] ❌ Missing required bank details for IBAN account type");
        console.error("[Wise Checkout] Missing IBAN:", !migmaBankDetails.details.iban);
        return new Response(
          JSON.stringify({ error: "WISE_MIGMA_IBAN must be configured for IBAN account type" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } else if (migmaBankDetails.type === 'sort_code') {
      if (!migmaBankDetails.details.sortCode || !migmaBankDetails.details.accountNumber) {
        console.error("[Wise Checkout] ❌ Missing required bank details for Sort Code account type");
        console.error("[Wise Checkout] Missing Sort Code:", !migmaBankDetails.details.sortCode);
        console.error("[Wise Checkout] Missing Account Number:", !migmaBankDetails.details.accountNumber);
        return new Response(
          JSON.stringify({ error: "WISE_MIGMA_SORT_CODE and WISE_MIGMA_ACCOUNT_NUMBER must be configured for Sort Code account type" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request body
    const body = await req.json();
    
    const {
      order_id,
      client_currency = "USD", // Currency client will pay in
    } = body;

    if (!order_id) {
      console.error("[Wise Checkout] ❌ order_id is missing from request body");
      return new Response(
        JSON.stringify({ error: "order_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get order from database
    const { data: order, error: orderError } = await supabase
      .from("visa_orders")
      .select("*")
      .eq("id", order_id)
      .single();

    if (orderError) {
      console.error("[Wise Checkout] ❌ Error fetching order:", orderError);
      console.error("[Wise Checkout] Error details:", JSON.stringify(orderError, null, 2));
      return new Response(
        JSON.stringify({ error: "Order not found", details: orderError.message }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!order) {
      console.error("[Wise Checkout] ❌ Order not found in database");
      return new Response(
        JSON.stringify({ error: "Order not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[Wise Checkout] ✅ Order:", order.order_number, "| Total:", order.total_price_usd);

    // Check if order already has a Wise transfer
    if (order.wise_transfer_id) {
      console.warn("[Wise Checkout] ⚠️ Order already has a Wise transfer:", order.wise_transfer_id);
      return new Response(
        JSON.stringify({ error: "Order already has a Wise transfer" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Initialize Wise client
    const wiseClient = new WiseClient(wisePersonalToken, wiseEnvironment);

    // Get profile ID
    let profileId = wiseProfileId;
    if (!profileId) {
      try {
        profileId = await wiseClient.getProfileId();
        console.log("[Wise Checkout] ✅ Profile ID:", profileId);
      } catch (error: any) {
        console.error("[Wise Checkout] ❌ Error fetching profile ID:", error);
        throw new Error(`Failed to get Wise profile ID: ${error.message}`);
      }
    }

    // 1. Create quote
    const quoteParams = {
      sourceCurrency: client_currency,
      targetCurrency: migmaBankDetails.currency,
      targetAmount: parseFloat(order.total_price_usd), // Amount Migma needs to receive
    };

    let quote: any;
    try {
      quote = await wiseClient.createQuote(profileId, quoteParams);
      console.log("[Wise Checkout] ✅ Quote:", quote.id);
    } catch (error: any) {
      console.error("[Wise Checkout] ❌ Error creating quote:", error);
      console.error("[Wise Checkout] Error stack:", error.stack);
      throw new Error(`Failed to create Wise quote: ${error.message}`);
    }

    // 2. Create recipient (Migma's account)
    // Build recipient params based on account type
    let recipientParams: any = {
      currency: migmaBankDetails.currency,
      type: migmaBankDetails.type,
      accountHolderName: migmaBankDetails.accountHolderName,
    };

    // Build details object based on account type
    if (migmaBankDetails.type === 'aba') {
      // For ABA accounts, Wise API expects specific format
      // See: https://docs.wise.com/api-docs/api-reference/recipient
      const state = Deno.env.get("WISE_MIGMA_STATE") || 'CA'; // Default to California
      const postCode = Deno.env.get("WISE_MIGMA_POST_CODE") || '94129'; // Default ZIP for San Francisco
      const firstLine = migmaBankDetails.details.bankAddress || migmaBankDetails.details.bankName || 'A4-700 1 Letterman Drive';
      
      recipientParams.details = {
        legalType: migmaBankDetails.legalType,
        abartn: migmaBankDetails.details.aba, // Use 'abartn' not 'aba' - this is the routing number
        accountNumber: migmaBankDetails.details.accountNumber,
        accountType: 'CHECKING', // CHECKING or SAVINGS - defaulting to CHECKING
        address: {
          country: migmaBankDetails.details.country || 'US',
          state: state,
          city: migmaBankDetails.details.city || 'San Francisco',
          postCode: postCode,
          firstLine: firstLine,
        },
      };
      
    } else if (migmaBankDetails.type === 'swift') {
      recipientParams.details = {
        legalType: migmaBankDetails.legalType,
        swift: migmaBankDetails.details.swift,
        accountNumber: migmaBankDetails.details.accountNumber,
        address: {
          country: migmaBankDetails.details.country || 'US',
          city: migmaBankDetails.details.city,
          firstLine: migmaBankDetails.details.bankAddress || migmaBankDetails.details.bankName,
        },
      };
    } else if (migmaBankDetails.type === 'iban') {
      recipientParams.details = {
        legalType: migmaBankDetails.legalType,
        iban: migmaBankDetails.details.iban,
        address: {
          country: migmaBankDetails.details.country,
          city: migmaBankDetails.details.city,
          firstLine: migmaBankDetails.details.bankAddress || migmaBankDetails.details.bankName,
        },
      };
    } else if (migmaBankDetails.type === 'sort_code') {
      recipientParams.details = {
        legalType: migmaBankDetails.legalType,
        sortCode: migmaBankDetails.details.sortCode,
        accountNumber: migmaBankDetails.details.accountNumber,
        address: {
          country: migmaBankDetails.details.country || 'GB',
          city: migmaBankDetails.details.city,
          firstLine: migmaBankDetails.details.bankAddress || migmaBankDetails.details.bankName,
        },
      };
    }

    let recipient: any;
    try {
      recipient = await wiseClient.createRecipient(profileId, recipientParams);
      console.log("[Wise Checkout] ✅ Recipient:", recipient.id);
    } catch (error: any) {
      console.error("[Wise Checkout] ❌ Error creating recipient:", error);
      console.error("[Wise Checkout] Error stack:", error.stack);
      throw new Error(`Failed to create Wise recipient: ${error.message}`);
    }

    // 3. Create transfer
    // Generate a valid UUID for customerTransactionId (required by Wise API)
    let customerTransactionId: string;
    if (order.id && uuidPattern.test(order.id)) {
      customerTransactionId = order.id;
    } else {
      customerTransactionId = crypto.randomUUID();
    }
    
    const transferParams = {
      targetAccount: recipient.id,
      quoteUuid: quote.id,
      customerTransactionId: customerTransactionId,
      reference: `Order ${order.order_number} - ${order.client_name}`,
    };
    
    let transfer: any;
    try {
      transfer = await wiseClient.createTransfer(profileId, transferParams);
      console.log("[Wise Checkout] ✅ Transfer:", transfer.id, "| Status:", transfer.status);
    } catch (error: any) {
      console.error("[Wise Checkout] ❌ Error creating transfer:", error);
      console.error("[Wise Checkout] Error stack:", error.stack);
      throw new Error(`Failed to create Wise transfer: ${error.message}`);
    }

    // 4. Save transfer details to database
    const updateData = {
      wise_transfer_id: transfer.id.toString(),
      wise_quote_uuid: quote.id,
      wise_recipient_id: recipient.id.toString(),
      wise_payment_status: transfer.status || 'incoming_payment_waiting',
    };
    
    const { error: updateOrderError } = await supabase
      .from("visa_orders")
      .update(updateData)
      .eq("id", order.id);

    if (updateOrderError) {
      console.error("[Wise Checkout] ❌ Error updating visa_orders:", updateOrderError.message);
      return new Response(
        JSON.stringify({ error: "Failed to update order", details: updateOrderError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Insert into wise_transfers table
    const sourceAmount = transfer.sourceValue || quote.sourceAmount || order.total_price_usd;
    const targetAmount = transfer.targetValue || quote.targetAmount || order.total_price_usd;
    const exchangeRate = transfer.rate || quote.rate || 1;
    
    const insertData = {
      visa_order_id: order.id,
      wise_transfer_id: transfer.id.toString(),
      wise_quote_uuid: quote.id,
      wise_recipient_id: recipient.id.toString(),
      source_currency: quoteParams.sourceCurrency,
      target_currency: quoteParams.targetCurrency,
      source_amount: sourceAmount,
      target_amount: targetAmount,
      exchange_rate: exchangeRate,
      fee_amount: quote.fee?.total || null,
      status: transfer.status || 'incoming_payment_waiting',
      status_details: transfer,
    };
    
    const { error: insertTransferError } = await supabase
      .from("wise_transfers")
      .insert(insertData);

    if (insertTransferError) {
      console.error("[Wise Checkout] ⚠️ Error inserting wise_transfers:", insertTransferError.message);
    }

    // 5. Get payment URL (client will be redirected to Wise)
    // IMPORTANTE: Com Personal Token, não há endpoint específico para obter URL de pagamento
    // Precisamos construir a URL manualmente ou usar campos do transfer object
    
    let paymentUrl: string;
    
    // Prioridade 1: Verificar se transfer object tem URL diretamente
    if (transfer.paymentLink || transfer.payment_url || transfer.payinUrl || transfer.payin_url || transfer.paymentUrl) {
      paymentUrl = transfer.paymentLink || transfer.payment_url || transfer.payinUrl || transfer.payin_url || transfer.paymentUrl;
      console.log("[Wise Checkout] ✅ Using payment URL from transfer object");
    }
    // Prioridade 2: Tentar buscar transfer novamente para ver se tem mais campos
    else {
      try {
        const transferDetails = await wiseClient.getTransferStatus(transfer.id.toString());
        if (transferDetails.paymentLink || transferDetails.payment_url || transferDetails.payinUrl || transferDetails.payin_url) {
          paymentUrl = transferDetails.paymentLink || transferDetails.payment_url || transferDetails.payinUrl || transferDetails.payin_url;
          console.log("[Wise Checkout] ✅ Using payment URL from transfer details");
        } else {
          // Prioridade 3: Tentar formatos diferentes com payinSessionId
          if (transfer.payinSessionId) {
            // Formato correto: https://wise.com/pay/r/{payinSessionId} (com /r/)
            if (wiseEnvironment === 'sandbox') {
              paymentUrl = `https://sandbox.wise.com/pay/r/${transfer.payinSessionId}`;
            } else {
              paymentUrl = `https://wise.com/pay/r/${transfer.payinSessionId}`;
            }
            console.log("[Wise Checkout] 🔗 Using payinSessionId with /r/ format");
          } else {
            // Fallback: usar transfer.id com /payments/
            if (wiseEnvironment === 'sandbox') {
              paymentUrl = `https://sandbox.wise.com/payments/${transfer.id}`;
            } else {
              paymentUrl = `https://wise.com/payments/${transfer.id}`;
            }
            console.log("[Wise Checkout] ⚠️ Using fallback URL with transfer ID");
          }
        }
      } catch (error) {
        // Se falhar ao buscar transfer, usar fallback
        if (transfer.payinSessionId) {
          if (wiseEnvironment === 'sandbox') {
            paymentUrl = `https://sandbox.wise.com/pay/r/${transfer.payinSessionId}`;
          } else {
            paymentUrl = `https://wise.com/pay/r/${transfer.payinSessionId}`;
          }
        } else {
          if (wiseEnvironment === 'sandbox') {
            paymentUrl = `https://sandbox.wise.com/payments/${transfer.id}`;
          } else {
            paymentUrl = `https://wise.com/payments/${transfer.id}`;
          }
        }
        console.log("[Wise Checkout] ⚠️ Error fetching transfer details, using fallback");
      }
    }
    
    console.log("[Wise Checkout] 🔗 Payment URL:", paymentUrl);
    console.log("[Wise Checkout] 📊 Transfer ID:", transfer.id);
    console.log("[Wise Checkout] 🔑 Payin Session ID:", transfer.payinSessionId || "N/A");
    
    // Log transfer object completo para debug (apenas se necessário)
    // console.log("[Wise Checkout] Transfer object keys:", Object.keys(transfer));

    console.log("[Wise Checkout] ========== ✅ CHECKOUT CREATED SUCCESSFULLY ==========");
    console.log("[Wise Checkout] Transfer:", transfer.id, "| Quote:", quote.id, "| Recipient:", recipient.id);
    console.log("[Wise Checkout] Status:", transfer.status, "| Payment URL:", paymentUrl);

    return new Response(
      JSON.stringify({
        success: true,
        transfer_id: transfer.id.toString(),
        transferId: transfer.id.toString(),
        quote_id: quote.id,
        quoteId: quote.id,
        recipient_id: recipient.id.toString(),
        recipientId: recipient.id.toString(),
        payment_url: paymentUrl,
        paymentUrl: paymentUrl,
        status: transfer.status,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[Wise Checkout] ========== ❌ ERROR OCCURRED ==========");
    console.error("[Wise Checkout] Error message:", error.message);
    console.error("[Wise Checkout] Error stack:", error.stack);
    console.error("[Wise Checkout] Error details:", JSON.stringify(error, null, 2));
    
    return new Response(
      JSON.stringify({ 
        error: error.message || "Failed to create Wise checkout",
        details: error.stack 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
