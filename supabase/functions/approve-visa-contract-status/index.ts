import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CONTRACT_IDENTITY_DOC_TYPES = [
  "passport",
  "passport_back",
  "selfie_with_doc",
  "document_front",
  "document_back",
  "selfie_doc",
];

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function getRequestIp(req: Request) {
  return req.headers.get("cf-connecting-ip")
    ?? req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? req.headers.get("x-real-ip")
    ?? null;
}

async function approveContractIdentityDocuments(
  supabase: any,
  clientEmail: string | null | undefined,
) {
  if (!clientEmail) return;

  const { data: profile, error: profileError } = await supabase
    .from("user_profiles")
    .select("user_id")
    .eq("email", clientEmail)
    .maybeSingle();

  if (profileError || !profile?.user_id) {
    console.warn("[APPROVE_STATUS] Identity docs approval skipped: profile not found for", clientEmail);
    return;
  }

  const { error } = await supabase
    .from("student_documents")
    .update({
      status: "approved",
      rejection_reason: null,
    })
    .eq("user_id", profile.user_id)
    .in("type", CONTRACT_IDENTITY_DOC_TYPES);

  if (error) {
    console.error("[APPROVE_STATUS] Failed to approve contract identity documents:", error.message);
  }
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
    const adminIp = getRequestIp(req);
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: order } = await supabase
      .from("visa_orders")
      .select("client_email")
      .eq("id", order_id)
      .maybeSingle();

    const updateData: Record<string, string> = {
      updated_at: reviewedAt,
    };

    if (approvalType === "annex") {
      updateData.annex_approval_status = "approved";
      updateData.annex_approval_reviewed_by = reviewed_by;
      updateData.annex_approval_reviewed_at = reviewedAt;
      if (adminIp) updateData.annex_approval_admin_ip = adminIp;
    } else if (approvalType === "upsell_contract") {
      updateData.upsell_contract_approval_status = "approved";
      updateData.upsell_contract_approval_reviewed_by = reviewed_by;
      updateData.upsell_contract_approval_reviewed_at = reviewedAt;
      if (adminIp) updateData.upsell_contract_approval_admin_ip = adminIp;
    } else if (approvalType === "upsell_annex") {
      updateData.upsell_annex_approval_status = "approved";
      updateData.upsell_annex_approval_reviewed_by = reviewed_by;
      updateData.upsell_annex_approval_reviewed_at = reviewedAt;
      if (adminIp) updateData.upsell_annex_approval_admin_ip = adminIp;
    } else {
      updateData.contract_approval_status = "approved";
      updateData.contract_approval_reviewed_by = reviewed_by;
      updateData.contract_approval_reviewed_at = reviewedAt;
      if (adminIp) updateData.contract_approval_admin_ip = adminIp;
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

    if (approvalType === "contract") {
      await approveContractIdentityDocuments(supabase, order?.client_email);
    }

    const workflowResponse = await fetch(`${supabaseUrl}/functions/v1/approve-visa-contract`, {
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
        admin_ip: adminIp,
      }),
    });

    if (!workflowResponse.ok) {
      const body = await workflowResponse.text();
      console.error("[APPROVE_STATUS] Approval workflow failed:", workflowResponse.status, body);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Contract approved successfully",
        reviewed_at: reviewedAt,
        admin_ip: adminIp,
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
