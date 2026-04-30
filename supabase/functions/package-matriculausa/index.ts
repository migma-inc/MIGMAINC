import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { zipSync, strToU8 } from "npm:fflate@^0.8.2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Form type display order for ZIP naming
const FORM_ORDER: Record<string, string> = {
  application_for_admission:                  "01_Application_for_Admission",
  i20_request_form:                           "02_I20_Request_Form",
  letter_of_recommendation:                   "03_Letter_of_Recommendation",
  affidavit_of_financial_support:             "04_Affidavit_of_Financial_Support",
  tuition_refund_policy:                      "05_Tuition_Refund_Policy",
  statement_of_institutional_purpose:         "06_Statement_of_Institutional_Purpose",
  scholarship_support_compliance_agreement:   "07_Scholarship_Support_Compliance_Agreement",
  enrollment_agreement:                       "05_Enrollment_Agreement",
  all_statements_and_agreement:               "06_All_Statements_and_Agreement",
  statement_of_faith:                         "06_Statement_of_Faith",
  code_of_conduct:                            "07_Code_of_Conduct",
  refund_policy:                              "08_Refund_Policy",
  agreement_to_complete_mandatory_intensives: "09_Agreement_Mandatory_Intensives",
  christian_faith_statement:                  "10_Christian_Faith_Statement",
  // termo_responsabilidade_estudante is intentionally excluded from the package
};

interface Payload {
  application_id: string;
  force?: boolean; // skip "all signed" check — for testing
}

// Extract storage path from a Supabase storage URL
// Handles both public and signed URL formats
function extractStoragePath(url: string, bucket: string): string | null {
  try {
    const patterns = [
      `/storage/v1/object/public/${bucket}/`,
      `/storage/v1/object/sign/${bucket}/`,
      `/storage/v1/object/authenticated/${bucket}/`,
    ];
    for (const pattern of patterns) {
      const idx = url.indexOf(pattern);
      if (idx !== -1) {
        const raw = url.slice(idx + pattern.length);
        return raw.split("?")[0]; // strip query params (signed URL token)
      }
    }
    return null;
  } catch {
    return null;
  }
}

async function downloadFromStorage(
  supabase: any,
  bucket: string,
  url: string,
): Promise<Uint8Array | null> {
  const path = extractStoragePath(url, bucket);
  if (!path) {
    console.warn(`[package-matriculausa] Could not extract path from URL: ${url}`);
    return null;
  }
  try {
    const { data, error } = await supabase.storage.from(bucket).download(path);
    if (error || !data) {
      console.warn(`[package-matriculausa] Storage download failed for ${path}:`, error?.message);
      return null;
    }
    return new Uint8Array(await data.arrayBuffer());
  } catch (err: any) {
    console.warn(`[package-matriculausa] Download error for ${path}:`, err.message);
    return null;
  }
}

