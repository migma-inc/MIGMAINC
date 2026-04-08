import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function scheduleBackgroundTask(task: Promise<unknown>) {
  const edgeRuntime = (globalThis as typeof globalThis & {
    EdgeRuntime?: { waitUntil?: (promise: Promise<unknown>) => void };
  }).EdgeRuntime;

  if (edgeRuntime?.waitUntil) {
    edgeRuntime.waitUntil(task);
    return;
  }

  void task.catch((error) => {
    console.error("[APPROVE_STATUS] Background task failed:", error);
  });
}

Deno.serve(async (req) => {
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

    const approvalType = contract_type || "contract";
    const reviewedAt = new Date().toISOString();
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const updateData: Record<string, string> = {
      updated_at: reviewedAt,
    };

    if (approvalType === "annex") {
      updateData.annex_approval_status = "approved";
      updateData.annex_approval_reviewed_by = reviewed_by;
      updateData.annex_approval_reviewed_at = reviewedAt;
    } else if (approvalType === "upsell_contract") {
      updateData.upsell_contract_approval_status = "approved";
      updateData.upsell_contract_approval_reviewed_by = reviewed_by;
      updateData.upsell_contract_approval_reviewed_at = reviewedAt;
    } else if (approvalType === "upsell_annex") {
      updateData.upsell_annex_approval_status = "approved";
      updateData.upsell_annex_approval_reviewed_by = reviewed_by;
      updateData.upsell_annex_approval_reviewed_at = reviewedAt;
    } else {
      updateData.contract_approval_status = "approved";
      updateData.contract_approval_reviewed_by = reviewed_by;
      updateData.contract_approval_reviewed_at = reviewedAt;
    }

    const { error: updateError } = await supabase
      .from("visa_orders")
      .update(updateData)
      .eq("id", order_id);

    if (updateError) {
      console.error("[APPROVE_STATUS] Error updating visa order:", updateError);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to approve contract" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    scheduleBackgroundTask((async () => {
      const response = await fetch(`${supabaseUrl}/functions/v1/approve-visa-contract`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: supabaseServiceKey,
          Authorization: `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify({
          order_id,
          reviewed_by,
          contract_type: approvalType,
        }),
      });

      if (!response.ok) {
        const body = await response.text();
        console.error("[APPROVE_STATUS] Background approval workflow failed:", response.status, body);
      }
    })());

    return new Response(
      JSON.stringify({
        success: true,
        message: "Contract approved successfully",
        reviewed_at: reviewedAt,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[APPROVE_STATUS] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
