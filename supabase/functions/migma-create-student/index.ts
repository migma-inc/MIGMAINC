import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * migma-create-student (V33 - Mapping Edition)
 * Converte códigos de URL (cos) para valores de banco (change_of_status).
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const migmaUrl = Deno.env.get("SUPABASE_URL")!;
  const migmaKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const migma = createClient(migmaUrl, migmaKey);

  const matriculaUrl = Deno.env.get("MATRICULAUSA_URL");
  const matriculaKey = Deno.env.get("MATRICULAUSA_SERVICE_ROLE");

  try {
    const body = await req.json();
    const { email, full_name, phone, migma_user_id, service_type, country, nationality } = body;

    // 🗺️ MAPA DE CONVERSÃO PARA MATRÍCULA USA
    const processMapping: Record<string, string> = {
      'cos': 'change_of_status',
      'transfer': 'transfer',
      'initial': 'initial',
      'reinstatement': 'reinstatement'
    };
    const mappedProcess = processMapping[service_type] || service_type;

    console.log(`[migma-create-student] Sync ${email}. Mapping: ${service_type} -> ${mappedProcess}`);

    // 1. Salva Local na Migma
    await migma.from("user_profiles").upsert({
      user_id: migma_user_id,
      email, full_name, phone, service_type,
      country, nationality,
      student_process_type: service_type,
      source: 'migma',
      migma_seller_id: body.migma_seller_id || null,
      migma_agent_id: body.migma_agent_id || null
    });

    if (matriculaUrl && matriculaKey) {
      const matricula = createClient(matriculaUrl, matriculaKey);

      // A. Auth Remoto
      const { data: authUser, error: authErr } = await matricula.auth.admin.createUser({
        email,
        password: crypto.randomUUID(),
        email_confirm: true,
        user_metadata: { full_name, source: 'migma' }
      });

      let remoteId = authUser?.user?.id;
      if (authErr && (authErr.message.includes("already registered") || authErr.status === 422)) {
         const { data: existing } = await matricula.from("user_profiles").select("user_id").eq("email", email).maybeSingle();
         remoteId = existing?.user_id;
      }

      if (remoteId) {
        await new Promise(r => setTimeout(r, 800));

        // B. Sync Remoto (PATCH Único e Estável)
        const remoteProfileData = {
          full_name,
          phone: phone || "",
          country: country || null,
          student_process_type: mappedProcess, // <--- VALOR MAPEADO
          status: 'active',
          role: 'student',
          source: 'migma',
          dependents: body.num_dependents || 0,
          placement_fee_flow: true
        };

        const profileRes = await fetch(`${matriculaUrl}/rest/v1/user_profiles?user_id=eq.${remoteId}`, {
          method: "PATCH",
          headers: {
            "apikey": matriculaKey,
            "Authorization": `Bearer ${matriculaKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify(remoteProfileData)
        });

        console.log(`[migma-create-student] Sync Remoto Finalizado. Status: ${profileRes.status}`);

        await migma.from("user_profiles").update({ matricula_user_id: remoteId }).eq("user_id", migma_user_id);
      }
    }

    return new Response(JSON.stringify({ success: true }), { headers: { ...CORS, "Content-Type": "application/json" } });
  } catch (err: any) {
    console.error("[migma-create-student] Erro Fatal:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...CORS, "Content-Type": "application/json" } });
  }
});
