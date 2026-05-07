import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

/**
 * notify-matriculausa-transfer-form
 *
 * Called by AcceptanceLetterStep (Migma frontend) when the student uploads
 * their filled Transfer Form.
 *
 * Payload:
 * {
 *   student_email: string;
 *   student_name: string;
 *   filled_form_url: string;       // public URL of the uploaded file
 *   migma_application_id: string;
 * }
 *
 * Side effects:
 *  1. Calls MatriculaUSA's receive-migma-transfer-form endpoint
 */

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const matriculaUsaFunctionsUrl = Deno.env.get("MATRICULAUSA_FUNCTIONS_URL");
  const matriculaUsaServiceRole = Deno.env.get("MATRICULAUSA_SERVICE_ROLE");
  const migmaWebhookSecret = Deno.env.get("MIGMA_WEBHOOK_SECRET");

  if (!matriculaUsaFunctionsUrl || !matriculaUsaServiceRole || !migmaWebhookSecret) {
    console.error("[notify-matriculausa-transfer-form] Missing env vars");
    return new Response(JSON.stringify({ error: "Server misconfigured" }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();
    const { student_email, student_name, filled_form_url, migma_application_id } = body;

    if (!student_email || !filled_form_url || !migma_application_id) {
      return new Response(
        JSON.stringify({ error: "student_email, filled_form_url, and migma_application_id are required" }),
        { status: 400, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    console.log(`[notify-matriculausa-transfer-form] Notifying MatriculaUSA for: ${student_email}`);

    const res = await fetch(`${matriculaUsaFunctionsUrl}/receive-migma-transfer-form`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${matriculaUsaServiceRole}`,
        "x-migma-webhook-secret": migmaWebhookSecret,
      },
      body: JSON.stringify({
        student_email,
        student_name,
        filled_form_url,
        migma_application_id,
      }),
    });

    const resBody = await res.json().catch(() => ({}));
    console.log(`[notify-matriculausa-transfer-form] MatriculaUSA responded: ${res.status}`, resBody);

    if (!res.ok) {
      console.warn("[notify-matriculausa-transfer-form] Non-OK from MatriculaUSA:", resBody);
    }

    return new Response(
      JSON.stringify({ success: true, matriculausa_status: res.status }),
      { status: 200, headers: { ...CORS, "Content-Type": "application/json" } }
    );

  } catch (err: any) {
    console.error("[notify-matriculausa-transfer-form] Error:", err.message);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...CORS, "Content-Type": "application/json" } }
    );
  }
});
