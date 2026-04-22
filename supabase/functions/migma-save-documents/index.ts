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

    return new Response(JSON.stringify({ success: true, count: documents.length }), { headers: { ...CORS, "Content-Type": "application/json" } });

  } catch (err: any) {
    console.error("[migma-save-documents] Erro local:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...CORS, "Content-Type": "application/json" } });
  }
});
