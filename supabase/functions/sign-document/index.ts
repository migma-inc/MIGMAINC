import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function sha256Hex(data: string): Promise<string> {
  const bytes = new TextEncoder().encode(data);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function getClientIp(req: Request): string | null {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    req.headers.get("x-real-ip") ??
    req.headers.get("cf-connecting-ip") ??
    null
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  // Extract JWT and verify caller is an authenticated user
  const authHeader = req.headers.get("authorization") ?? "";
  const jwt = authHeader.replace(/^Bearer\s+/i, "").trim();

  if (!jwt) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  const authClient = createClient(supabaseUrl, anonKey);
  const { data: { user }, error: authError } = await authClient.auth.getUser(jwt);

  if (authError || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  const adminClient = createClient(supabaseUrl, serviceKey);

  try {
    const body = await req.json();
    const { form_id, proof_payload } = body as {
      form_id: string;
      proof_payload: Record<string, unknown>;
    };

    if (!form_id || !proof_payload) {
      return new Response(JSON.stringify({ error: "Missing form_id or proof_payload" }), {
        status: 400,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    // Confirm form belongs to this user via institution_applications → user_profiles
    const { data: formRow, error: formErr } = await adminClient
      .from("institution_forms")
      .select("id, application_id, institution_applications(id, profile_id, forms_status, user_profiles(user_id, full_name, email))")
      .eq("id", form_id)
      .single();

    if (formErr || !formRow) {
      return new Response(JSON.stringify({ error: "Form not found" }), {
        status: 404,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    type AppJoin = {
      id: string;
      profile_id: string;
      forms_status: string | null;
      user_profiles: {
        user_id: string;
        full_name: string | null;
        email: string | null;
      } | null;
    } | null;
    const app = formRow.institution_applications as AppJoin;
    const authUid = app?.user_profiles?.user_id ?? null;

    if (!authUid || authUid !== user.id) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const serverNow = new Date().toISOString();
    const ip = getClientIp(req);
    const ipHash = ip ? await sha256Hex(ip) : null;

    // Inject server-side fields into proof payload
    const audit = (proof_payload.audit ?? {}) as Record<string, unknown>;
    const request = (proof_payload.request ?? {}) as Record<string, unknown>;

    const finalPayload: Record<string, unknown> = {
      ...proof_payload,
      request: {
        ...request,
        ip_address_hash: ipHash,
      },
      audit: {
        ...audit,
        proof_created_at_server: serverNow,
        signature_confirmed_at_server: serverNow,
      },
    };

    // Recompute proof_payload_sha256 after server fields are injected
    const innerAudit = finalPayload.audit as Record<string, unknown>;
    innerAudit.proof_payload_sha256 = null;
    const payloadForHash = JSON.stringify(finalPayload);
    innerAudit.proof_payload_sha256 = await sha256Hex(payloadForHash);

    const signedPdfUrl = (
      (proof_payload.document as Record<string, unknown>)?.signed_pdf_url as string | undefined
    ) ?? null;

    const { error: updateError } = await adminClient
      .from("institution_forms")
      .update({
        signed_at: serverNow,
        signed_url: signedPdfUrl,
        signature_metadata_json: finalPayload,
      })
      .eq("id", form_id);

    if (updateError) throw updateError;

    if (formRow.application_id && app?.profile_id) {
      const { data: applicationForms, error: formsError } = await adminClient
        .from("institution_forms")
        .select("id, signed_at, form_type")
        .eq("application_id", formRow.application_id)
        .neq("form_type", "termo_responsabilidade_estudante");

      if (formsError) throw formsError;

      const allFormsSigned =
        (applicationForms ?? []).length > 0 &&
        (applicationForms ?? []).every((form) => form.id === form_id || !!form.signed_at);

      if (allFormsSigned && app.forms_status !== "signed") {
        const { data: signedApp, error: signedStatusError } = await adminClient
          .from("institution_applications")
          .update({ forms_status: "signed" })
          .eq("id", formRow.application_id)
          .select("id")
          .maybeSingle();

        if (signedStatusError) throw signedStatusError;

        if (signedApp?.id) {
          const notifyRes = await fetch(`${supabaseUrl}/functions/v1/migma-notify`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${serviceKey}`,
              "apikey": serviceKey,
            },
            body: JSON.stringify({
              trigger: "admin_package_complete",
              data: {
                client_name: app.user_profiles?.full_name ?? app.user_profiles?.email ?? "Cliente",
                client_id: app.profile_id,
              },
            }),
          });

          if (!notifyRes.ok) {
            console.error("[sign-document] admin_package_complete notification failed:", notifyRes.status, await notifyRes.text());
          }
        }
      }
    }

    console.log(`[sign-document] form ${form_id} signed by user ${user.id} at ${serverNow}`);

    return new Response(
      JSON.stringify({ ok: true, signed_at: serverNow, ip_address_hash: ipHash }),
      { status: 200, headers: { ...CORS, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[sign-document] error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
