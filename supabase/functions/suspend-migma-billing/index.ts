import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const supabaseUrl = Deno.env.get("REMOTE_SUPABASE_URL") ?? Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("REMOTE_SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const body = await req.json();
    const { profile_id, charge_id, reason, action } = body as {
      profile_id?: string;
      charge_id?: string;
      reason?: string;
      action?: "suspend" | "cancel" | "reactivate";
    };

    if (!profile_id && !charge_id) {
      return new Response(JSON.stringify({ error: "profile_id ou charge_id obrigatório" }), {
        status: 400, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const targetAction = action ?? "suspend";
    const newStatus = targetAction === "reactivate" ? "active" : targetAction === "cancel" ? "cancelled" : "suspended";

    const updatePayload: Record<string, unknown> = { status: newStatus };

    if (newStatus === "suspended" || newStatus === "cancelled") {
      updatePayload.suspended_at = new Date().toISOString();
      updatePayload.suspended_reason = reason ?? null;
    } else if (newStatus === "active") {
      updatePayload.suspended_at = null;
      updatePayload.suspended_reason = null;
    }

    let query = supabase.from("recurring_charges").update(updatePayload);

    if (charge_id) {
      query = query.eq("id", charge_id);
    } else {
      query = query.eq("profile_id", profile_id!).in("status", ["active", "suspended"]);
    }

    const { data: updated, error: updateErr } = await query.select("id, status, profile_id");

    if (updateErr) {
      return new Response(JSON.stringify({ error: updateErr.message }), {
        status: 500, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const affectedProfileId = (updated as any[])?.[0]?.profile_id ?? profile_id;

    console.log(`[suspend-migma-billing] action=${targetAction} affected=${updated?.length ?? 0} profile=${affectedProfileId}`);

    // Notifica aluno se suspenso/cancelado
    if (newStatus !== "active" && affectedProfileId) {
      await supabase.functions.invoke("migma-notify", {
        body: {
          trigger: "billing_suspended",
          user_id: affectedProfileId,
          data: { reason: reason ?? null, action: targetAction },
        },
      }).catch(() => {});
    }

    return new Response(JSON.stringify({
      ok: true,
      action: targetAction,
      new_status: newStatus,
      affected: updated?.length ?? 0,
      charges: updated,
    }), { status: 200, headers: { ...CORS, "Content-Type": "application/json" } });

  } catch (err: any) {
    console.error("[suspend-migma-billing] Error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: CORS,
    });
  }
});
