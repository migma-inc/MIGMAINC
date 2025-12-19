// Supabase Edge Function to approve a partner contract
// Updates verification_status to 'approved' and sets application status to 'active_partner'

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
    const { acceptance_id, reviewed_by } = await req.json();

    if (!acceptance_id) {
      return new Response(
        JSON.stringify({ success: false, error: "acceptance_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!reviewed_by) {
      return new Response(
        JSON.stringify({ success: false, error: "reviewed_by is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[EDGE FUNCTION] Approving partner contract for acceptance:", acceptance_id);

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Fetch acceptance to get application_id
    const { data: acceptance, error: acceptanceError } = await supabase
      .from('partner_terms_acceptances')
      .select('id, application_id, verification_status')
      .eq('id', acceptance_id)
      .single();

    if (acceptanceError || !acceptance) {
      console.error("[EDGE FUNCTION] Error fetching acceptance:", acceptanceError);
      return new Response(
        JSON.stringify({ success: false, error: "Contract acceptance not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!acceptance.application_id) {
      return new Response(
        JSON.stringify({ success: false, error: "Application ID not found in acceptance" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update acceptance with approval status
    const { error: updateAcceptanceError } = await supabase
      .from('partner_terms_acceptances')
      .update({
        verification_status: 'approved',
        verification_reviewed_by: reviewed_by,
        verification_reviewed_at: new Date().toISOString(),
      })
      .eq('id', acceptance_id);

    if (updateAcceptanceError) {
      console.error("[EDGE FUNCTION] Error updating acceptance:", updateAcceptanceError);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to approve contract" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update application status to 'active_partner'
    const { error: updateApplicationError } = await supabase
      .from('global_partner_applications')
      .update({
        status: 'active_partner',
        updated_at: new Date().toISOString(),
      })
      .eq('id', acceptance.application_id);

    if (updateApplicationError) {
      console.error("[EDGE FUNCTION] Error updating application status:", updateApplicationError);
      // Still return success since acceptance was updated
      console.warn("[EDGE FUNCTION] Acceptance approved but application status update failed");
    }

    console.log("[EDGE FUNCTION] Partner contract approved successfully");

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

