import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type ReviewDecision = "approve" | "reject";
type DocumentScope = "student" | "global";
type AggregateStatus = "pending" | "under_review" | "approved" | "rejected";

async function getAggregateDocumentStatus(
  supabase: ReturnType<typeof createClient>,
  profile: { id: string; user_id: string }
): Promise<AggregateStatus> {
  const [{ data: studentDocs, error: studentDocsError }, { data: globalDocs, error: globalDocsError }] = await Promise.all([
    supabase
      .from("student_documents")
      .select("status")
      .eq("user_id", profile.user_id),
    supabase
      .from("global_document_requests")
      .select("status")
      .eq("profile_id", profile.id),
  ]);

  if (studentDocsError) throw new Error(studentDocsError.message);
  if (globalDocsError) throw new Error(globalDocsError.message);

  const statuses = [
    ...(studentDocs ?? []).map((doc) => doc.status ?? "pending"),
    ...(globalDocs ?? []).map((doc) => doc.status ?? "pending"),
  ];

  if (statuses.length === 0) return "pending";
  if (statuses.some((status) => status === "rejected")) return "rejected";
  if (statuses.every((status) => status === "approved")) return "approved";
  return "under_review";
}

function buildNotifyPayload(
  decision: ReviewDecision,
  profile: { id: string; email: string | null; full_name: string | null },
  data: { rejection_reason?: string | null; scope: DocumentScope; document_id?: string | null }
) {
  const documentName =
    data.scope === "global"
      ? "Post-university documents"
      : "Student onboarding documents";

  if (decision === "approve") return null;

  return {
    trigger: "document_rejected" as const,
    user_id: profile.id,
    data: {
      client_name: profile.full_name ?? profile.email ?? "Student",
      document_name: documentName,
      document_id: data.document_id ?? undefined,
      document_reason: data.rejection_reason ?? undefined,
    },
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { profile_id, decision, reviewed_by, rejection_reason, document_scope, document_id } = await req.json();
    const scope: DocumentScope = document_scope === "global" ? "global" : "student";
    const singleDocumentId = typeof document_id === "string" && document_id.trim().length > 0
      ? document_id.trim()
      : null;

    if (!profile_id) {
      return new Response(
        JSON.stringify({ success: false, error: "profile_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!decision || !["approve", "reject"].includes(decision)) {
      return new Response(
        JSON.stringify({ success: false, error: "decision must be approve or reject" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!reviewed_by) {
      return new Response(
        JSON.stringify({ success: false, error: "reviewed_by is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (decision === "reject" && !rejection_reason?.trim()) {
      return new Response(
        JSON.stringify({ success: false, error: "rejection_reason is required when rejecting" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: profile, error: profileError } = await supabase
      .from("user_profiles")
      .select("id, user_id, email, full_name, documents_uploaded, documents_status")
      .eq("id", profile_id)
      .single();

    if (profileError || !profile) {
      return new Response(
        JSON.stringify({ success: false, error: "Profile not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!profile.user_id) {
      return new Response(
        JSON.stringify({ success: false, error: "Profile has no auth user_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const nextStatus = decision === "approve" ? "approved" : "rejected";
    let docsUpdateError: { message: string } | null = null;

    if (scope === "student") {
      if (singleDocumentId) {
        const { error } = await supabase
          .from("student_documents")
          .update({
            status: nextStatus,
            rejection_reason: decision === "reject" ? rejection_reason ?? null : null,
          })
          .eq("id", singleDocumentId)
          .eq("user_id", profile.user_id);

        docsUpdateError = error;
        if (docsUpdateError) {
          console.warn("[review-student-documents] Failed to update student_documents:", docsUpdateError.message);
        }
      } else {
        const { error } = await supabase
          .from("student_documents")
          .update({
            status: nextStatus,
            rejection_reason: decision === "reject" ? rejection_reason ?? null : null,
          })
          .eq("user_id", profile.user_id);

        docsUpdateError = error;
        if (docsUpdateError) {
          console.warn("[review-student-documents] Failed to update student_documents:", docsUpdateError.message);
        }
      }
    } else {
      const globalQuery = supabase
        .from("global_document_requests")
        .update({
          status: nextStatus,
          approved_at: decision === "approve" ? new Date().toISOString() : null,
          rejection_reason: decision === "reject" ? rejection_reason ?? null : null,
        });

      const { error } = singleDocumentId
        ? await globalQuery.eq("id", singleDocumentId).eq("profile_id", profile_id)
        : await globalQuery.eq("profile_id", profile_id);

      docsUpdateError = error;
      if (docsUpdateError) {
        console.warn("[review-student-documents] Failed to update global_document_requests:", docsUpdateError.message);
      }
    }

    const aggregateStatus = await getAggregateDocumentStatus(supabase, profile);
    const nextProfileUpdate: Record<string, unknown> = {
      documents_status: aggregateStatus,
      documents_uploaded: aggregateStatus === "approved" ? true : profile.documents_uploaded,
      updated_at: new Date().toISOString(),
    };

    if (aggregateStatus === "approved") {
      nextProfileUpdate.onboarding_current_step = "payment";
    } else if (decision === "reject" || aggregateStatus === "rejected") {
      nextProfileUpdate.onboarding_current_step = "documents_upload";
    }

    const { error: profileUpdateError } = await supabase
      .from("user_profiles")
      .update(nextProfileUpdate)
      .eq("id", profile_id);

    if (profileUpdateError) {
      return new Response(
        JSON.stringify({ success: false, error: profileUpdateError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    try {
      const appBaseUrl = Deno.env.get("APP_BASE_URL") ?? "https://migmainc.com";
      const notifyPayload = buildNotifyPayload(decision, profile, {
        rejection_reason: rejection_reason ?? null,
        scope,
        document_id: singleDocumentId,
      });

      if (notifyPayload && decision === "reject") {
        notifyPayload.data = {
          ...notifyPayload.data,
          app_url: `${appBaseUrl}/student/dashboard/documents`,
        };
      }

      // supabase.functions.invoke não passa service role key corretamente entre Edge Functions → 401.
      // Raw fetch com Bearer é o padrão correto para chamadas server-side.
      const notifyUrl = `${supabaseUrl}/functions/v1/migma-notify`;
      const notifyHeaders = {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${supabaseServiceKey}`,
        "apikey": supabaseServiceKey,
      };

      if (notifyPayload) {
        const notifyRes = await fetch(notifyUrl, {
          method: "POST",
          headers: notifyHeaders,
          body: JSON.stringify(notifyPayload),
        });
        if (!notifyRes.ok) {
          console.error("[review-student-documents] document_rejected notification failed:", notifyRes.status, await notifyRes.text());
        }
      }

      if (decision === "approve") {
        if (aggregateStatus === "approved") {
          const approvedNotifyRes = await fetch(notifyUrl, {
            method: "POST",
            headers: notifyHeaders,
            body: JSON.stringify({
              trigger: "all_documents_approved",
              user_id: profile.id,
              data: {
                client_name: profile.full_name ?? profile.email ?? "Student",
                app_url: `${appBaseUrl}/student/onboarding?step=payment`,
              },
            }),
          });
          if (!approvedNotifyRes.ok) {
            console.error("[review-student-documents] all_documents_approved notification failed:", approvedNotifyRes.status, await approvedNotifyRes.text());
          }

          if (scope === "global") {
            const adminNotifyRes = await fetch(notifyUrl, {
              method: "POST",
              headers: notifyHeaders,
              body: JSON.stringify({
                trigger: "admin_package_complete",
                data: {
                  client_name: profile.full_name ?? profile.email ?? "Student",
                  client_id: profile_id,
                },
              }),
            });
            if (!adminNotifyRes.ok) {
              console.error("[review-student-documents] admin_package_complete notification failed:", adminNotifyRes.status, await adminNotifyRes.text());
            }
          }
        }
      }
    } catch (notifyError) {
      console.warn("[review-student-documents] Notification failed:", notifyError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        profile_id,
        scope,
        documents_status: aggregateStatus,
        documents_updated: !docsUpdateError,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[review-student-documents] Unexpected error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
