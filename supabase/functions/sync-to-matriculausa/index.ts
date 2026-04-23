import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * sync-to-matriculausa
 * Sincroniza dados completos do aluno para o MatriculaUSA.
 * Chamado pelo ScholarshipApprovalTab apenas quando a bolsa aprovada
 * é de Caroline University ou Oikos University.
 *
 * Input: { application_id: string }
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const migmaUrl = Deno.env.get("SUPABASE_URL")!;
  const migmaKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const migma = createClient(migmaUrl, migmaKey);

  const matriculaUrl = Deno.env.get("MATRICULAUSA_URL");
  const matriculaKey = Deno.env.get("MATRICULAUSA_SERVICE_ROLE");

  try {
    const { application_id } = await req.json();
    if (!application_id) {
      return new Response(JSON.stringify({ error: "application_id required" }), {
        status: 400, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    // 1. Load institution_applications with joins
    const { data: appRow, error: appErr } = await migma
      .from("institution_applications")
      .select(`
        id, profile_id, status,
        institutions (
          id, name, slug, application_fee_usd
        ),
        institution_scholarships (
          placement_fee_usd, discount_percent, monthly_migma_usd
        )
      `)
      .eq("id", application_id)
      .single();

    if (appErr || !appRow) throw new Error(`application not found: ${appErr?.message}`);

    // 2. Load user_profiles
    const { data: profile, error: profErr } = await migma
      .from("user_profiles")
      .select(`
        id, user_id, email, full_name, phone, country,
        student_process_type, service_type, num_dependents,
        selection_survey_passed,
        migma_seller_id, migma_agent_id
      `)
      .eq("id", appRow.profile_id)
      .single();

    if (profErr || !profile) throw new Error(`profile not found: ${profErr?.message}`);

    // 3. Load user_identity to get country (Migma Step 2 saves it here)
    const { data: identity } = await migma
      .from("user_identity")
      .select("country")
      .eq("user_id", profile.user_id)
      .maybeSingle();

    // 4. Map process type
    const processMapping: Record<string, string> = {
      cos: "change_of_status",
      transfer: "transfer",
      initial: "initial",
      reinstatement: "reinstatement",
      change_of_status: "change_of_status",
    };
    const rawProcessType = profile.student_process_type ?? profile.service_type ?? "";
    const mappedProcess = processMapping[rawProcessType] ?? rawProcessType;

    const institution = appRow.institutions as { id: string; name: string; slug: string; application_fee_usd: number } | null;
    const scholarship = appRow.institution_scholarships as { placement_fee_usd: number; discount_percent: number; monthly_migma_usd: number } | null;

    console.log(`[sync-to-matriculausa] Starting sync for profile ${profile.id} (${profile.email}), institution: ${institution?.name}`);

    // 5. Validate MatriculaUSA credentials
    if (!matriculaUrl || !matriculaKey) {
      console.warn("[sync-to-matriculausa] MATRICULAUSA_URL or MATRICULAUSA_SERVICE_ROLE not set — skipping remote sync");
      return new Response(JSON.stringify({ success: true, skipped: true, reason: "no_matricula_credentials" }), {
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const matricula = createClient(matriculaUrl, matriculaKey);

    // 6. Create or find MatriculaUSA auth user
    const { data: authUser, error: authErr } = await matricula.auth.admin.createUser({
      email: profile.email,
      password: crypto.randomUUID(),
      email_confirm: true,
      user_metadata: { full_name: profile.full_name, source: "migma" },
    });

    let remoteId = authUser?.user?.id;
    if (authErr && (authErr.message?.includes("already registered") || (authErr as any).status === 422)) {
      const { data: existing } = await matricula
        .from("user_profiles")
        .select("user_id")
        .eq("email", profile.email)
        .maybeSingle();
      remoteId = existing?.user_id;
    }

    if (!remoteId) throw new Error("Could not create or find MatriculaUSA user");

    // Wait for auth propagation
    await new Promise((r) => setTimeout(r, 800));

    // 7. Build payload — only fields that exist in MatriculaUSA user_profiles schema
    const remoteProfileData: Record<string, unknown> = {
      full_name: profile.full_name,
      phone: profile.phone || "",
      country: identity?.country || profile.country || null,
      student_process_type: mappedProcess,
      status: "active",
      role: "student",
      source: "migma",
      dependents: profile.num_dependents || 0,
      placement_fee_flow: true,
      selection_survey_passed: profile.selection_survey_passed ?? false,
    };

    console.log("[sync-to-matriculausa] Payload to send:", JSON.stringify(remoteProfileData));

    // 8. PATCH MatriculaUSA profile
    const patchRes = await fetch(
      `${matriculaUrl}/rest/v1/user_profiles?user_id=eq.${remoteId}`,
      {
        method: "PATCH",
        headers: {
          apikey: matriculaKey,
          Authorization: `Bearer ${matriculaKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(remoteProfileData),
      }
    );

    const patchText = await patchRes.text();
    console.log(`[sync-to-matriculausa] MatriculaUSA PATCH status: ${patchRes.status} body: ${patchText}`);

    if (!patchRes.ok) {
      throw new Error(`MatriculaUSA PATCH failed: ${patchRes.status} ${patchText}`);
    }

    // 9. Store matricula_user_id in Migma
    await migma
      .from("user_profiles")
      .update({ matricula_user_id: remoteId })
      .eq("id", profile.id);

    return new Response(
      JSON.stringify({ success: true, matricula_user_id: remoteId }),
      { headers: { ...CORS, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("[sync-to-matriculausa] Erro Fatal:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
