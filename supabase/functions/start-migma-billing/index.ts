import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Lógica de valores Fase 9 (hard-coded conforme spec)
const MONTHLY_USD: Record<string, number> = {
  "Graduação":    3800,
  "Pós-Graduação": 4200,
  "Mestrado":     4200,
  "MBA":          5500,
  "MBA+CS":       5500,
};

function getMonthlyAmount(degreeLevel: string): number {
  return MONTHLY_USD[degreeLevel] ?? 3800;
}

// Primeiro dia do mês seguinte
function nextMonthFirstDay(): string {
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  d.setDate(1);
  return d.toISOString().split("T")[0];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const supabaseUrl = Deno.env.get("REMOTE_SUPABASE_URL") ?? Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("REMOTE_SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const body = await req.json();
    const { application_id, installments } = body as {
      application_id: string;
      installments?: number;
    };

    if (!application_id) {
      return new Response(JSON.stringify({ error: "application_id obrigatório" }), {
        status: 400, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    // Busca application
    const { data: app, error: appErr } = await supabase
      .from("institution_applications")
      .select("id, profile_id, institution_id, scholarship_level_id")
      .eq("id", application_id)
      .maybeSingle();

    if (appErr || !app) {
      return new Response(JSON.stringify({ error: "Application não encontrada", detail: appErr?.message }), {
        status: 404, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    // Resolve degree_level via scholarship → course (queries separadas evitam ambiguidade de FK no PostgREST)
    let degreeLevel = "Graduação";
    if (app.scholarship_level_id) {
      const { data: scholarship } = await supabase
        .from("institution_scholarships")
        .select("course_id")
        .eq("id", app.scholarship_level_id)
        .maybeSingle();

      if (scholarship?.course_id) {
        const { data: course } = await supabase
          .from("institution_courses")
          .select("degree_level")
          .eq("id", scholarship.course_id)
          .maybeSingle();
        if (course?.degree_level) degreeLevel = course.degree_level;
      }
    }

    const monthly_usd = getMonthlyAmount(degreeLevel);
    const installments_total = installments ?? 24;
    const today = new Date().toISOString().split("T")[0];
    const end_date = (() => {
      const d = new Date();
      d.setMonth(d.getMonth() + installments_total);
      return d.toISOString().split("T")[0];
    })();

    // Garante idempotência — não cria duplicata se já existe billing ativo
    const { data: existing } = await supabase
      .from("recurring_charges")
      .select("id, status")
      .eq("application_id", application_id)
      .in("status", ["active", "suspended"])
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
        profile_id:        app.profile_id,
        institution_id:    app.institution_id,
        scholarship_level_id: app.scholarship_level_id,
        application_id,
        monthly_usd,
        installments_total,
        installments_paid: 0,
        start_date:        today,
        end_date,
        next_billing_date: nextMonthFirstDay(),
        status:            "active",
        exempted_by_referral: false,
      })
      .select()
      .single();

    if (insertErr) {
      return new Response(JSON.stringify({ error: insertErr.message }), {
        status: 500, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    console.log(`[start-migma-billing] charge created: ${charge.id} — ${degreeLevel} $${monthly_usd}/mo x${installments_total}`);

    // Notifica aluno via migma-notify (best-effort)
    await supabase.functions.invoke("migma-notify", {
      body: {
        trigger: "billing_started",
        user_id: app.profile_id,
        data: { monthly_usd, installments_total, degree_level: degreeLevel },
      },
    }).catch(() => {});

    return new Response(JSON.stringify({
      ok: true,
      charge_id:        charge.id,
      monthly_usd,
      installments_total,
      degree_level:     degreeLevel,
      next_billing_date: charge.next_billing_date,
    }), { status: 200, headers: { ...CORS, "Content-Type": "application/json" } });

  } catch (err: any) {
    console.error("[start-migma-billing] Error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: CORS,
    });
  }
});
