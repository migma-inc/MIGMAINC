import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function first<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function dateOnly(value: string | null | undefined): string | null {
  if (!value) return null;
  return new Date(value).toISOString().split("T")[0];
}

function addMonths(dateStr: string, months: number): string {
  const d = new Date(`${dateStr}T12:00:00Z`);
  const originalDay = d.getDate();
  d.setMonth(d.getMonth() + months);
  if (d.getDate() !== originalDay) d.setDate(0);
  return d.toISOString().split("T")[0];
}

function normalizeProcessType(value: unknown): "transfer" | "cos" {
  const raw = String(value ?? "").toLowerCase();
  return raw.includes("cos") ? "cos" : "transfer";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const supabaseUrl = Deno.env.get("REMOTE_SUPABASE_URL") ?? Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("REMOTE_SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const body = await req.json();
    const { application_id, process_type } = body as {
      application_id: string;
      process_type?: string;
    };

    if (!application_id) {
      return new Response(JSON.stringify({ error: "application_id obrigatorio" }), {
        status: 400,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const { data: app, error: appErr } = await supabase
      .from("institution_applications")
      .select(`
        id, profile_id, institution_id, scholarship_level_id,
        acceptance_letter_url, acceptance_letter_received_at, package_sent_at,
        cos_approved_at, created_at,
        institution_scholarships(monthly_migma_usd, installments_total),
        user_profiles(service_type, student_process_type)
      `)
      .eq("id", application_id)
      .maybeSingle();

    if (appErr || !app) {
      return new Response(JSON.stringify({ error: "Application nao encontrada", detail: appErr?.message }), {
        status: 404,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const scholarship = first(app.institution_scholarships as any);
    const profile = first(app.user_profiles as any);
    const monthly_usd = Number(scholarship?.monthly_migma_usd ?? 0);
    const installments_total = Number(scholarship?.installments_total ?? 0);

    if (!monthly_usd || monthly_usd <= 0 || !installments_total || installments_total <= 0) {
      return new Response(JSON.stringify({
        error: "Bolsa aprovada sem monthly_migma_usd/installments_total validos",
        scholarship_level_id: app.scholarship_level_id,
      }), {
        status: 422,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const resolvedProcessType = normalizeProcessType(
      process_type ?? profile?.service_type ?? profile?.student_process_type,
    );

    const eligibleAt = resolvedProcessType === "cos"
      ? dateOnly(app.cos_approved_at)
      : dateOnly(app.acceptance_letter_received_at ?? app.package_sent_at ?? app.created_at);

    if (resolvedProcessType === "transfer" && !app.acceptance_letter_url) {
      return new Response(JSON.stringify({
        error: "Transfer ainda nao tem acceptance_letter_url; billing nao pode iniciar",
      }), {
        status: 409,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    if (!eligibleAt) {
      return new Response(JSON.stringify({
        error: resolvedProcessType === "cos"
          ? "COS ainda nao tem cos_approved_at; billing nao pode iniciar"
          : "Data de elegibilidade indisponivel",
      }), {
        status: 409,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const start_date = addMonths(eligibleAt, 1);
    const end_date = addMonths(start_date, installments_total);

    const { data: existing } = await supabase
      .from("recurring_charges")
      .select("id, status")
      .eq("application_id", application_id)
      .neq("status", "cancelled")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing) {
      return new Response(JSON.stringify({
        ok: false,
        reason: "billing_already_exists",
        existing_id: existing.id,
        existing_status: existing.status,
      }), { status: 409, headers: { ...CORS, "Content-Type": "application/json" } });
    }

    const { data: charge, error: insertErr } = await supabase
      .from("recurring_charges")
      .insert({
        profile_id: app.profile_id,
        institution_id: app.institution_id,
        scholarship_level_id: app.scholarship_level_id,
        application_id,
        monthly_usd,
        installments_total,
        installments_paid: 0,
        start_date,
        end_date,
        next_billing_date: start_date,
        status: "active",
        exempted_by_referral: false,
      })
      .select()
      .single();

    if (insertErr) {
      return new Response(JSON.stringify({ error: insertErr.message }), {
        status: 500,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    console.log(`[start-migma-billing] charge created: ${charge.id} $${monthly_usd}/mo x${installments_total} start=${start_date}`);

    await supabase.functions.invoke("migma-notify", {
      body: {
        trigger: "billing_started",
        user_id: app.profile_id,
        data: {
          monthly_usd,
          installments_total,
          process_type: resolvedProcessType,
          start_date,
        },
      },
    }).catch(() => {});

    return new Response(JSON.stringify({
      ok: true,
      charge_id: charge.id,
      monthly_usd,
      installments_total,
      process_type: resolvedProcessType,
      start_date,
      next_billing_date: charge.next_billing_date,
    }), { status: 200, headers: { ...CORS, "Content-Type": "application/json" } });
  } catch (err: any) {
    console.error("[start-migma-billing] Error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: CORS,
    });
  }
});
