import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-migma-webhook-secret",
};

interface CallbackPayload {
  action: 'approved' | 'rejected';
  migma_application_id: string; // scholarship_applications.id
  migma_profile_id: string;     // user_profiles.id
  migma_user_id: string;        // auth.users.id
  matriculausa_payment_id: string;
  approved_by?: string;
  rejected_by?: string;
  rejection_reason?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  // 1. Verify shared secret
  const secret = req.headers.get("x-migma-webhook-secret");
  const expectedSecret = Deno.env.get("MIGMA_WEBHOOK_SECRET");

  if (!secret || secret !== expectedSecret) {
    console.error("❌ [migma-approve-application-fee] Unauthorized: Invalid secret");
    return new Response(JSON.stringify({ error: "Unauthorized" }), { 
      status: 401, 
      headers: { ...CORS, "Content-Type": "application/json" } 
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const payload: CallbackPayload = await req.json();
    const { 
      action, 
      migma_application_id, 
      migma_profile_id, 
      migma_user_id, 
      matriculausa_payment_id,
      approved_by,
      rejected_by,
      rejection_reason 
    } = payload;

    console.log(`🚀 [migma-approve-application-fee] Processing ${action} for application ${migma_application_id}`);

    if (action === 'approved') {
      console.log(`Step 1: Updating institution_applications for ID: ${migma_application_id}`);
      const { error: appError } = await supabase
        .from("institution_applications")
        .update({
          is_application_fee_paid: true,
          application_fee_payment_method: 'zelle',
        })
        .eq("id", migma_application_id);

      if (appError) {
        console.error("❌ Error in Step 1:", appError);
        throw appError;
      }
      console.log("✅ Step 1 Success");

      console.log(`Step 1.5: Updating user_profiles for ID: ${migma_profile_id}`);
      const { error: profileError } = await supabase
        .from("user_profiles")
        .update({
          is_application_fee_paid: true,
        })
        .eq("id", migma_profile_id);

      if (profileError) {
        console.warn("⚠️ Warning in Step 1.5 (user_profiles):", profileError.message);
      } else {
        console.log("✅ Step 1.5 Success");
      }

      console.log(`Step 2: Updating application_fee_zelle_pending`);
      const { error: zelleError } = await supabase
        .from("application_fee_zelle_pending")
        .update({
          status: 'approved',
          matriculausa_payment_id,
          approved_at: new Date().toISOString(),
          approved_by: approved_by || 'MatriculaUSA Admin',
          updated_at: new Date().toISOString()
        })
        .eq("institution_application_id", migma_application_id)
        .eq("status", "pending_verification");

      if (zelleError) {
        console.warn("⚠️ Warning in Step 2:", zelleError.message);
      } else {
        console.log("✅ Step 2 Success");
      }

      console.log(`Step 3: Invoking migma-notify for profile: ${migma_profile_id}`);
      try {
        const { data: notifyData, error: notifyError } = await supabase.functions.invoke("migma-notify", {
          body: {
            trigger: "application_fee_paid",
            user_id: migma_profile_id,
          }
        });
        if (notifyError) throw notifyError;
        console.log("✅ Step 3 Success:", notifyData);
      } catch (err: any) {
        console.error("⚠️ Step 3 (migma-notify) failed, but continuing:", err.message);
      }

    } else if (action === 'rejected') {
      // 1. Update zelle_pending record with rejection info
      const { error: zelleError } = await supabase
        .from("application_fee_zelle_pending")
        .update({
          status: 'rejected',
          matriculausa_payment_id,
          rejection_reason: rejection_reason || 'Invalid proof of payment',
          updated_at: new Date().toISOString()
        })
        .eq("institution_application_id", migma_application_id)
        .eq("status", "pending_verification");

      if (zelleError) throw zelleError;

      // 2. Notify student (Rejected)
      await supabase.functions.invoke("migma-notify", {
        body: {
          trigger: "document_rejected",
          user_id: migma_profile_id,
          data: {
            document_name: "Zelle Proof of Payment (Application Fee)",
            document_reason: rejection_reason || "The submitted proof of payment could not be validated."
          }
        }
      });
    }

    return new Response(JSON.stringify({ success: true }), { 
      headers: { ...CORS, "Content-Type": "application/json" } 
    });

  } catch (error: any) {
    console.error("❌ [migma-approve-application-fee] Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500, 
      headers: { ...CORS, "Content-Type": "application/json" } 
    });
  }
});
