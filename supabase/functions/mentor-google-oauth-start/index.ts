import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.86.0";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RETURN_PATH = "/mentor/login";
const LOCAL_RETURN_ORIGINS = new Set([
  "http://localhost:5173",
  "http://127.0.0.1:5173",
]);

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

function requireEnv(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing env ${name}`);
  return value;
}

function readEnvStatus(names: string[]) {
  const missing = names.filter((name) => !Deno.env.get(name));
  return { ok: missing.length === 0, missing };
}

function allowedReturnOrigins() {
  const appReturnUrl = new URL(requireEnv("APP_RETURN_URL"));
  return new Set([
    appReturnUrl.origin,
    "https://migmainc.com",
    "https://www.migmainc.com",
    ...LOCAL_RETURN_ORIGINS,
  ]);
}

function requestOrigin(req: Request) {
  const origins = allowedReturnOrigins();
  const origin = req.headers.get("Origin");
  if (origin && origins.has(origin)) return origin;

  const referer = req.headers.get("Referer");
  if (referer) {
    const refererOrigin = new URL(referer).origin;
    if (origins.has(refererOrigin)) return refererOrigin;
  }

  return new URL(requireEnv("APP_RETURN_URL")).origin;
}

function buildReturnUrl(req: Request) {
  return new URL(RETURN_PATH, requestOrigin(req)).toString();
}

function base64UrlEncode(input: string | Uint8Array) {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : input;
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function signState(payload: Record<string, unknown>) {
  const statePayload = base64UrlEncode(JSON.stringify(payload));
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(requireEnv("OAUTH_STATE_SECRET")),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(statePayload));
  return `${statePayload}.${base64UrlEncode(new Uint8Array(signature))}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  try {
    const envStatus = readEnvStatus([
      "SUPABASE_URL",
      "SUPABASE_ANON_KEY",
      "GOOGLE_CLIENT_ID",
      "GOOGLE_REDIRECT_URI",
      "OAUTH_STATE_SECRET",
      "APP_RETURN_URL",
    ]);
    if (!envStatus.ok) {
      return jsonResponse({ error: "missing_env", missing: envStatus.missing }, 500);
    }

    const authorization = req.headers.get("Authorization") ?? "";
    const jwt = authorization.replace(/^Bearer\s+/i, "").trim();
    if (!jwt) return jsonResponse({ error: "unauthorized" }, 401);

    const supabase = createClient(
      requireEnv("SUPABASE_URL"),
      requireEnv("SUPABASE_ANON_KEY"),
      { global: { headers: { Authorization: authorization } } },
    );

    const { data: userData, error: userError } = await supabase.auth.getUser(jwt);
    if (userError || !userData.user) return jsonResponse({ error: "unauthorized" }, 401);

    const { data: profile, error: profileError } = await supabase
      .from("user_profiles")
      .select("id")
      .eq("user_id", userData.user.id)
      .maybeSingle();

    if (profileError) throw profileError;
    if (!profile?.id) return jsonResponse({ error: "profile_not_found" }, 404);

    const { data: mentor, error: mentorError } = await supabase
      .from("referral_mentors")
      .select("profile_id, active")
      .eq("profile_id", profile.id)
      .eq("active", true)
      .maybeSingle();

    if (mentorError) throw mentorError;
    if (!mentor) return jsonResponse({ error: "mentor_not_active" }, 403);

    const redirectUri = requireEnv("GOOGLE_REDIRECT_URI");
    const state = await signState({
      mentor_id: profile.id,
      return_url: buildReturnUrl(req),
      nonce: crypto.randomUUID(),
      iat: Date.now(),
    });

    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.searchParams.set("client_id", requireEnv("GOOGLE_CLIENT_ID"));
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", [
      "https://www.googleapis.com/auth/calendar.events",
      "https://www.googleapis.com/auth/calendar.readonly",
    ].join(" "));
    url.searchParams.set("access_type", "offline");
    url.searchParams.set("prompt", "consent");
    url.searchParams.set("include_granted_scopes", "true");
    url.searchParams.set("state", state);

    return jsonResponse({ authorize_url: url.toString() });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[mentor-google-oauth-start] error:", message);
    return jsonResponse({ error: "oauth_start_failed", message }, 500);
  }
});
