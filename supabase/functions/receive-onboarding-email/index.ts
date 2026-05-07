import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { captureInboundClientEmail } from "../shared/service-request-operational.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-inbound-email-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function getSupabaseConfig() {
  const supabaseUrl =
    Deno.env.get("MIGMA_REMOTE_URL") ||
    Deno.env.get("REMOTE_SUPABASE_URL") ||
    Deno.env.get("SUPABASE_URL") ||
    "";
  const supabaseServiceKey =
    Deno.env.get("MIGMA_REMOTE_SERVICE_ROLE_KEY") ||
    Deno.env.get("REMOTE_SUPABASE_SERVICE_ROLE_KEY") ||
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ||
    "";

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error("Missing Supabase runtime configuration");
  }

  return { supabaseUrl, supabaseServiceKey };
}

function pickFirstString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return null;
}

function getNestedValue(source: unknown, path: string[]): unknown {
  let current = source;

  for (const segment of path) {
    if (!current || typeof current !== "object") return null;
    current = (current as Record<string, unknown>)[segment];
  }

  return current;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const configuredSecret = Deno.env.get("MIGMA_INBOUND_EMAIL_SECRET") || "";
    if (configuredSecret) {
      const providedSecret = req.headers.get("x-inbound-email-secret") || "";
      if (providedSecret !== configuredSecret) {
        return new Response(
          JSON.stringify({ error: "Unauthorized inbound email webhook" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    const payload = await req.json();
    const { supabaseUrl, supabaseServiceKey } = getSupabaseConfig();
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const fromAddress = pickFirstString(
      payload?.from,
      getNestedValue(payload, ["envelope", "from"]),
      getNestedValue(payload, ["sender", "email"]),
      getNestedValue(payload, ["headers", "from"]),
    );
    const toAddress = pickFirstString(
      payload?.to,
      getNestedValue(payload, ["envelope", "to"]),
      getNestedValue(payload, ["recipient", "email"]),
      getNestedValue(payload, ["headers", "to"]),
    );
    const subject = pickFirstString(
      payload?.subject,
      getNestedValue(payload, ["headers", "subject"]),
    );
    const bodyText = pickFirstString(
      payload?.text,
      payload?.textPlain,
      payload?.body_text,
      payload?.plain,
      getNestedValue(payload, ["body", "text"]),
      getNestedValue(payload, ["message", "text"]),
      payload?.["body-plain"],
    );
    const bodyHtml = pickFirstString(
      payload?.html,
      payload?.body_html,
      getNestedValue(payload, ["body", "html"]),
      getNestedValue(payload, ["message", "html"]),
      payload?.["body-html"],
    );
    const providerMessageId = pickFirstString(
      payload?.messageId,
      payload?.message_id,
      getNestedValue(payload, ["headers", "message-id"]),
      getNestedValue(payload, ["headers", "message_id"]),
    );
    const inReplyTo = pickFirstString(
      payload?.inReplyTo,
      payload?.in_reply_to,
      getNestedValue(payload, ["headers", "in-reply-to"]),
      getNestedValue(payload, ["headers", "in_reply_to"]),
    );
    const references = pickFirstString(
      payload?.references,
      getNestedValue(payload, ["headers", "references"]),
    );
    const threadId = pickFirstString(
      payload?.threadId,
      payload?.thread_id,
      getNestedValue(payload, ["thread", "id"]),
    );
    const receivedAt = pickFirstString(
      payload?.receivedAt,
      payload?.received_at,
      getNestedValue(payload, ["headers", "date"]),
    );
    const provider = pickFirstString(
      payload?.provider,
      payload?.source,
      payload?.mailbox_provider,
    ) || "email_webhook";
    const attachments =
      payload?.attachments ||
      payload?.files ||
      getNestedValue(payload, ["message", "attachments"]) ||
      [];

    const result = await captureInboundClientEmail(supabase, {
      serviceRequestId: pickFirstString(payload?.serviceRequestId, payload?.service_request_id),
      fromAddress,
      toAddress,
      subject,
      bodyText,
      bodyHtml,
      provider,
      providerMessageId,
      inReplyTo,
      references,
      threadId,
      receivedAt,
      attachments,
      rawPayload: payload,
    });

    return new Response(
      JSON.stringify({
        success: result.stored,
        skipped: result.skipped,
        reason: result.reason || null,
        service_request_id: result.serviceRequestId || null,
        analysis: result.analysis || null,
        created_documents: result.createdDocuments || 0,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("[receive-onboarding-email] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
