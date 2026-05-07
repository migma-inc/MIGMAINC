import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DEFAULT_GET_SLOTS_URL = "https://n8n.wartully.com.br/webhook/referral-get-slots";
const DEFAULT_BOOK_SLOT_URL = "https://n8n.wartully.com.br/webhook/referral-book-slot";

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const body = await req.json();
    const { action, ...payload } = body as Record<string, unknown>;

    const targetUrl =
      action === "get_slots"
        ? Deno.env.get("REFERRAL_GET_SLOTS_URL") ?? DEFAULT_GET_SLOTS_URL
        : action === "book_slot"
          ? Deno.env.get("REFERRAL_BOOK_SLOT_URL") ?? DEFAULT_BOOK_SLOT_URL
          : null;

    if (!targetUrl) {
      return jsonResponse({ error: "Invalid referral proxy action" }, 400);
    }

    const upstream =
      action === "get_slots"
        ? await fetch(`${targetUrl}?ref_code=${encodeURIComponent(String(payload.ref_code ?? ""))}`, {
            method: "GET",
          })
        : await fetch(targetUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });

    const responseText = await upstream.text();
    let responseBody: unknown = {};

    if (responseText) {
      try {
        responseBody = JSON.parse(responseText);
      } catch {
        responseBody = { message: responseText };
      }
    }

    return new Response(JSON.stringify(responseBody), {
      status: upstream.status,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[referral-n8n-proxy] error:", message);
    return jsonResponse({ error: "proxy_error", message }, 500);
  }
});
