import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

/**
 * receive-matriculausa-letter
 *
 * Webhook called by MatriculaUSA when the acceptance letter (and optionally
 * the Transfer Form) is ready for a student.
 *
 * Expected payload (POST):
 * {
 *   student_email: string;          // used to look up the student in Migma
 *   acceptance_letter_url: string;  // publicly accessible URL to the PDF
 *   transfer_form_url?: string;     // optional — Transfer students only
 * }
 *
 * Security: x-migma-webhook-secret header must match MIGMA_WEBHOOK_SECRET env var.
 *
 * Side effects:
 *  1. Updates institution_applications: acceptance_letter_url, package_status = 'ready'
 *  2. Updates user_profiles: onboarding_current_step = 'acceptance_letter'
 *  3. Sends acceptance_letter_ready notification to student via migma-notify
 */

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-migma-webhook-secret",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const webhookSecret = Deno.env.get("MIGMA_WEBHOOK_SECRET");

  // ── Auth ─────────────────────────────────────────────────────────────────────
  if (webhookSecret) {
    const incoming = req.headers.get("x-migma-webhook-secret");
    if (incoming !== webhookSecret) {
      console.warn("[receive-matriculausa-letter] ❌ Invalid webhook secret");
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    const body = await req.json();
    const {
      student_email,
      acceptance_letter_url,
      transfer_form_url,
      transfer_form_admin_status,   // 'approved' | 'rejected'
      transfer_form_rejection_reason,
    } = body;

    if (!student_email || (!acceptance_letter_url && !transfer_form_url && !transfer_form_admin_status)) {
      return new Response(
        JSON.stringify({ error: "student_email and at least one action field are required" }),
        { status: 400, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    console.log(`[receive-matriculausa-letter] Processing for: ${student_email}`);

    // ── 1. Find student profile ───────────────────────────────────────────────
    const { data: profile, error: profileErr } = await supabase
      .from("user_profiles")
      .select("id, user_id, full_name, email")
      .eq("email", student_email)
      .maybeSingle();

    if (profileErr || !profile) {
      console.error("[receive-matriculausa-letter] Profile not found:", profileErr?.message);
      return new Response(
        JSON.stringify({ error: "Student not found", detail: profileErr?.message }),
        { status: 404, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    // ── 2. Find active institution_application ────────────────────────────────
    const { data: app, error: appErr } = await supabase
      .from("institution_applications")
      .select("id, status, package_status")
      .eq("profile_id", profile.id)
      .in("status", ["payment_confirmed", "approved", "submitted", "pending", "documents_uploaded"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (appErr || !app) {
      console.error("[receive-matriculausa-letter] Application not found:", appErr?.message);
      return new Response(
        JSON.stringify({ error: "Active application not found", detail: appErr?.message }),
        { status: 404, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    // ── 3. Update institution_applications ────────────────────────────────────
    const appUpdate: Record<string, unknown> = {};
    if (acceptance_letter_url) {
      appUpdate.acceptance_letter_url = acceptance_letter_url;
      appUpdate.package_status = "ready";
    }
    if (transfer_form_url) {
      appUpdate.transfer_form_url = transfer_form_url;
    }
    if (transfer_form_admin_status) {
      appUpdate.transfer_form_admin_status = transfer_form_admin_status;
      appUpdate.transfer_form_reviewed_at = new Date().toISOString();
      if (transfer_form_rejection_reason) {
        appUpdate.transfer_form_rejection_reason = transfer_form_rejection_reason;
      }
      // If rejected, reset student status so they can resubmit
      if (transfer_form_admin_status === "rejected") {
        appUpdate.transfer_form_student_status = "pending";
      }
    }

    const { error: appUpdateErr } = await supabase
      .from("institution_applications")
      .update(appUpdate)
      .eq("id", app.id);

    if (appUpdateErr) {
      console.error("[receive-matriculausa-letter] Failed to update application:", appUpdateErr.message);
      return new Response(
        JSON.stringify({ error: "Failed to update application", detail: appUpdateErr.message }),
        { status: 500, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    console.log(`[receive-matriculausa-letter] ✅ application ${app.id} updated — package_status=ready`);

    // ── 4. Update onboarding_current_step ────────────────────────────────────
    await supabase
      .from("user_profiles")
      .update({ onboarding_current_step: "acceptance_letter" })
      .eq("id", profile.id);

    // ── 5. Notify student via migma-notify ───────────────────────────────────
    if (acceptance_letter_url) {
      try {
        await supabase.functions.invoke("migma-notify", {
          body: {
            trigger: "acceptance_letter_ready",
            user_id: profile.id,
            data: {
              client_name: profile.full_name ?? profile.email,
              acceptance_letter_url,
            },
          },
        });
        console.log(`[receive-matriculausa-letter] ✅ Acceptance letter notification sent`);
      } catch (notifyErr) {
        console.warn("[receive-matriculausa-letter] Notification failed (non-fatal):", notifyErr);
      }
    }

    if (transfer_form_admin_status === "approved") {
      try {
        await supabase.functions.invoke("migma-notify", {
          body: {
            trigger: "transfer_form_approved",
            user_id: profile.id,
            data: { client_name: profile.full_name ?? profile.email },
          },
        });
      } catch (notifyErr) {
        console.warn("[receive-matriculausa-letter] Transfer approved notification failed (non-fatal):", notifyErr);
      }
    }

    if (transfer_form_admin_status === "rejected") {
      try {
        await supabase.functions.invoke("migma-notify", {
          body: {
            trigger: "transfer_form_rejected",
            user_id: profile.id,
            data: {
              client_name: profile.full_name ?? profile.email,
              rejection_reason: transfer_form_rejection_reason ?? "Motivo não informado",
            },
          },
        });
      } catch (notifyErr) {
        console.warn("[receive-matriculausa-letter] Transfer rejected notification failed (non-fatal):", notifyErr);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        application_id: app.id,
        profile_id: profile.id,
        package_status: "ready",
      }),
      { status: 200, headers: { ...CORS, "Content-Type": "application/json" } }
    );

  } catch (err: any) {
    console.error("[receive-matriculausa-letter] Unhandled error:", err.message);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...CORS, "Content-Type": "application/json" } }
    );
  }
});