async function fetchExternalFileBytes(url: string): Promise<Uint8Array | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`[package-matriculausa] Failed to fetch ${url}: ${res.status}`);
      return null;
    }
    return new Uint8Array(await res.arrayBuffer());
  } catch (err: any) {
    console.warn(`[package-matriculausa] Fetch error for ${url}:`, err.message);
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const supabaseUrl = Deno.env.get("REMOTE_SUPABASE_URL") ?? Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("REMOTE_SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const { application_id, force = false }: Payload = await req.json();

    if (!application_id) {
      return new Response(JSON.stringify({ error: "application_id is required" }), { status: 400, headers: CORS });
    }

    // ── 1. Fetch application ─────────────────────────────────────────────────
    const { data: app, error: appErr } = await supabase
      .from("institution_applications")
      .select(`
        id, profile_id, institution_id, forms_status,
        institutions (id, name, slug),
        institution_scholarships (
          institution_courses (course_name, degree_level)
        )
      `)
      .eq("id", application_id)
      .single();

    if (appErr || !app) {
      return new Response(JSON.stringify({ error: "Application not found", detail: appErr?.message }), { status: 404, headers: CORS });
    }

    // ── 2. Fetch user profile ────────────────────────────────────────────────
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("id, full_name, email, student_process_type")
      .eq("id", app.profile_id)
      .single();

    const clientName = (profile?.full_name ?? "Cliente").replace(/\s+/g, "_");
    const institution = app.institutions as any;
    const course      = (app.institution_scholarships as any)?.institution_courses ?? null;

    // ── 3. Fetch institution forms (exclude internal document) ───────────────
    const { data: forms, error: formsErr } = await supabase
      .from("institution_forms")
      .select("id, form_type, template_url, signed_url, signed_at")
      .eq("application_id", application_id)
      .neq("form_type", "termo_responsabilidade_estudante");

    if (formsErr || !forms?.length) {
      return new Response(
        JSON.stringify({ error: "No forms found. Run generate-institution-forms first." }),
        { status: 422, headers: CORS }
      );
    }

    // ── 4. Check all forms signed (unless forced) ────────────────────────────
    if (!force) {
      const unsigned = forms.filter((f) => !f.signed_url);
      if (unsigned.length > 0) {
        return new Response(
          JSON.stringify({
            error: "Not all forms are signed",
            unsigned_forms: unsigned.map((f) => f.form_type),
            tip: "Pass force:true to build package with unsigned forms (testing only)",
          }),
          { status: 422, headers: CORS }
        );
      }
    }

    // ── 5. Fetch approved student documents + global document requests ─────
    const [studentDocsRes, requestDocsRes] = await Promise.all([
      supabase
        .from("student_documents")
        .select("type, file_url, original_filename, status")
        .eq("user_id", app.profile_id)
        .eq("status", "approved"),
      supabase
        .from("global_document_requests")
        .select("document_type, submitted_url, status")
        .eq("profile_id", app.profile_id)
        .eq("status", "approved"),
    ]);

    const studentDocs = studentDocsRes.data;
    const requestDocs = requestDocsRes.data;

    // ── 6. Mark as building ──────────────────────────────────────────────────
    await supabase
      .from("institution_applications")
      .update({ package_status: "building" })
      .eq("id", application_id);

    // ── 7. Assemble ZIP ──────────────────────────────────────────────────────
    const zipFiles: Record<string, Uint8Array> = {};
    let formsAdded = 0;
    let docsAdded  = 0;

    // 7a. Institution forms (private bucket — download via storage client)
    for (const form of forms) {
      const fileUrl = form.signed_url ?? form.template_url;
      if (!fileUrl) continue;

      const bytes = await downloadFromStorage(supabase, "institution-forms", fileUrl);
      if (!bytes) continue;

      const label = FORM_ORDER[form.form_type] ?? form.form_type;
      zipFiles[`formularios/${label}.pdf`] = bytes;
      formsAdded++;
    }

    // 7b. Student documents (external URLs — fetch directly)
    if (studentDocs?.length) {
      for (const doc of studentDocs) {
        if (!doc.file_url) continue;
        const bytes = await fetchExternalFileBytes(doc.file_url);
        if (!bytes) continue;

        const ext      = doc.original_filename?.split(".").pop() ?? "pdf";
        const docLabel = (doc.type ?? "documento").replace(/[^a-z0-9_]/gi, "_");
        zipFiles[`documentos/${docLabel}.${ext}`] = bytes;
        docsAdded++;
      }
    }

    // 7c. Global document requests (external URLs — fetch directly)
    if (requestDocs?.length) {
      for (const doc of requestDocs) {
        if (!doc.submitted_url) continue;
        const bytes = await fetchExternalFileBytes(doc.submitted_url);
        if (!bytes) continue;

        const ext = doc.submitted_url.split(".").pop()?.split("?")[0] ?? "pdf";
        const docLabel = (doc.document_type ?? "documento").replace(/[^a-z0-9_]/gi, "_");
        zipFiles[`documentos/${docLabel}.${ext}`] = bytes;
        docsAdded++;
      }
    }

    // 7d. README with client summary
    const today = new Date().toLocaleDateString("pt-BR");
    const readme = `MIGMA INC - Pacote de Candidatura
=====================================
Cliente:      ${profile?.full_name ?? "-"}
Email:        ${profile?.email ?? "-"}
Instituicao:  ${institution?.name ?? "-"}
Curso:        ${course?.course_name ?? "-"} (${course?.degree_level ?? "-"})
Processo:     ${profile?.student_process_type ?? "-"}
Gerado em:    ${today}

Conteudo do pacote:
  - formularios/ : ${formsAdded} formulario(s) ${force ? "(pode conter nao-assinados - modo forcado)" : "assinados"}
  - documentos/  : ${docsAdded} documento(s) do aluno

INSTRUCOES PARA O ADMIN:
1. Acesse o portal do MatriculaUSA
2. Selecione o estudante (ou crie se ainda nao existir)
3. Faca o upload de todos os arquivos da pasta /formularios
4. Faca o upload dos documentos da pasta /documentos
5. Marque o pacote como enviado no sistema Migma

NOTA FUTURA:
Este processo sera automatizado via API do MatriculaUSA
quando os endpoints de upload estiverem disponiveis.
`;
    zipFiles["README.txt"] = strToU8(readme);

    // 7e. Build ZIP synchronously (fflate zipSync)
    const zipBytes = zipSync(zipFiles, { level: 6 });

    // ── 8. Upload ZIP to Storage ─────────────────────────────────────────────
    const dateTag   = new Date().toISOString().split("T")[0].replace(/-/g, "");
    const zipPath   = `${app.profile_id}/${application_id}_${dateTag}.zip`;
    const zipName   = `MIGMA_${clientName}_${dateTag}.zip`;

    const { error: uploadErr } = await supabase.storage
      .from("matriculausa-packages")
      .upload(zipPath, zipBytes, { contentType: "application/zip", upsert: true });

    if (uploadErr) {
      console.error("[package-matriculausa] Storage upload error:", uploadErr.message);
      await supabase.from("institution_applications").update({ package_status: "pending" }).eq("id", application_id);
      return new Response(JSON.stringify({ error: "Storage upload failed", detail: uploadErr.message }), { status: 500, headers: CORS });
    }

    // Signed URL valid for 7 days (for admin to download)
    const { data: signedData, error: signedErr } = await supabase.storage
      .from("matriculausa-packages")
      .createSignedUrl(zipPath, 60 * 60 * 24 * 7);

    const downloadUrl = signedData?.signedUrl ?? null;

    // ── 9. Update application ────────────────────────────────────────────────
    const now = new Date().toISOString();
    await supabase
      .from("institution_applications")
      .update({
        package_status:      "ready",
        package_storage_url: downloadUrl,
        package_sent_at:     now,
      })
      .eq("id", application_id);

    // ── 10. Send package to MatriculaUSA automatically ──────────────────────
    const matriculaUsaFunctionsUrl = Deno.env.get("MATRICULAUSA_FUNCTIONS_URL");
    const migmaWebhookSecret = Deno.env.get("MIGMA_WEBHOOK_SECRET");
    const matriculaUsaServiceRole = Deno.env.get("MATRICULAUSA_SERVICE_ROLE");

    if (matriculaUsaFunctionsUrl && migmaWebhookSecret && matriculaUsaServiceRole && downloadUrl) {
      // Build individual file list to send alongside the ZIP
      const packageFiles: { name: string; url: string; type: string; category: string }[] = [];

      for (const form of forms) {
        const fileUrl = form.signed_url ?? form.template_url;
        if (!fileUrl) continue;
        const label = FORM_ORDER[form.form_type] ?? form.form_type;
        packageFiles.push({ name: `${label}.pdf`, url: fileUrl, type: "formulario", category: "formularios" });
      }

      const SIGNED_URL_TTL = 60 * 60 * 24 * 365 * 10; // 10 years

      if (studentDocs?.length) {
        for (const doc of studentDocs) {
          if (!doc.file_url) continue;
          const ext = doc.original_filename?.split(".").pop() ?? "pdf";
          const docLabel = (doc.type ?? "documento").replace(/[^a-z0-9_]/gi, "_");

          // Generate signed URL so MatriculaUSA can access private storage
          let signedUrl = doc.file_url;
          const storagePath = extractStoragePath(doc.file_url, "migma-student-documents");
          if (storagePath) {
            const { data: sd } = await supabase.storage
              .from("migma-student-documents")
              .createSignedUrl(storagePath, SIGNED_URL_TTL);
            if (sd?.signedUrl) signedUrl = sd.signedUrl;
          }

          packageFiles.push({ name: `${docLabel}.${ext}`, url: signedUrl, type: "documento", category: "documentos" });
        }
      }

      if (requestDocs?.length) {
        for (const doc of requestDocs) {
          if (!doc.submitted_url) continue;
          const ext = doc.submitted_url.split(".").pop()?.split("?")[0] ?? "pdf";
          const docLabel = (doc.document_type ?? "documento").replace(/[^a-z0-9_]/gi, "_");

          // Generate signed URL so MatriculaUSA can access private storage
          let signedUrl = doc.submitted_url;
          const storagePath = extractStoragePath(doc.submitted_url, "migma-student-documents");
          if (storagePath) {
            const { data: sd } = await supabase.storage
              .from("migma-student-documents")
              .createSignedUrl(storagePath, SIGNED_URL_TTL);
            if (sd?.signedUrl) signedUrl = sd.signedUrl;
          }

          packageFiles.push({ name: `${docLabel}.${ext}`, url: signedUrl, type: "documento", category: "documentos" });
        }
      }

      const zipExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      try {
        const res = await fetch(`${matriculaUsaFunctionsUrl}/receive-migma-package`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${matriculaUsaServiceRole}`,
            "x-migma-webhook-secret": migmaWebhookSecret,
          },
          body: JSON.stringify({
            student_email: profile?.email ?? "",
            student_name: profile?.full_name ?? "",
            migma_application_id: application_id,
            zip_url: downloadUrl,
            zip_expires_at: zipExpiresAt,
            process_type: profile?.student_process_type ?? null,
            files: packageFiles,
          }),
        });

        if (!res.ok) {
          console.warn(`[package-matriculausa] MatriculaUSA notify failed: ${res.status} ${await res.text()}`);
        } else {
          console.log(`[package-matriculausa] Package sent to MatriculaUSA successfully`);
          // Update package_status to 'sent'
          await supabase
            .from("institution_applications")
            .update({ package_status: "sent" })
            .eq("id", application_id);
        }
      } catch (notifyErr: any) {
        // Non-fatal: log and continue
        console.warn(`[package-matriculausa] Could not reach MatriculaUSA: ${notifyErr.message}`);
      }
    } else {
      console.log("[package-matriculausa] MATRICULAUSA_FUNCTIONS_URL, MIGMA_WEBHOOK_SECRET or MATRICULAUSA_SERVICE_ROLE not set — skipping auto-send");
    }

    // ── 11. Notify client ─────────────────────────────────────────────────────
    await supabase.functions.invoke("migma-notify", {
      body: {
        trigger: "package_sent_matriculausa",
        user_id: app.profile_id,
      },
    });

    console.log(`[package-matriculausa] Done. ${formsAdded} forms + ${docsAdded} docs → ${zipName}`);

    return new Response(
      JSON.stringify({
        success:      true,
        zip_name:     zipName,
        download_url: downloadUrl,
        forms_added:  formsAdded,
        docs_added:   docsAdded,
        expires_in:   "7 days",
      }),
      { status: 200, headers: { ...CORS, "Content-Type": "application/json" } }
    );

  } catch (err: any) {
    console.error("[package-matriculausa] Unhandled error:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: CORS });
  }
});
