import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * migma-save-documents (V3 - Local Only)
 * Salva documentos apenas na Migma, conforme solicitado.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const migmaUrl = Deno.env.get("SUPABASE_URL")!;
  const migmaKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const migma = createClient(migmaUrl, migmaKey);

  try {
    const body = await req.json();
    const { user_id, documents } = body;

    if (!user_id || !Array.isArray(documents)) {
      throw new Error("Missing user_id or documents array");
    }

    console.log(`[migma-save-documents] Registrando ${documents.length} docs locais para o usuário: ${user_id}`);

    const documentsToInsert = documents.map((doc) => ({
      user_id,
      type: doc.type,
      file_url: doc.file_url,
      original_filename: doc.original_filename,
      file_size_bytes: doc.file_size_bytes,
      status: 'pending',
      source: 'migma',
      uploaded_at: new Date().toISOString(),
    }));

    const { error: upsertErr } = await migma
      .from("student_documents")
      .upsert(documentsToInsert, { onConflict: 'user_id,type', ignoreDuplicates: false });

    if (upsertErr) {
      console.warn("[migma-save-documents] upsert falhou, tentando insert ignorando duplicados:", upsertErr.message);
      await migma.from("student_documents").upsert(documentsToInsert, { ignoreDuplicates: true });
    }

    try {
      const { data: profile, error: profileError } = await migma
        .from("user_profiles")
        .select("id, full_name, email")
        .eq("user_id", user_id)
        .maybeSingle();

      if (profileError || !profile?.id) {
        console.warn(`[migma-save-documents] admin notification skipped: profile not found for auth user ${user_id}`);
      } else {
        // supabase.functions.invoke não passa service role key entre Edge Functions → 401
        const notifyRes = await fetch(`${migmaUrl}/functions/v1/migma-notify`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${migmaKey}`,
            "apikey": migmaKey,
          },
          body: JSON.stringify({
            trigger: "admin_new_documents",
            data: {
              client_name: profile.full_name ?? profile.email ?? "Student",
              client_id: profile.id,
              document_count: documents.length,
            },
          }),
        });

        if (!notifyRes.ok) {
          console.warn(`[migma-save-documents] admin notification failed: ${notifyRes.status}`);
        } else {
          console.log(`[migma-save-documents] ✅ admin_new_documents dispatched for profile ${profile.id}`);
        }
      }
    } catch (notifyErr: any) {
      console.warn(`[migma-save-documents] admin notification failed: ${notifyErr.message}`);
    }

    return new Response(JSON.stringify({ success: true, count: documents.length }), { headers: { ...CORS, "Content-Type": "application/json" } });

  } catch (err: any) {
    console.error("[migma-save-documents] Erro local:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...CORS, "Content-Type": "application/json" } });
  }
});
