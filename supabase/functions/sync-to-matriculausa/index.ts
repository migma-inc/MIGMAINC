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

  const executionId = Date.now().toString().slice(-6);

  try {
    console.log(`[SYNC-${executionId}] 🚀 Iniciando sincronização...`);
    
    const body = await req.json();
    console.log(`[SYNC-${executionId}] 📦 Payload recebido:`, JSON.stringify(body));

    const { application_id } = body;
    if (!application_id) {
      console.error(`[SYNC-${executionId}] ❌ Erro: application_id ausente no payload`);
      return new Response(JSON.stringify({ error: "application_id required" }), {
        status: 400, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    // ── Load Migma data ──────────────────────────────────────────────────────
    console.log(`[SYNC-${executionId}] 🔍 Buscando dados na Migma para app_id: ${application_id}`);

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

    if (appErr || !appRow) {
      console.error(`[SYNC-${executionId}] ❌ Erro ao buscar institution_applications:`, appErr?.message || "Registro não encontrado");
      throw new Error(`application not found: ${appErr?.message}`);
    }
    console.log(`[SYNC-${executionId}] ✅ Dados da aplicação recuperados. Profile ID: ${appRow.profile_id}`);

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

    if (profErr || !profile) {
      console.error(`[SYNC-${executionId}] ❌ Erro ao buscar user_profiles:`, profErr?.message || "Perfil não encontrado");
      throw new Error(`profile not found: ${profErr?.message}`);
    }
    console.log(`[SYNC-${executionId}] ✅ Perfil recuperado: ${profile.email}`);

    const { data: identity } = await migma
      .from("user_identity")
      .select("country")
      .eq("user_id", profile.user_id)
      .maybeSingle();
    
    if (identity) {
      console.log(`[SYNC-${executionId}] 📍 Identidade encontrada. País: ${identity.country}`);
    } else {
      console.log(`[SYNC-${executionId}] 📍 Nenhuma identidade encontrada para user_id: ${profile.user_id}`);
    }

    // ── Type helpers ─────────────────────────────────────────────────────────

    const institution = appRow.institutions as {
      id: string; name: string; slug: string;
      city: string; state: string; modality: string; application_fee_usd: number;
    } | null;

    // institution_scholarships may come as array (one-to-many via PostgREST) — normalize to single object
    const rawScholarship = appRow.institution_scholarships;
    const scholarshipLevel = (Array.isArray(rawScholarship) ? rawScholarship[0] : rawScholarship) as {
      id: string; placement_fee_usd: number; discount_percent: number;
      tuition_annual_usd: number; monthly_migma_usd: number; installments_total: number;
      institution_courses: { course_name: string; degree_level: string } | null;
    } | null;

    console.log(`[SYNC-${executionId}] 🎓 scholarshipLevel raw:`, JSON.stringify(rawScholarship));
    console.log(`[SYNC-${executionId}] 🎓 placement_fee_usd lido: $${scholarshipLevel?.placement_fee_usd}`);

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

    // Dependentes lidos diretamente do perfil — fonte única de verdade
    const numDependents = profile.num_dependents ?? 0;
    const applicationFeeAmount = 350 + numDependents * 100;

    console.log(`[SYNC-${executionId}] 👨‍👩‍👧 Dependentes: ${numDependents} | Application Fee calculada: $${applicationFeeAmount}`);

    console.log(`[SYNC-${executionId}] 📊 Resumo do Sync:
      Email: ${profile.email}
      Instituição: ${institution?.name} (Slug: ${institution?.slug})
      Bolsa: ${scholarshipLevel?.discount_percent}%
      Placement Fee Pago: ${placementFeePaid}
      Processo Mapeado: ${mappedProcess}`);

    // ── Validate credentials ─────────────────────────────────────────────────

    if (!matriculaUrl || !matriculaKey) {
      console.warn(`[SYNC-${executionId}] ⚠️ Credenciais do MatriculaUSA ausentes (URL ou Key). Pulando sync remoto.`);
      return new Response(JSON.stringify({ success: true, skipped: true, reason: "no_matricula_credentials" }), {
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const matricula = createClient(matriculaUrl, matriculaKey);

    // ── STEP 1: Create or find MatriculaUSA auth user ────────────────────────
    console.log(`[SYNC-${executionId}] [PASSO 1] Criando/Buscando usuário Auth no MatriculaUSA para: ${profile.email}`);

    const { data: authUser, error: authErr } = await matricula.auth.admin.createUser({
      email: profile.email,
      password: crypto.randomUUID(),
      email_confirm: true,
      user_metadata: { full_name: profile.full_name, source: "migma" },
    });

    let remoteUserId = authUser?.user?.id;

    if (authErr) {
      if (authErr.message?.includes("already registered") || (authErr as any).status === 422) {
        console.log(`[SYNC-${executionId}] [PASSO 1] Usuário já registrado no Auth. Buscando no user_profiles...`);
        const { data: existing, error: findErr } = await matricula
          .from("user_profiles")
          .select("user_id")
          .eq("email", profile.email)
          .maybeSingle();
        
        if (findErr) console.error(`[SYNC-${executionId}] [PASSO 1] Erro ao buscar perfil existente:`, findErr.message);
        remoteUserId = existing?.user_id;
      } else {
        console.error(`[SYNC-${executionId}] [PASSO 1] ❌ Erro ao criar usuário Auth:`, authErr.message);
      }
    }

    if (!remoteUserId) {
      console.error(`[SYNC-${executionId}] [PASSO 1] ❌ Falha crítica: remoteUserId não obtido.`);
      throw new Error("Could not create or find MatriculaUSA auth user");
    }
    console.log(`[SYNC-${executionId}] [PASSO 1] ✅ Remote User ID: ${remoteUserId}`);

    // Wait for auth propagation
    console.log(`[SYNC-${executionId}] ⏳ Aguardando propagação do Auth (800ms)...`);
    await new Promise((r) => setTimeout(r, 800));

    // Fetch MatriculaUSA user_profiles.id (needed for scholarship_applications.student_id)
    console.log(`[SYNC-${executionId}] [PASSO 1b] Buscando ID interno do perfil no MatriculaUSA...`);
    const { data: remoteProfile, error: remoteProfErr } = await matricula
      .from("user_profiles")
      .select("id")
      .eq("user_id", remoteUserId)
      .maybeSingle();

    if (remoteProfErr) console.error(`[SYNC-${executionId}] [PASSO 1b] Erro ao buscar ID do perfil remoto:`, remoteProfErr.message);

    const remoteProfileId = remoteProfile?.id;
    if (!remoteProfileId) {
      console.error(`[SYNC-${executionId}] [PASSO 1b] ❌ Erro: Registro user_profiles não encontrado após criação do Auth.`);
      throw new Error("MatriculaUSA user_profiles record not found after auth creation");
    }
    console.log(`[SYNC-${executionId}] [PASSO 1b] ✅ Remote Profile ID: ${remoteProfileId}`);

    // ── STEP 2: PATCH user_profiles (basic data + seller/agent) ─────────────
    console.log(`[SYNC-${executionId}] [PASSO 2] Atualizando dados básicos do perfil no MatriculaUSA...`);

    const profilePatch: Record<string, unknown> = {
      full_name: profile.full_name,
      phone: profile.phone || "",
      country: identity?.country || profile.country || null,
      student_process_type: mappedProcess,
      status: "active",
      role: "student",
      source: "migma",
      dependents: numDependents,
      placement_fee_flow: true,
      selection_survey_passed: profile.selection_survey_passed ?? false,
      migma_seller_id: profile.migma_seller_id || null,
      migma_agent_id: profile.migma_agent_id || null,
    };

    console.log(`[SYNC-${executionId}] [PASSO 2] Enviando PATCH para /user_profiles?user_id=eq.${remoteUserId}`);
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
      console.error(`[SYNC-${executionId}] [PASSO 2] ❌ Falha no PATCH user_profiles:`, step2Res.status, txt);
      throw new Error(`STEP 2 (user_profiles PATCH) failed: ${step2Res.status} ${txt}`);
    }
    console.log(`[SYNC-${executionId}] [PASSO 2] ✅ user_profiles atualizado.`);

    // ── STEP 3: Lookup university by slug (Caroline/Oikos already exist) ────────
    console.log(`[SYNC-${executionId}] [PASSO 3] Localizando universidade pelo slug: ${institution?.slug}`);

    let remoteUniversityId: string | null = null;

    if (institution?.slug) {
      const { data: existingUniv, error: univErr } = await matricula
        .from("universities")
        .select("id")
        .eq("slug", institution.slug)
        .maybeSingle();

      if (univErr) console.error(`[SYNC-${executionId}] [PASSO 3] Erro ao buscar universidade:`, univErr.message);

      remoteUniversityId = existingUniv?.id ?? null;
      if (remoteUniversityId) {
        console.log(`[SYNC-${executionId}] [PASSO 3] ✅ Universidade encontrada pelo slug: ${remoteUniversityId}`);
      } else {
        // Slug não coincide (ex: Migma usa 'oikos-university', MatriculaUSA usa 'oikos-university-los-angeles')
        // Fallback: buscar por nome parcial
        console.warn(`[SYNC-${executionId}] [PASSO 3] ⚠️ Slug '${institution.slug}' não encontrado. Tentando fallback por nome: '${institution.name}'`);
        const { data: univByName, error: univByNameErr } = await matricula
          .from("universities")
          .select("id, name, slug")
          .ilike("name", `%${institution.name}%`)
          .maybeSingle();

        if (univByNameErr) console.error(`[SYNC-${executionId}] [PASSO 3] Erro no fallback por nome:`, univByNameErr.message);

        if (univByName?.id) {
          remoteUniversityId = univByName.id;
          console.log(`[SYNC-${executionId}] [PASSO 3] ✅ Universidade encontrada pelo nome (slug remoto: '${univByName.slug}'): ${remoteUniversityId}`);
        } else {
          console.error(`[SYNC-${executionId}] [PASSO 3] ❌ Universidade não encontrada nem por slug nem por nome. Verifique se '${institution.name}' existe no MatriculaUSA.`);
        }
      }
    } else {
      console.warn(`[SYNC-${executionId}] [PASSO 3] ⏭️ Pulado: Slug da instituição ausente.`);
    }

    // ── STEP 4: Upsert scholarship per-student (is_active=false — private, not in public catalog) ──
    // Each student gets their own private scholarship so application_fee_amount can differ per student.
    // Dedup strategy: check scholarship_applications by student_id first — if exists, reuse that scholarship.
    console.log(`[SYNC-${executionId}] [PASSO 4] Criando/Buscando bolsa privada por-aluno no MatriculaUSA...`);

    let remoteScholarshipId: string | null = null;

    if (remoteProfileId) {
      // First: check if this student already has an application → reuse that scholarship.
      // This check runs regardless of remoteUniversityId so existing students are never blocked.
      console.log(`[SYNC-${executionId}] [PASSO 4] Verificando se aluno (${remoteProfileId}) já tem aplicação existente...`);
      const { data: existingApp, error: existingAppErr } = await matricula
        .from("scholarship_applications")
        .select("id, scholarship_id")
        .eq("student_id", remoteProfileId)
        .maybeSingle();

      if (existingAppErr) console.error(`[SYNC-${executionId}] [PASSO 4] Erro ao buscar aplicação do aluno:`, existingAppErr.message);

      if (existingApp?.scholarship_id) {
        remoteScholarshipId = existingApp.scholarship_id;
        // Safe to update fee — this scholarship belongs exclusively to this student
        const { error: updateFeeErr } = await matricula
          .from("scholarships")
          .update({ application_fee_amount: applicationFeeAmount })
          .eq("id", remoteScholarshipId);
        if (updateFeeErr) console.warn(`[SYNC-${executionId}] [PASSO 4] ⚠️ Erro ao atualizar application_fee da bolsa:`, updateFeeErr.message);
        console.log(`[SYNC-${executionId}] [PASSO 4] ✅ Bolsa existente do aluno encontrada e fee atualizado ($${applicationFeeAmount}): ${remoteScholarshipId}`);
      } else if (scholarshipLevel && remoteUniversityId) {
        // No existing application — check for orphaned Migma scholarship (sync partial failure recovery)
        const degreeLevel = course?.degree_level ?? "graduate";
        const degreeLevelMapped =
          degreeLevel === "bachelor" ? "undergraduate" :
          degreeLevel === "masters"  ? "graduate" :
          degreeLevel === "phd"      ? "doctorate" : "graduate";

        const expectedTitle = course?.course_name
          ? `${course.course_name} — ${scholarshipLevel.discount_percent}% Scholarship (Migma)`
          : `${institution?.name} — ${scholarshipLevel.discount_percent}% Scholarship (Migma)`;

        // Try to recover orphaned scholarship from a previous partial sync
        const { data: orphanedScholarship } = await matricula
          .from("scholarships")
          .select("id")
          .eq("university_id", remoteUniversityId)
          .eq("title", expectedTitle)
          .eq("is_active", false)
          .maybeSingle();

        if (orphanedScholarship?.id) {
          remoteScholarshipId = orphanedScholarship.id;
          // Update fee to correct current value
          await matricula.from("scholarships")
            .update({ application_fee_amount: applicationFeeAmount })
            .eq("id", remoteScholarshipId);
          console.log(`[SYNC-${executionId}] [PASSO 4] ✅ Bolsa órfã recuperada e fee atualizado ($${applicationFeeAmount}): ${remoteScholarshipId}`);
        } else {
          console.log(`[SYNC-${executionId}] [PASSO 4] Criando nova bolsa privada por-aluno (Degree: ${degreeLevelMapped}, Fee: $${applicationFeeAmount})...`);
          const { data: newScholarship, error: scholErr } = await matricula
            .from("scholarships")
            .insert({
              university_id: remoteUniversityId,
              title: expectedTitle,
              field_of_study: course?.course_name ?? null,
              level: degreeLevelMapped,
              placement_fee_amount: scholarshipLevel.placement_fee_usd,
              application_fee_amount: applicationFeeAmount,
              annual_value_with_scholarship: scholarshipLevel.tuition_annual_usd,
              original_annual_value: null,
              amount: 0,
              deadline: "2099-12-31",
              is_active: false,
            })
            .select("id")
            .single();

          if (scholErr) {
            console.warn(`[SYNC-${executionId}] [PASSO 4] ⚠️ Erro ao inserir bolsa:`, scholErr.message, "— Prosseguindo sem bolsa.");
          } else {
            remoteScholarshipId = newScholarship?.id ?? null;
            console.log(`[SYNC-${executionId}] [PASSO 4] ✅ Bolsa criada: ${remoteScholarshipId}`);
          }
        }
      } else {
        console.warn(`[SYNC-${executionId}] [PASSO 4] ⏭️ Pulado: sem aplicação existente e sem universidade disponível para criar bolsa nova.`);
      }
    } else {
      console.warn(`[SYNC-${executionId}] [PASSO 4] ⏭️ Pulado: remoteProfileId ausente.`);
    }

    // ── STEP 4.5: Upsert user_fee_overrides com application_fee individual ────
    // user_fee_overrides.user_id → auth.users.id (remoteUserId)
    if (remoteUserId) {
      console.log(`[SYNC-${executionId}] [PASSO 4.5] Atualizando user_fee_overrides: application_fee=$${applicationFeeAmount}...`);
      const { error: overrideErr } = await matricula
        .from("user_fee_overrides")
        .upsert(
          { user_id: remoteUserId, application_fee: applicationFeeAmount },
          { onConflict: "user_id" }
        );
      if (overrideErr) {
        console.warn(`[SYNC-${executionId}] [PASSO 4.5] ⚠️ Erro ao upsert user_fee_overrides:`, overrideErr.message);
      } else {
        console.log(`[SYNC-${executionId}] [PASSO 4.5] ✅ user_fee_overrides atualizado.`);
      }
    }

    // ── STEP 5: Upsert scholarship_applications ──────────────────────────────
    console.log(`[SYNC-${executionId}] [PASSO 5] Criando/Atualizando aplicação da bolsa no MatriculaUSA...`);

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

      const isValidUuid = (v: unknown) => typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
      if (isValidUuid(profile.migma_seller_id)) applicationPayload.seller_id = profile.migma_seller_id;
      else if (profile.migma_seller_id) console.warn(`[SYNC-${executionId}] [PASSO 5] ⚠️ migma_seller_id inválido (não UUID): "${profile.migma_seller_id}" — ignorado.`);

      console.log(`[SYNC-${executionId}] [PASSO 5] Verificando aplicação existente para Student=${remoteProfileId} e Scholarship=${remoteScholarshipId}`);
      const { data: existingApp, error: findAppErr } = await matricula
        .from("scholarship_applications")
        .select("id")
        .eq("student_id", remoteProfileId)
        .eq("scholarship_id", remoteScholarshipId)
        .maybeSingle();

      if (findAppErr) console.error(`[SYNC-${executionId}] [PASSO 5] Erro ao buscar aplicação existente:`, findAppErr.message);

      if (existingApp?.id) {
        console.log(`[SYNC-${executionId}] [PASSO 5] Aplicação encontrada: ${existingApp.id}. Atualizando...`);
        const { error: updAppErr } = await matricula
          .from("scholarship_applications")
          .update(applicationPayload)
          .eq("id", existingApp.id);
        
        if (updAppErr) console.error(`[SYNC-${executionId}] [PASSO 5] ❌ Erro ao atualizar aplicação:`, updAppErr.message);
        
        remoteApplicationId = existingApp.id;
        console.log(`[SYNC-${executionId}] [PASSO 5] ✅ Aplicação atualizada.`);
      } else {
        console.log(`[SYNC-${executionId}] [PASSO 5] Criando nova aplicação...`);
        const { data: newApp, error: appInsertErr } = await matricula
          .from("scholarship_applications")
          .insert(applicationPayload)
          .select("id")
          .single();

        if (appInsertErr) {
          console.warn(`[SYNC-${executionId}] [PASSO 5] ⚠️ Erro ao inserir aplicação:`, appInsertErr.message);
        } else {
          remoteApplicationId = newApp?.id ?? null;
          console.log(`[SYNC-${executionId}] [PASSO 5] ✅ Aplicação criada: ${remoteApplicationId}`);
        }
      }
    } else {
      console.warn(`[SYNC-${executionId}] [PASSO 5] ⏭️ Pulado: remoteProfileId ou remoteScholarshipId ausente.`);
    }

    // ── STEP 6: PATCH user_profiles with final pointers ─────────────────────
    console.log(`[SYNC-${executionId}] [PASSO 6] Vinculando ponteiros finais no perfil (Univ/Bolsa/App)...`);

    if (remoteScholarshipId || remoteApplicationId || remoteUniversityId) {
      const finalPatch: Record<string, unknown> = {};
      if (remoteUniversityId) finalPatch.university_id = remoteUniversityId;
      if (remoteScholarshipId) finalPatch.selected_scholarship_id = remoteScholarshipId;
      if (remoteApplicationId) finalPatch.selected_application_id = remoteApplicationId;

      console.log(`[SYNC-${executionId}] [PASSO 6] Enviando PATCH final para /user_profiles?user_id=eq.${remoteUserId}:`, JSON.stringify(finalPatch));
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
        console.warn(`[SYNC-${executionId}] [PASSO 6] ⚠️ PATCH final falhou:`, step6Res.status, txt);
      } else {
        console.log(`[SYNC-${executionId}] [PASSO 6] ✅ Perfil atualizado com ponteiros finais.`);
      }
    } else {
      console.warn(`[SYNC-${executionId}] [PASSO 6] ⏭️ Pulado: nenhum ponteiro para vincular.`);
    }

    // ── STEP 7: Save matricula_user_id back to Migma ─────────────────────────
    console.log(`[SYNC-${executionId}] [PASSO 7] Salvando matricula_user_id (${remoteUserId}) de volta na Migma...`);

    const { error: lastUpdErr } = await migma
      .from("user_profiles")
      .update({ matricula_user_id: remoteUserId })
      .eq("id", profile.id);

    if (lastUpdErr) {
      console.error(`[SYNC-${executionId}] [PASSO 7] ❌ Erro ao salvar matricula_user_id na Migma:`, lastUpdErr.message);
    } else {
      console.log(`[SYNC-${executionId}] [PASSO 7] ✅ Migma atualizada.`);
    }

    console.log(`[SYNC-${executionId}] ✨ Sincronização concluída com sucesso para ${profile.email}!`);

    return new Response(
      JSON.stringify({
        success: true,
        execution_id: executionId,
        matricula_user_id: remoteUserId,
        matricula_profile_id: remoteProfileId,
        remote_university_id: remoteUniversityId,
        remote_scholarship_id: remoteScholarshipId,
        remote_application_id: remoteApplicationId,
      }),
      { headers: { ...CORS, "Content-Type": "application/json" } }
    );

  } catch (err: any) {
    console.error(`[SYNC-${executionId}] 💥 ERRO CRÍTICO FATAL:`, err.message);
    if (err.stack) console.error(`[SYNC-${executionId}] 📚 Stack Trace:`, err.stack);
    
    return new Response(JSON.stringify({ error: err.message, execution_id: executionId }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
