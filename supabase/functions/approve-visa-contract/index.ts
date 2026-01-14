// Supabase Edge Function to approve a visa contract
// Updates contract_approval_status to 'approved' and records who approved it

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { order_id, reviewed_by, contract_type } = await req.json();

    if (!order_id) {
      return new Response(
        JSON.stringify({ success: false, error: "order_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!reviewed_by) {
      return new Response(
        JSON.stringify({ success: false, error: "reviewed_by is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // contract_type: 'annex' or 'contract' (defaults to 'contract' for backward compatibility)
    const approvalType = contract_type === 'annex' ? 'annex' : 'contract';
    
    console.log(`[EDGE FUNCTION] Approving ${approvalType} for order:`, order_id);

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Update order with approval status based on contract type
    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (approvalType === 'annex') {
      updateData.annex_approval_status = 'approved';
      updateData.annex_approval_reviewed_by = reviewed_by;
      updateData.annex_approval_reviewed_at = new Date().toISOString();
    } else {
      updateData.contract_approval_status = 'approved';
      updateData.contract_approval_reviewed_by = reviewed_by;
      updateData.contract_approval_reviewed_at = new Date().toISOString();
    }

    const { error: updateError } = await supabase
      .from('visa_orders')
      .update(updateData)
      .eq('id', order_id);

    if (updateError) {
      console.error("[EDGE FUNCTION] Error approving contract:", updateError);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to approve contract" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[EDGE FUNCTION] ${approvalType === 'annex' ? 'ANNEX I' : 'Contract'} approved successfully`);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Contract approved successfully",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[EDGE FUNCTION] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});





















