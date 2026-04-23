import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * sync-to-matriculausa (v2)
 *
 * Sincroniza dados completos do aluno + bolsa aprovada para o MatriculaUSA.
 * Chamado pelo ScholarshipApprovalTab quando a bolsa aprovada é de Caroline ou Oikos.
 *
 * Sequência:
 *  1. Criar/localizar auth user no MatriculaUSA
 *  2. PATCH user_profiles (dados básicos + seller/agent)
 *  3. Upsert university (por slug)
 *  4. Upsert scholarship com is_active=false (bolsa privada, invisível no catálogo)
 *  5. Upsert scholarship_applications (status=approved, source=migma)
 *  6. PATCH user_profiles com selected_scholarship_id + selected_application_id
 *  7. Salvar matricula_user_id de volta na Migma
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

    // ── Load Migma data ──────────────────────────────────────────────────────

    const { data: appRow, error: appErr } = await migma
      .from("institution_applications")
      .select(`
        id, profile_id, status,
        placement_fee_paid_at, admin_approved_at,
        institutions (
          id, name, slug, city, state, modality, application_fee_usd
        ),
        institution_scholarships (
          id, placement_fee_usd, discount_percent,
          tuition_annual_usd, monthly_migma_usd, installments_total,
          institution_courses (
            course_name, degree_level
          )
        )
      `)
      .eq("id", application_id)
      .single();

    if (appErr || !appRow) throw new Error(`application not found: ${appErr?.message}`);

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

    const { data: identity } = await migma
      .from("user_identity")
      .select("country")
      .eq("user_id", profile.user_id)
      .maybeSingle();

    // ── Type helpers ─────────────────────────────────────────────────────────

    const institution = appRow.institutions as {
      id: string; name: string; slug: string;
      city: string; state: string; modality: string; application_fee_usd: number;
    } | null;

    const scholarshipLevel = appRow.institution_scholarships as {
      id: string; placement_fee_usd: number; discount_percent: number;
      tuition_annual_usd: number; monthly_migma_usd: number; installments_total: number;
      institution_courses: { course_name: string; degree_level: string } | null;
    } | null;

    const course = scholarshipLevel?.institution_courses ?? null;

    const processMapping: Record<string, string> = {
      cos: "change_of_status",
      transfer: "transfer",
      initial: "initial",
      reinstatement: "reinstatement",
      change_of_status: "change_of_status",
    };
    const rawProcessType = profile.student_process_type ?? profile.service_type ?? "";
    const mappedProcess = processMapping[rawProcessType] ?? rawProcessType;

    const placementFeePaid = !!appRow.placement_fee_paid_at;

    console.log(`[sync-to-matriculausa] Starting sync — profile: ${profile.email} | institution: ${institution?.name} | scholarship: ${scholarshipLevel?.discount_percent}% | placementFeePaid: ${placementFeePaid}`);

    // ── Validate credentials ─────────────────────────────────────────────────

    if (!matriculaUrl || !matriculaKey) {
      console.warn("[sync-to-matriculausa] Missing MatriculaUSA credentials — skipping");
      return new Response(JSON.stringify({ success: true, skipped: true, reason: "no_matricula_credentials" }), {
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const matricula = createClient(matriculaUrl, matriculaKey);

    // ── STEP 1: Create or find MatriculaUSA auth user ────────────────────────

    const { data: authUser, error: authErr } = await matricula.auth.admin.createUser({
      email: profile.email,
      password: crypto.randomUUID(),
      email_confirm: true,
      user_metadata: { full_name: profile.full_name, source: "migma" },
    });

    let remoteUserId = authUser?.user?.id;

    if (authErr && (authErr.message?.includes("already registered") || (authErr as any).status === 422)) {
      const { data: existing } = await matricula
        .from("user_profiles")
        .select("user_id")
        .eq("email", profile.email)
        .maybeSingle();
      remoteUserId = existing?.user_id;
    }

    if (!remoteUserId) throw new Error("Could not create or find MatriculaUSA auth user");

    // Wait for auth propagation
    await new Promise((r) => setTimeout(r, 800));

    // Fetch MatriculaUSA user_profiles.id (needed for scholarship_applications.student_id)
    const { data: remoteProfile } = await matricula
      .from("user_profiles")
      .select("id")
      .eq("user_id", remoteUserId)
      .maybeSingle();

    const remoteProfileId = remoteProfile?.id;
    if (!remoteProfileId) throw new Error("MatriculaUSA user_profiles record not found after auth creation");

    // ── STEP 2: PATCH user_profiles (basic data + seller/agent) ─────────────

    const profilePatch: Record<string, unknown> = {
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
      migma_seller_id: profile.migma_seller_id || null,
      migma_agent_id: profile.migma_agent_id || null,
    };

    const step2Res = await fetch(
      `${matriculaUrl}/rest/v1/user_profiles?user_id=eq.${remoteUserId}`,
      {
        method: "PATCH",
        headers: {
          apikey: matriculaKey,
          Authorization: `Bearer ${matriculaKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(profilePatch),
      }
    );

    if (!step2Res.ok) {
      const txt = await step2Res.text();
      throw new Error(`STEP 2 (user_profiles PATCH) failed: ${step2Res.status} ${txt}`);
    }
    console.log(`[sync-to-matriculausa] STEP 2 ✅ user_profiles patched`);

    // ── STEP 3: Lookup university by slug (Caroline/Oikos already exist) ────────

    let remoteUniversityId: string | null = null;

    if (institution?.slug) {
      const { data: existingUniv } = await matricula
        .from("universities")
        .select("id")
        .eq("slug", institution.slug)
        .maybeSingle();

      remoteUniversityId = existingUniv?.id ?? null;
      if (remoteUniversityId) {
        console.log(`[sync-to-matriculausa] STEP 3 ✅ university found: ${remoteUniversityId} (${institution.slug})`);
      } else {
        console.warn(`[sync-to-matriculausa] STEP 3 ⚠️ university not found for slug: ${institution.slug}`);
      }
    }

    // ── STEP 4: Upsert scholarship (is_active=false — private, not in public catalog) ──

    let remoteScholarshipId: string | null = null;

    if (scholarshipLevel && remoteUniversityId) {
      // Try to find existing scholarship by (university_id + placement_fee + tuition)
      // to avoid duplicates on re-sync
      const { data: existingScholarship } = await matricula
        .from("scholarships")
        .select("id")
        .eq("university_id", remoteUniversityId)
        .eq("placement_fee_amount", scholarshipLevel.placement_fee_usd)
        .eq("annual_value_with_scholarship", scholarshipLevel.tuition_annual_usd)
        .maybeSingle();

      if (existingScholarship?.id) {
        remoteScholarshipId = existingScholarship.id;
        console.log(`[sync-to-matriculausa] STEP 4 ✅ scholarship found: ${remoteScholarshipId}`);
      } else {
        const degreeLevel = course?.degree_level ?? "graduate";
        const degreeLevelMapped =
          degreeLevel === "bachelor" ? "undergraduate" :
          degreeLevel === "masters"  ? "graduate" :
          degreeLevel === "phd"      ? "doctorate" : "graduate";

        const { data: newScholarship, error: scholErr } = await matricula
          .from("scholarships")
          .insert({
            university_id: remoteUniversityId,
            title: course?.course_name
              ? `${course.course_name} — ${scholarshipLevel.discount_percent}% Scholarship (Migma)`
              : `${institution?.name} — ${scholarshipLevel.discount_percent}% Scholarship (Migma)`,
            field_of_study: course?.course_name ?? null,
            level: degreeLevelMapped,
            placement_fee_amount: scholarshipLevel.placement_fee_usd,
            application_fee_amount: institution?.application_fee_usd ?? 350,
            annual_value_with_scholarship: scholarshipLevel.tuition_annual_usd,
            original_annual_value: null,
            is_active: false, // ← PRIVATE: not visible in public catalog
          })
          .select("id")
          .single();

        if (scholErr) {
          console.warn(`[sync-to-matriculausa] STEP 4 ⚠️ scholarship insert failed: ${scholErr.message} — continuing without scholarship`);
        } else {
          remoteScholarshipId = newScholarship?.id ?? null;
          console.log(`[sync-to-matriculausa] STEP 4 ✅ scholarship created (private): ${remoteScholarshipId}`);
        }
      }
    }

    // ── STEP 5: Upsert scholarship_applications ──────────────────────────────

    let remoteApplicationId: string | null = null;

    if (remoteProfileId && remoteScholarshipId) {
      const applicationPayload: Record<string, unknown> = {
        student_id: remoteProfileId,
        scholarship_id: remoteScholarshipId,
        status: "approved",
        applied_at: appRow.admin_approved_at ?? new Date().toISOString(),
        reviewed_at: appRow.admin_approved_at ?? new Date().toISOString(),
        student_process_type: mappedProcess,
        source: "migma",
        is_application_fee_paid: false,
        is_scholarship_fee_paid: false,
        payment_status: placementFeePaid ? "paid" : "pending",
        notes: `Migma sync | scholarship_level_id: ${scholarshipLevel?.id} | placement_fee: $${scholarshipLevel?.placement_fee_usd} | discount: ${scholarshipLevel?.discount_percent}%`,
      };

      if (profile.migma_seller_id) applicationPayload.seller_id = profile.migma_seller_id;

      const { data: existingApp } = await matricula
        .from("scholarship_applications")
        .select("id")
        .eq("student_id", remoteProfileId)
        .eq("scholarship_id", remoteScholarshipId)
        .maybeSingle();

      if (existingApp?.id) {
        // Update existing
        await matricula
          .from("scholarship_applications")
          .update(applicationPayload)
          .eq("id", existingApp.id);
        remoteApplicationId = existingApp.id;
        console.log(`[sync-to-matriculausa] STEP 5 ✅ scholarship_applications updated: ${remoteApplicationId}`);
      } else {
        const { data: newApp, error: appInsertErr } = await matricula
          .from("scholarship_applications")
          .insert(applicationPayload)
          .select("id")
          .single();

        if (appInsertErr) {
          console.warn(`[sync-to-matriculausa] STEP 5 ⚠️ scholarship_applications insert failed: ${appInsertErr.message}`);
        } else {
          remoteApplicationId = newApp?.id ?? null;
          console.log(`[sync-to-matriculausa] STEP 5 ✅ scholarship_applications created: ${remoteApplicationId}`);
        }
      }
    } else {
      console.warn(`[sync-to-matriculausa] STEP 5 ⏭️ skipped — remoteProfileId: ${remoteProfileId} | remoteScholarshipId: ${remoteScholarshipId}`);
    }

    // ── STEP 6: PATCH user_profiles with final pointers ─────────────────────

    if (remoteScholarshipId || remoteApplicationId || remoteUniversityId) {
      const finalPatch: Record<string, unknown> = {};
      if (remoteUniversityId) finalPatch.university_id = remoteUniversityId;
      if (remoteScholarshipId) finalPatch.selected_scholarship_id = remoteScholarshipId;
      if (remoteApplicationId) finalPatch.selected_application_id = remoteApplicationId;

      const step6Res = await fetch(
        `${matriculaUrl}/rest/v1/user_profiles?user_id=eq.${remoteUserId}`,
        {
          method: "PATCH",
          headers: {
            apikey: matriculaKey,
            Authorization: `Bearer ${matriculaKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(finalPatch),
        }
      );

      if (!step6Res.ok) {
        const txt = await step6Res.text();
        console.warn(`[sync-to-matriculausa] STEP 6 ⚠️ final pointers PATCH failed: ${step6Res.status} ${txt}`);
      } else {
        console.log(`[sync-to-matriculausa] STEP 6 ✅ user_profiles updated with scholarship/application/university pointers`);
      }
    }

    // ── STEP 7: Save matricula_user_id back to Migma ─────────────────────────

    await migma
      .from("user_profiles")
      .update({ matricula_user_id: remoteUserId })
      .eq("id", profile.id);

    console.log(`[sync-to-matriculausa] ✅ Sync complete for ${profile.email}`);

    return new Response(
      JSON.stringify({
        success: true,
        matricula_user_id: remoteUserId,
        matricula_profile_id: remoteProfileId,
        remote_university_id: remoteUniversityId,
        remote_scholarship_id: remoteScholarshipId,
        remote_application_id: remoteApplicationId,
      }),
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
